import { PrismaClient, GeminiKeyStatus } from '@prisma/client';
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
  private prisma?: PrismaClient;
  private rotationIndex = 0;
  private strategy: 'ROUND_ROBIN' | 'LEAST_RECENTLY_USED' = 'ROUND_ROBIN';
  private inMemoryFallback: Map<string, KeyRecord> = new Map();

  constructor(strategy: 'ROUND_ROBIN' | 'LEAST_RECENTLY_USED' = 'ROUND_ROBIN', prisma?: PrismaClient) {
    this.strategy = strategy;
    this.prisma = prisma;
  }

  public setStrategy(strategy: 'ROUND_ROBIN' | 'LEAST_RECENTLY_USED') {
    this.strategy = strategy;
  }

  public async addKey(rawKey: string, name?: string): Promise<{ success: boolean; duplicate: boolean; key?: KeyMaskedMetadata }> {
    const normalized = normalizeKey(rawKey);
    if (!normalized) return { success: false, duplicate: false };

    const fingerprint = calculateKeyFingerprint(normalized);
    const encrypted = encryptKey(normalized);
    const last4 = extractLast4(normalized);

    if (this.prisma) {
      try {
        const existing = await this.prisma.geminiKey.findUnique({ where: { keyFingerprint: fingerprint } });
        if (existing) {
          return { success: false, duplicate: true };
        }

        const created = await this.prisma.geminiKey.create({
          data: {
            name: name || `Key ${last4}`,
            encryptedKey: encrypted,
            keyFingerprint: fingerprint,
            last4,
            status: 'ACTIVE'
          }
        });

        return {
          success: true,
          duplicate: false,
          key: this.toMaskedMetadata(created)
        };
      } catch (err: any) {
        if (err?.code === 'P2002' || err?.message?.includes('unique constraint')) {
          return { success: false, duplicate: true };
        }
        return { success: false, duplicate: false };
      }
    } else {
      const appMode = process.env.APP_MODE || 'DEVELOPMENT';
      if (appMode !== 'TEST') {
        throw new Error('DATABASE_REQUIRED: In-memory key pool fallback is only permitted when APP_MODE=TEST');
      }
      for (const rec of this.inMemoryFallback.values()) {
        if (rec.keyFingerprint === fingerprint) return { success: false, duplicate: true };
      }
      const id = 'key_' + Math.random().toString(36).substring(2, 11);
      const now = new Date();
      const rec: KeyRecord = {
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
        updatedAt: now
      };
      this.inMemoryFallback.set(id, rec);
      return { success: true, duplicate: false, key: this.toMaskedMetadata(rec) };
    }
  }

  public async addBulkKeys(rawText: string): Promise<KeyImportResult> {
    const keys = parseBulkKeys(rawText);
    let added = 0;
    let duplicates = 0;
    let failed = 0;
    const addedKeys: KeyMaskedMetadata[] = [];

    for (const rawKey of keys) {
      const res = await this.addKey(rawKey);
      if (res.success && res.key) {
        added++;
        addedKeys.push(res.key);
      } else if (res.duplicate) {
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
      addedKeys
    };
  }

  public async getNextActiveKey(): Promise<{ id: string; plaintextKey: string } | null> {
    const now = new Date();

    if (this.prisma) {
      const activeKeys = await this.prisma.geminiKey.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { cooldownUntil: null },
            { cooldownUntil: { lte: now } }
          ]
        }
      });

      if (activeKeys.length === 0) return null;

      let selected: KeyRecord;
      if (this.strategy === 'LEAST_RECENTLY_USED') {
        activeKeys.sort((a, b) => (a.lastUsedAt?.getTime() || 0) - (b.lastUsedAt?.getTime() || 0));
        selected = activeKeys[0] as any;
      } else {
        this.rotationIndex = this.rotationIndex % activeKeys.length;
        selected = activeKeys[this.rotationIndex] as any;
        this.rotationIndex = (this.rotationIndex + 1) % activeKeys.length;
      }

      await this.prisma.geminiKey.update({
        where: { id: selected.id },
        data: {
          lastUsedAt: now,
          requestCount: { increment: 1 }
        }
      });

      const plaintextKey = decryptKey(selected.encryptedKey);
      return { id: selected.id, plaintextKey };
    } else {
      const appMode = process.env.APP_MODE || 'DEVELOPMENT';
      if (appMode !== 'TEST') {
        throw new Error('DATABASE_REQUIRED: In-memory key pool fallback is only permitted when APP_MODE=TEST');
      }
      const eligible = Array.from(this.inMemoryFallback.values()).filter(
        k => k.status === 'ACTIVE' && (!k.cooldownUntil || k.cooldownUntil <= now)
      );
      if (eligible.length === 0) return null;

      let selected: KeyRecord;
      if (this.strategy === 'LEAST_RECENTLY_USED') {
        eligible.sort((a, b) => (a.lastUsedAt?.getTime() || 0) - (b.lastUsedAt?.getTime() || 0));
        selected = eligible[0];
      } else {
        this.rotationIndex = this.rotationIndex % eligible.length;
        selected = eligible[this.rotationIndex];
        this.rotationIndex = (this.rotationIndex + 1) % eligible.length;
      }

      selected.lastUsedAt = now;
      selected.requestCount += 1;
      selected.updatedAt = now;

      const plaintextKey = decryptKey(selected.encryptedKey);
      return { id: selected.id, plaintextKey };
    }
  }

  public async recordError(id: string, error: any): Promise<void> {
    const now = new Date();
    const status = error?.status || error?.statusCode;
    const isRateLimitOrQuota = status === 429 || error?.message?.includes('429') || error?.message?.includes('quota');
    const isAuthError = status === 401 || status === 403 || error?.message?.includes('API key');

    if (this.prisma) {
      const rec = await this.prisma.geminiKey.findUnique({ where: { id } });
      if (!rec) return;

      let newStatus: GeminiKeyStatus = rec.status;
      let cooldownUntil: Date | null = rec.cooldownUntil;

      if (isRateLimitOrQuota) {
        newStatus = 'RATE_LIMITED';
        cooldownUntil = new Date(now.getTime() + 15 * 60 * 1000); // 15 mins
      } else if (isAuthError) {
        newStatus = 'INVALID';
      } else if (rec.errorCount + 1 >= 5) {
        newStatus = 'DISABLED';
      }

      await this.prisma.geminiKey.update({
        where: { id },
        data: {
          errorCount: { increment: 1 },
          lastErrorAt: now,
          status: newStatus,
          cooldownUntil
        }
      });
    } else {
      const rec = this.inMemoryFallback.get(id);
      if (!rec) return;
      rec.errorCount += 1;
      rec.lastErrorAt = now;
      if (isRateLimitOrQuota) {
        rec.status = 'RATE_LIMITED';
        rec.cooldownUntil = new Date(now.getTime() + 15 * 60 * 1000);
      } else if (isAuthError) {
        rec.status = 'INVALID';
      } else if (rec.errorCount >= 5) {
        rec.status = 'DISABLED';
      }
    }
  }

  public async listMaskedKeys(): Promise<KeyMaskedMetadata[]> {
    if (this.prisma) {
      const keys = await this.prisma.geminiKey.findMany({ orderBy: { createdAt: 'desc' } });
      return keys.map(k => this.toMaskedMetadata(k));
    } else {
      const appMode = process.env.APP_MODE || 'DEVELOPMENT';
      if (appMode !== 'TEST') {
        throw new Error('DATABASE_REQUIRED: In-memory key pool fallback is only permitted when APP_MODE=TEST');
      }
      return Array.from(this.inMemoryFallback.values()).map(k => this.toMaskedMetadata(k));
    }
  }

  private toMaskedMetadata(record: any): KeyMaskedMetadata {
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
