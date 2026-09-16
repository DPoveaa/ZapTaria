import { describe, it, expect } from 'vitest';
import { encryptKey, decryptKey, calculateKeyFingerprint, maskKey, parseBulkKeys } from '../services/security/crypto.js';
import { GeminiKeyPoolManager } from '../services/ai/GeminiKeyPoolManager.js';

describe('Security Crypto & Key Pool', () => {
  it('should encrypt and decrypt keys accurately', () => {
    const rawKey = 'AIzaSyDummyTestKey1234567890';
    const encrypted = encryptKey(rawKey);
    expect(encrypted).not.toBe(rawKey);

    const decrypted = decryptKey(encrypted);
    expect(decrypted).toBe(rawKey);
  });

  it('should compute consistent HMAC fingerprint', () => {
    const rawKey1 = 'AIzaSyDummyTestKey1234567890';
    const rawKey2 = ' AIzaSyDummyTestKey1234567890 ';

    const fp1 = calculateKeyFingerprint(rawKey1);
    const fp2 = calculateKeyFingerprint(rawKey2);

    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(64);
  });

  it('should mask key and extract last4', () => {
    const masked = maskKey('AIzaSyDummyTestKey7890');
    expect(masked).toBe('••••••••••••7890');
  });

  it('should handle bulk insertion and duplicate detection in KeyPoolManager', () => {
    const pool = new GeminiKeyPoolManager('ROUND_ROBIN');
    const bulkText = `
      AIzaSyTestKey0001
      AIzaSyTestKey0002
      AIzaSyTestKey0001
    `;

    const result = pool.addBulkKeysInMemory(bulkText);
    expect(result.submitted).toBe(3);
    expect(result.added).toBe(2);
    expect(result.duplicates).toBe(1);

    const keys = pool.listMaskedKeys();
    expect(keys).toHaveLength(2);
    expect(keys[0].maskedKey).toBe('••••••••••••0001');
  });

  it('should rotate keys using ROUND_ROBIN strategy', () => {
    const pool = new GeminiKeyPoolManager('ROUND_ROBIN');
    pool.addKeyInMemory('Key1');
    pool.addKeyInMemory('Key2');

    const key1 = pool.getNextActiveKey();
    const key2 = pool.getNextActiveKey();
    const key3 = pool.getNextActiveKey();

    expect(key1?.plaintextKey).toBe('Key1');
    expect(key2?.plaintextKey).toBe('Key2');
    expect(key3?.plaintextKey).toBe('Key1');
  });
});
