import { describe, it, expect, beforeEach } from 'vitest';
import { MockWhatsAppProvider } from '../services/whatsapp/MockWhatsAppProvider.js';
import { HistorySynchronizer, StorageAdapter } from '../services/whatsapp/HistorySynchronizer.js';
import { WhatsAppMessage } from '../services/whatsapp/WhatsAppProvider.js';

class InMemoryStorage implements StorageAdapter {
  public messages: Map<string, WhatsAppMessage> = new Map();

  async isMessageExists(whatsappMessageId: string): Promise<boolean> {
    return this.messages.has(whatsappMessageId);
  }

  async saveMessage(msg: WhatsAppMessage): Promise<void> {
    this.messages.set(msg.id, msg);
  }

  async updateConversationTimestamp(chatId: string, timestamp: Date): Promise<void> {}
}

describe('WhatsApp Provider & History Synchronizer', () => {
  let provider: MockWhatsAppProvider;
  let storage: InMemoryStorage;
  let sync: HistorySynchronizer;

  beforeEach(() => {
    provider = new MockWhatsAppProvider();
    storage = new InMemoryStorage();
    sync = new HistorySynchronizer(provider, storage);
  });

  it('should connect session and list contacts', async () => {
    await provider.connectSession('test_session');
    const contacts = await provider.getContacts();
    expect(contacts).toHaveLength(1);
    expect(contacts[0].name).toBe('Supplier Bravus');
  });

  it('should synchronize chat history and handle duplicate detection', async () => {
    await provider.connectSession('test_session');
    const chatId = '5511999999999@c.us';

    await provider.sendText(chatId, 'Hello, do you have ANVISA docs?');
    await provider.sendText(chatId, 'Following up...');

    const res1 = await sync.syncChatHistory(chatId);
    expect(res1.totalFetched).toBe(2);
    expect(res1.imported).toBe(2);
    expect(res1.skippedDuplicates).toBe(0);

    // Syncing again should skip duplicates
    const res2 = await sync.syncChatHistory(chatId);
    expect(res2.imported).toBe(0);
    expect(res2.skippedDuplicates).toBe(2);
  });
});
