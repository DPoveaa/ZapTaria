import wppconnect from '@wppconnect-team/wppconnect';
import path from 'path';
import fs from 'fs';
import {
  WhatsAppProvider,
  WhatsAppContact,
  WhatsAppChat,
  WhatsAppMessage,
  WhatsAppSessionStatus,
  WhatsAppProviderEvents
} from './WhatsAppProvider.js';

export class WPPConnectProvider implements WhatsAppProvider {
  public name = 'WPPConnectProvider';
  private client: wppconnect.Whatsapp | null = null;
  private status: WhatsAppSessionStatus = 'CREATED';
  private qrCode: string | null = null;
  private sessionDataDir: string;

  constructor(sessionDataDir: string = '.wppconnect_sessions') {
    this.sessionDataDir = path.resolve(process.cwd(), sessionDataDir);
    if (!fs.existsSync(this.sessionDataDir)) {
      fs.mkdirSync(this.sessionDataDir, { recursive: true });
    }
  }

  public async connectSession(sessionName: string, events?: WhatsAppProviderEvents): Promise<void> {
    this.status = 'CONNECTING';
    events?.onSessionStatusChange?.('CONNECTING');

    try {
      this.client = await wppconnect.create({
        session: sessionName,
        folderNameToken: this.sessionDataDir,
        catchQR: (base64Qr) => {
          this.qrCode = base64Qr;
          this.status = 'QR_CODE';
          events?.onSessionStatusChange?.('QR_CODE', base64Qr);
        },
        statusFind: (statusSession) => {
          if (statusSession === 'isLogged' || statusSession === 'inChat') {
            this.status = 'CONNECTED';
            this.qrCode = null;
            events?.onSessionStatusChange?.('CONNECTED');
          } else if (statusSession === 'notLogged' || statusSession === 'desconnectedMobile') {
            this.status = 'DISCONNECTED';
            events?.onSessionStatusChange?.('DISCONNECTED');
          }
        },
        headless: 'new',
        useChrome: false,
        logQR: false,
      });

      this.status = 'CONNECTED';
      events?.onSessionStatusChange?.('CONNECTED');

      this.client.onMessage((msg) => {
        if (!events?.onIncomingMessage) return;
        const normalized = this.normalizeMessage(msg);
        events.onIncomingMessage(normalized);
      });
    } catch (err) {
      this.status = 'DISCONNECTED';
      events?.onSessionStatusChange?.('DISCONNECTED');
      throw err;
    }
  }

  public async disconnectSession(sessionName: string): Promise<void> {
    if (this.client) {
      await this.client.logout();
      await this.client.close();
      this.client = null;
    }
    this.status = 'LOGGED_OUT';
  }

  public async getQRCode(sessionName: string): Promise<string | null> {
    return this.qrCode;
  }

  public async getSessionStatus(sessionName: string): Promise<WhatsAppSessionStatus> {
    return this.status;
  }

  public async getContacts(): Promise<WhatsAppContact[]> {
    if (!this.client) throw new Error('WPPConnect client not initialized');
    const rawContacts = await this.client.getAllContacts();
    return rawContacts.map(c => ({
      id: c.id._serialized,
      phoneNumber: c.id.user,
      name: c.name || c.formattedName,
      pushName: c.pushname,
      profilePictureUrl: (c as any).profilePicThumbObj?.eurl || undefined,
    }));
  }

  public async getChats(): Promise<WhatsAppChat[]> {
    if (!this.client) throw new Error('WPPConnect client not initialized');
    const rawChats = await this.client.getAllChats();
    return rawChats.map(chat => ({
      id: chat.id._serialized,
      name: chat.name || (chat as any).formattedTitle,
      isGroup: chat.isGroup,
      unreadCount: chat.unreadCount || 0,
      lastMessageTimestamp: chat.t,
    }));
  }

  public async getMessages(chatId: string, limit: number = 20): Promise<WhatsAppMessage[]> {
    if (!this.client) throw new Error('WPPConnect client not initialized');
    const rawMsgs = await this.client.getMessages(chatId, { count: limit });
    return rawMsgs.map(m => this.normalizeMessage(m));
  }

  public async sendText(chatId: string, text: string): Promise<WhatsAppMessage> {
    if (!this.client) throw new Error('WPPConnect client not initialized');
    const result = await this.client.sendText(chatId, text);
    return this.normalizeMessage(result);
  }

  public async sendImage(chatId: string, filePathOrUrl: string, caption?: string): Promise<WhatsAppMessage> {
    if (!this.client) throw new Error('WPPConnect client not initialized');
    const result = await this.client.sendImage(chatId, filePathOrUrl, 'image', caption);
    return this.normalizeMessage(result);
  }

  public async sendFile(chatId: string, filePathOrUrl: string, filename?: string): Promise<WhatsAppMessage> {
    if (!this.client) throw new Error('WPPConnect client not initialized');
    const result = await this.client.sendFile(chatId, filePathOrUrl, filename);
    return this.normalizeMessage(result);
  }

  public async startTyping(chatId: string): Promise<void> {
    if (this.client) await this.client.startTyping(chatId);
  }

  public async stopTyping(chatId: string): Promise<void> {
    if (this.client) await this.client.stopTyping(chatId);
  }

  public async sendSeen(chatId: string): Promise<void> {
    if (this.client) await this.client.sendSeen(chatId);
  }

  private normalizeMessage(msg: any): WhatsAppMessage {
    let msgType: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'SYSTEM' = 'TEXT';
    if (msg.type === 'image') msgType = 'IMAGE';
    else if (msg.type === 'document') msgType = 'DOCUMENT';
    else if (msg.type === 'audio' || msg.type === 'ptt') msgType = 'AUDIO';
    else if (msg.type === 'video') msgType = 'VIDEO';

    return {
      id: msg.id?._serialized || msg.id || 'msg_' + Date.now(),
      chatId: msg.chatId?._serialized || msg.from || msg.to,
      senderId: msg.from?._serialized || msg.from,
      fromMe: Boolean(msg.fromMe),
      body: msg.body || msg.caption || '',
      type: msgType,
      timestamp: msg.timestamp ? new Date(msg.timestamp * 1000) : new Date(),
      hasMedia: Boolean(msg.isMedia || msg.type === 'image' || msg.type === 'document'),
      mediaType: msg.mimetype,
      quotedMsgId: msg.quotedMsgId,
      rawMetadata: { type: msg.type, mimetype: msg.mimetype, filename: msg.filename },
    };
  }
}
