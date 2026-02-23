/**
 * Token encryption using AES-256-GCM.
 *
 * AES-GCM provides authenticated encryption — confidentiality AND integrity.
 * If a stored ciphertext is tampered with, decryption throws immediately
 * (auth tag mismatch) rather than silently returning garbled data.
 * This is superior to AES-CBC which provides confidentiality only.
 *
 * Format stored in DB: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 *
 * MIGRATION NOTE:
 * Tokens previously encrypted with AES-CBC (2-part "iv:data" format) must
 * be re-encrypted before deploying. Run scripts/migrate-encryption.ts once.
 */

import crypto from 'crypto';
import { env } from '@/lib/env';

const ALGORITHM = 'aes-256-gcm' as const;
/** 12-byte IV is the GCM standard — optimal for security and performance */
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  // Support both 32-character utf8 strings and 64-character hex strings
  const isHex = /^[0-9a-fA-F]+$/.test(env.ENCRYPTION_KEY) && env.ENCRYPTION_KEY.length === 64;
  return Buffer.from(env.ENCRYPTION_KEY, isHex ? 'hex' : 'utf8');
}

/**
 * Encrypts a plaintext string.
 * Returns a format-stable string safe to store in the database.
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a ciphertext created by `encrypt()`.
 * Throws if the ciphertext was tampered with or the wrong key is used.
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');

  if (parts.length !== 3) {
    throw new Error(
      `[encryption] Invalid ciphertext format. Expected "iv:authTag:data" (3 parts), got ${parts.length}. ` +
      `Old AES-CBC tokens (2 parts) must be migrated first — run scripts/migrate-encryption.ts.`
    );
  }

  const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Returns true if a stored ciphertext uses the old AES-CBC 2-part format.
 * Used by the migration script to identify tokens that need re-encryption.
 */
export function isLegacyCbcFormat(ciphertext: string): boolean {
  return ciphertext.split(':').length === 2;
}
