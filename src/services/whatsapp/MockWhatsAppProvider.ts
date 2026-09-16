import {
  WhatsAppProvider,
  WhatsAppContact,
  WhatsAppChat,
  WhatsAppMessage,
  WhatsAppSessionStatus,
  WhatsAppProviderEvents
} from './WhatsAppProvider.js';

export class MockWhatsAppProvider implements WhatsAppProvider {
  public name = 'MockWhatsAppProvider';
  private status: WhatsAppSessionStatus = 'CONNECTED';
  private events?: WhatsAppProviderEvents;
  private sentMessages: WhatsAppMessage[] = [];

  public async connectSession(sessionName: string, events?: WhatsAppProviderEvents): Promise<void> {
    this.status = 'CONNECTED';
    this.events = events;
    events?.onSessionStatusChange?.('CONNECTED');
  }

  public async disconnectSession(sessionName: string): Promise<void> {
    this.status = 'LOGGED_OUT';
    this.events?.onSessionStatusChange?.('LOGGED_OUT');
  }

  public async getQRCode(sessionName: string): Promise<string | null> {
    return 'data:image/png;base64,mockQRCodeData';
  }

  public async getSessionStatus(sessionName: string): Promise<WhatsAppSessionStatus> {
    return this.status;
  }

  public async getContacts(): Promise<WhatsAppContact[]> {
    return [
      {
        id: '5511999999999@c.us',
        phoneNumber: '5511999999999',
        name: 'Supplier Bravus',
        pushName: 'Supplier Tech',
      }
    ];
  }

  public async getChats(): Promise<WhatsAppChat[]> {
    return [
      {
        id: '5511999999999@c.us',
        name: 'Supplier Bravus',
        isGroup: false,
        unreadCount: 0,
        lastMessageTimestamp: Date.now(),
      }
    ];
  }

  public async getMessages(chatId: string, limit: number = 20): Promise<WhatsAppMessage[]> {
    return this.sentMessages.filter(m => m.chatId === chatId);
  }

  public async sendText(chatId: string, text: string): Promise<WhatsAppMessage> {
    const msg: WhatsAppMessage = {
      id: 'mock_msg_' + Math.random().toString(36).substring(2, 10),
      chatId,
      senderId: 'user_me',
      fromMe: true,
      body: text,
      type: 'TEXT',
      timestamp: new Date(),
      hasMedia: false,
    };
    this.sentMessages.push(msg);
    return msg;
  }

  public async sendImage(chatId: string, filePathOrUrl: string, caption?: string): Promise<WhatsAppMessage> {
    const msg: WhatsAppMessage = {
      id: 'mock_img_' + Math.random().toString(36).substring(2, 10),
      chatId,
      senderId: 'user_me',
      fromMe: true,
      body: caption || '',
      type: 'IMAGE',
      timestamp: new Date(),
      hasMedia: true,
      mediaType: 'image/jpeg',
    };
    this.sentMessages.push(msg);
    return msg;
  }

  public async sendFile(chatId: string, filePathOrUrl: string, filename?: string): Promise<WhatsAppMessage> {
    const msg: WhatsAppMessage = {
      id: 'mock_file_' + Math.random().toString(36).substring(2, 10),
      chatId,
      senderId: 'user_me',
      fromMe: true,
      body: filename || '',
      type: 'DOCUMENT',
      timestamp: new Date(),
      hasMedia: true,
      mediaType: 'application/pdf',
    };
    this.sentMessages.push(msg);
    return msg;
  }

  public async startTyping(chatId: string): Promise<void> {}
  public async stopTyping(chatId: string): Promise<void> {}
  public async sendSeen(chatId: string): Promise<void> {}

  // Helper method to simulate incoming contact message
  public simulateIncomingMessage(chatId: string, body: string, hasMedia: boolean = false, mediaType?: string): WhatsAppMessage {
    const msg: WhatsAppMessage = {
      id: 'inbound_msg_' + Math.random().toString(36).substring(2, 10),
      chatId,
      senderId: chatId,
      fromMe: false,
      body,
      type: hasMedia ? 'DOCUMENT' : 'TEXT',
      timestamp: new Date(),
      hasMedia,
      mediaType,
    };
    this.events?.onIncomingMessage?.(msg);
    return msg;
  }
}
