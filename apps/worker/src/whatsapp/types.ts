export interface WhatsAppConfig {
  sessionName?: string;
  authPath?: string;
  printQR?: boolean;
}

export interface WhatsAppMessage {
  to: string; // Group JID or phone number
  text: string;
}

export interface WhatsAppGroup {
  id: string;
  subject: string;
  participants: string[];
  owner?: string;
  desc?: string;
  creation?: number;
}

export interface ConnectionState {
  isConnected: boolean;
  qr?: string;
  isNewLogin?: boolean;
  lastDisconnect?: {
    error: Error;
    date: Date;
  };
}
