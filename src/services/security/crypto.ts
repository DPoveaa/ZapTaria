import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export function validateProductionSecrets(): void {
  const isTest = process.env.NODE_ENV === 'test' || process.env.APP_MODE === 'TEST';
  if (isTest) return;

  const encKey = process.env.ENCRYPTION_KEY;
  const fpSecret = process.env.KEY_FINGERPRINT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!encKey || encKey.length !== 64) {
    throw new Error('FATAL_SECURITY_ERROR: ENCRYPTION_KEY must be a valid 64-character hex string (32 bytes)');
  }
  if (!fpSecret || fpSecret.length < 32) {
    throw new Error('FATAL_SECURITY_ERROR: KEY_FINGERPRINT_SECRET must be at least 32 characters long');
  }
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error('FATAL_SECURITY_ERROR: SESSION_SECRET must be at least 32 characters long');
  }
}

function getEncryptionKey(): Buffer {
  const hexKey = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  return Buffer.from(hexKey, 'hex');
}

function getFingerprintSecret(): string {
  return process.env.KEY_FINGERPRINT_SECRET || '0123456789abcdef0123456789abcdef';
}

export function normalizeKey(rawKey: string): string {
  return rawKey.trim();
}

export function encryptKey(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptKey(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encryptedText = Buffer.from(parts[2], 'hex');
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted.toString('utf8');
}

export function calculateKeyFingerprint(key: string): string {
  const normalized = normalizeKey(key);
  const secret = getFingerprintSecret();
  return crypto.createHmac('sha256', secret).update(normalized).digest('hex');
}

export function maskKey(key: string): string {
  const normalized = normalizeKey(key);
  const last4 = extractLast4(normalized);
  return '••••••••••••' + last4;
}

export function extractLast4(key: string): string {
  const normalized = normalizeKey(key);
  return normalized.length >= 4 ? normalized.slice(-4) : normalized;
}

export function parseBulkKeys(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}
