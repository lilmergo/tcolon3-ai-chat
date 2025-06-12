export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  uid: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
}