import { GeminiKeyStatus } from '@prisma/client';
import {
  normalizeKey,
  encryptKey,
  decryptKey,
  calculateKeyFingerprint,
  maskKey,
  extractLast4,
  parseBulkKeys
} from '../security/crypto.js';

export interface KeyRecord {
  id: string;
  name?: string | null;
  encryptedKey: string;
  keyFingerprint: string;
  last4: string;
  status: GeminiKeyStatus;
  requestCount: number;
  errorCount: number;
  lastUsedAt?: Date | null;
  lastErrorAt?: Date | null;
  cooldownUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KeyMaskedMetadata {
  id: string;
  name?: string | null;
  last4: string;
  maskedKey: string;
  status: GeminiKeyStatus;
  requestCount: number;
  errorCount: number;
  lastUsedAt?: Date | null;
  lastErrorAt?: Date | null;
  cooldownUntil?: Date | null;
  createdAt: Date;
}

export interface KeyImportResult {
  submitted: number;
  added: number;
  duplicates: number;
  failed: number;
  addedKeys: KeyMaskedMetadata[];
}

export class GeminiKeyPoolManager {
  private inMemoryKeys: Map<string, KeyRecord> = new Map();
  private rotationIndex = 0;
  private strategy: 'ROUND_ROBIN' | 'LEAST_RECENTLY_USED' = 'ROUND_ROBIN';

  constructor(strategy: 'ROUND_ROBIN' | 'LEAST_RECENTLY_USED' = 'ROUND_ROBIN') {
    this.strategy = strategy;
  }

  public setStrategy(strategy: 'ROUND_ROBIN' | 'LEAST_RECENTLY_USED') {
    this.strategy = strategy;
  }

  public addKeyInMemory(rawKey: string, name?: string): { success: boolean; duplicate: boolean; key?: KeyMaskedMetadata } {
    const normalized = normalizeKey(rawKey);
    if (!normalized) {
      return { success: false, duplicate: false };
    }

    const fingerprint = calculateKeyFingerprint(normalized);

    // Check duplicate against in-memory records
    for (const keyRecord of this.inMemoryKeys.values()) {
      if (keyRecord.keyFingerprint === fingerprint) {
        return { success: false, duplicate: true };
      }
    }

    const encrypted = encryptKey(normalized);
    const last4 = extractLast4(normalized);
    const id = 'key_' + Math.random().toString(36).substring(2, 11);
    const now = new Date();

    const newRecord: KeyRecord = {
      id,
      name: name || `Key ${last4}`,
      encryptedKey: encrypted,
      keyFingerprint: fingerprint,
      last4,
      status: 'ACTIVE',
      requestCount: 0,
      errorCount: 0,
      lastUsedAt: null,
      lastErrorAt: null,
      cooldownUntil: null,
      createdAt: now,
      updatedAt: now,
    };

    this.inMemoryKeys.set(id, newRecord);

    return {
      success: true,
      duplicate: false,
      key: this.toMaskedMetadata(newRecord),
    };
  }

  public addBulkKeysInMemory(rawText: string): KeyImportResult {
    const keys = parseBulkKeys(rawText);
    let added = 0;
    let duplicates = 0;
    let failed = 0;
    const addedKeys: KeyMaskedMetadata[] = [];

    for (const rawKey of keys) {
      const result = this.addKeyInMemory(rawKey);
      if (result.success && result.key) {
        added++;
        addedKeys.push(result.key);
      } else if (result.duplicate) {
        duplicates++;
      } else {
        failed++;
      }
    }

    return {
      submitted: keys.length,
      added,
      duplicates,
      failed,
      addedKeys,
    };
  }

  public getNextActiveKey(): { id: string; plaintextKey: string } | null {
    const now = new Date();
    const eligibleKeys: KeyRecord[] = [];

    for (const keyRecord of this.inMemoryKeys.values()) {
      if (keyRecord.status === 'ACTIVE') {
        if (!keyRecord.cooldownUntil || keyRecord.cooldownUntil <= now) {
          eligibleKeys.push(keyRecord);
        }
      }
    }

    if (eligibleKeys.length === 0) {
      return null;
    }

    let selected: KeyRecord;

    if (this.strategy === 'LEAST_RECENTLY_USED') {
      eligibleKeys.sort((a, b) => {
        const timeA = a.lastUsedAt ? a.lastUsedAt.getTime() : 0;
        const timeB = b.lastUsedAt ? b.lastUsedAt.getTime() : 0;
        return timeA - timeB;
      });
      selected = eligibleKeys[0];
    } else {
      // ROUND_ROBIN
      this.rotationIndex = this.rotationIndex % eligibleKeys.length;
      selected = eligibleKeys[this.rotationIndex];
      this.rotationIndex = (this.rotationIndex + 1) % eligibleKeys.length;
    }

    // Update usage metadata
    selected.lastUsedAt = now;
    selected.requestCount += 1;
    selected.updatedAt = now;

    const plaintextKey = decryptKey(selected.encryptedKey);
    return { id: selected.id, plaintextKey };
  }

  public recordError(id: string, isQuotaOrRateLimit: boolean = false) {
    const record = this.inMemoryKeys.get(id);
    if (!record) return;

    const now = new Date();
    record.errorCount += 1;
    record.lastErrorAt = now;
    record.updatedAt = now;

    if (isQuotaOrRateLimit) {
      // 15-minute cooldown
      record.cooldownUntil = new Date(now.getTime() + 15 * 60 * 1000);
      record.status = 'RATE_LIMITED';
    } else if (record.errorCount >= 5) {
      record.status = 'DISABLED';
    }
  }

  public listMaskedKeys(): KeyMaskedMetadata[] {
    return Array.from(this.inMemoryKeys.values()).map(k => this.toMaskedMetadata(k));
  }

  public getKeyRecord(id: string): KeyRecord | undefined {
    return this.inMemoryKeys.get(id);
  }

  public removeKey(id: string): boolean {
    return this.inMemoryKeys.delete(id);
  }

  private toMaskedMetadata(record: KeyRecord): KeyMaskedMetadata {
    return {
      id: record.id,
      name: record.name,
      last4: record.last4,
      maskedKey: maskKey(record.last4),
      status: record.status,
      requestCount: record.requestCount,
      errorCount: record.errorCount,
      lastUsedAt: record.lastUsedAt,
      lastErrorAt: record.lastErrorAt,
      cooldownUntil: record.cooldownUntil,
      createdAt: record.createdAt,
    };
  }
}
