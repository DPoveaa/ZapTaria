import { WhatsAppProvider, WhatsAppMessage } from './WhatsAppProvider.js';

export interface SyncResult {
  totalFetched: number;
  imported: number;
  skippedDuplicates: number;
}

export interface StorageAdapter {
  isMessageExists(whatsappMessageId: string): Promise<boolean>;
  saveMessage(msg: WhatsAppMessage): Promise<void>;
  updateConversationTimestamp(chatId: string, timestamp: Date): Promise<void>;
}

export class HistorySynchronizer {
  private provider: WhatsAppProvider;
  private storage: StorageAdapter;

  constructor(provider: WhatsAppProvider, storage: StorageAdapter) {
    this.provider = provider;
    this.storage = storage;
  }

  public async syncChatHistory(chatId: string, limit: number = 50): Promise<SyncResult> {
    const rawMessages = await this.provider.getMessages(chatId, limit);
    let imported = 0;
    let skippedDuplicates = 0;

    for (const msg of rawMessages) {
      const exists = await this.storage.isMessageExists(msg.id);
      if (exists) {
        skippedDuplicates++;
        continue;
      }

      await this.storage.saveMessage(msg);
      imported++;
    }

    if (rawMessages.length > 0) {
      const latestMsg = rawMessages[rawMessages.length - 1];
      await this.storage.updateConversationTimestamp(chatId, latestMsg.timestamp);
    }

    return {
      totalFetched: rawMessages.length,
      imported,
      skippedDuplicates,
    };
  }
}
