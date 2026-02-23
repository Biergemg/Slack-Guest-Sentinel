import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local manually since this is a standalone script
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ENCRYPTION_KEY) {
    console.error('Missing required environment variables.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY, 'utf8');

// Copied legacy decrypt function (AES-CBC) to read the old data
function legacyDecrypt(encryptedText: string): string | null {
    try {
        const textParts = encryptedText.split(':');
        if (textParts.length !== 2) return null; // Not the legacy format

        const iv = Buffer.from(textParts.shift()!, 'hex');
        const encryptedData = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', KEY_BUFFER, iv);
        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (err) {
        return null;
    }
}

// New encrypt function (AES-256-GCM)
function encryptNew(text: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY_BUFFER, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

async function migrate() {
    console.log('Fetching workspaces...');
    const { data: workspaces, error } = await supabase.from('workspaces').select('id, access_token');

    if (error || !workspaces) {
        console.error('Failed to fetch workspaces:', error);
        process.exit(1);
    }

    console.log(`Found ${workspaces.length} workspaces. Checking tokens...`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const workspace of workspaces) {
        if (!workspace.access_token) continue;

        // Check if it's already in the new GCM format (3 parts separated by colons)
        if (workspace.access_token.split(':').length === 3) {
            console.log(`Workspace ${workspace.id} already uses AES-GCM. Skipping.`);
            continue;
        }

        // Try to decrypt with the legacy AES-CBC method
        const plaintext = legacyDecrypt(workspace.access_token);
        if (!plaintext) {
            console.error(`Failed to decrypt legacy token for workspace ${workspace.id}`);
            errorCount++;
            continue;
        }

        // Encrypt with the new AES-GCM method
        const newEncryptedToken = encryptNew(plaintext);

        // Update the database
        const { error: updateError } = await supabase
            .from('workspaces')
            .update({ access_token: newEncryptedToken })
            .eq('id', workspace.id);

        if (updateError) {
            console.error(`Failed to update workspace ${workspace.id}:`, updateError);
            errorCount++;
        } else {
            console.log(`Successfully migrated workspace ${workspace.id}`);
            migratedCount++;
        }
    }

    console.log('---');
    console.log(`Migration complete. Migrated: ${migratedCount}. Errors: ${errorCount}`);
}

migrate();
