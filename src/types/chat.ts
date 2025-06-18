export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'collaborator';
  encryptedContent: string;
  timestamp: string;
  uid: string;
  attachments?: { storagePath: string; fileName: string; mimeType: string }[];
  isCode?: boolean;
  webSearchResults?: { url: string; title: string; snippet: string }[];
}

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  participants: string[];
  isCollaborative: boolean;
  isShared: boolean;
  shareToken: string;
  isTemporary?: boolean; // Optional flag to identify temporary chats
}

export interface OpenRouterModel {
  id: string;
  name: string;
}