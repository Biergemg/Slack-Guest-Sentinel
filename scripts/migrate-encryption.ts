/**
 * One-time migration: re-encrypts AES-CBC tokens to AES-256-GCM.
 *
 * Run ONCE before production deploy if any workspaces have legacy tokens.
 * Safe to re-run — already-GCM tokens (3-part format) are skipped.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/migrate-encryption.ts
 */

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
  console.error('Missing required environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Mirrors lib/env.ts requireEnvExactLength logic —
 * supports both 32-char UTF-8 keys and 64-char hex keys.
 */
function getKey(): Buffer {
  const isHex = /^[0-9a-fA-F]+$/.test(ENCRYPTION_KEY!) && ENCRYPTION_KEY!.length === 64;
  return Buffer.from(ENCRYPTION_KEY!, isHex ? 'hex' : 'utf8');
}

const KEY_BUFFER = getKey();

/** Decrypts an old AES-256-CBC token (2-part "iv_hex:ciphertext_hex"). */
function legacyDecrypt(encryptedText: string): string | null {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return null; // Not legacy format

    const [ivHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', KEY_BUFFER, iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Encrypts using AES-256-GCM.
 * Format MUST match lib/encryption.ts encrypt(): "iv_hex:authTag_hex:ciphertext_hex"
 */
function encryptGcm(plaintext: string): string {
  const iv = crypto.randomBytes(12); // 12-byte IV — GCM standard
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY_BUFFER, iv, {
    authTagLength: 16,
  });

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Order: iv : authTag : ciphertext  (matches decrypt() in lib/encryption.ts)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/** Returns true if ciphertext is already in GCM format (3 colon-separated parts). */
function isGcmFormat(value: string): boolean {
  return value.split(':').length === 3;
}

async function migrate() {
  console.log('Fetching workspaces with tokens...');
  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id, access_token, refresh_token');

  if (error || !workspaces) {
    console.error('Failed to fetch workspaces:', error);
    process.exit(1);
  }

  console.log(`Found ${workspaces.length} workspaces. Scanning for legacy tokens...\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const workspace of workspaces) {
    const updates: Record<string, string> = {};

    // --- access_token ---
    if (workspace.access_token) {
      if (isGcmFormat(workspace.access_token)) {
        // Already migrated
      } else {
        const plaintext = legacyDecrypt(workspace.access_token);
        if (!plaintext) {
          console.error(`[${workspace.id}] Could not decrypt legacy access_token — skipping workspace.`);
          errorCount++;
          continue;
        }
        updates.access_token = encryptGcm(plaintext);
      }
    }

    // --- refresh_token (optional) ---
    if (workspace.refresh_token) {
      if (isGcmFormat(workspace.refresh_token)) {
        // Already migrated
      } else {
        const plaintext = legacyDecrypt(workspace.refresh_token);
        if (!plaintext) {
          console.error(`[${workspace.id}] Could not decrypt legacy refresh_token — skipping workspace.`);
          errorCount++;
          continue;
        }
        updates.refresh_token = encryptGcm(plaintext);
      }
    }

    if (Object.keys(updates).length === 0) {
      console.log(`[${workspace.id}] All tokens already GCM — skipped.`);
      skippedCount++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', workspace.id);

    if (updateError) {
      console.error(`[${workspace.id}] DB update failed:`, updateError.message);
      errorCount++;
    } else {
      const fields = Object.keys(updates).join(', ');
      console.log(`[${workspace.id}] Migrated: ${fields}`);
      migratedCount++;
    }
  }

  console.log('\n--- Migration complete ---');
  console.log(`  Migrated : ${migratedCount}`);
  console.log(`  Skipped  : ${skippedCount} (already GCM)`);
  console.log(`  Errors   : ${errorCount}`);

  if (errorCount > 0) {
    console.error('\n⚠️  Some workspaces could not be migrated. Resolve errors before deploying.');
    process.exit(1);
  }
}

migrate();
