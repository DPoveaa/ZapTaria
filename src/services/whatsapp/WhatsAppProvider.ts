export interface WhatsAppContact {
  id: string; // whatsappId e.g., 5511999999999@c.us
  phoneNumber: string;
  name?: string;
  pushName?: string;
  profilePictureUrl?: string;
}

export interface WhatsAppChat {
  id: string; // whatsappChatId
  name?: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessageTimestamp?: number;
}

export interface WhatsAppMessage {
  id: string; // whatsappMessageId
  chatId: string;
  senderId: string;
  fromMe: boolean;
  body: string;
  type: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'SYSTEM';
  timestamp: Date;
  hasMedia: boolean;
  mediaType?: string;
  mediaUrl?: string;
  quotedMsgId?: string;
  rawMetadata?: any;
}

export type WhatsAppSessionStatus = 'CREATED' | 'QR_CODE' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'LOGGED_OUT';

export interface WhatsAppProviderEvents {
  onSessionStatusChange?: (status: WhatsAppSessionStatus, qrCode?: string) => void;
  onIncomingMessage?: (message: WhatsAppMessage) => void;
}

export interface WhatsAppProvider {
  name: string;
  connectSession(sessionName: string, events?: WhatsAppProviderEvents): Promise<void>;
  disconnectSession(sessionName: string): Promise<void>;
  getQRCode(sessionName: string): Promise<string | null>;
  getSessionStatus(sessionName: string): Promise<WhatsAppSessionStatus>;
  getContacts(): Promise<WhatsAppContact[]>;
  getChats(): Promise<WhatsAppChat[]>;
  getMessages(chatId: string, limit?: number, beforeMessageId?: string): Promise<WhatsAppMessage[]>;
  sendText(chatId: string, text: string): Promise<WhatsAppMessage>;
  sendImage(chatId: string, filePathOrUrl: string, caption?: string): Promise<WhatsAppMessage>;
  sendFile(chatId: string, filePathOrUrl: string, filename?: string): Promise<WhatsAppMessage>;
  startTyping(chatId: string): Promise<void>;
  stopTyping(chatId: string): Promise<void>;
  sendSeen(chatId: string): Promise<void>;
}
