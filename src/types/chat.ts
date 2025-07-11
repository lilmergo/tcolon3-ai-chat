// Legacy interfaces for backward compatibility
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

// New enhanced interfaces for advanced features
export interface ThinkingStep {
  id: string;
  stepType: 'analysis' | 'planning' | 'knowledge_query' | 'web_search' | 'reasoning' | 'synthesis';
  title: string;
  content: string;
  timestamp: string;
  duration?: number;
  metadata?: any;
}

export interface KnowledgeBaseReference {
  documentId: string;
  documentTitle: string;
  relevanceScore: number;
  excerpt: string;
  pageNumber?: number;
  chunkId: string;
}

export interface EnhancedChatMessage extends ChatMessage {
  thinkingSteps?: ThinkingStep[];
  knowledgeBaseReferences?: KnowledgeBaseReference[];
  memoryContext?: {
    tokenCount: number;
    summaryGenerated: boolean;
    contextWindow: string[]; // Message IDs in context
  };
  processingMetadata?: {
    model: string;
    processingTime: number;
    advancedMode: boolean;
    langGraphState?: any; // Serialized LangGraph state
  };
}

export interface EnhancedChat extends Chat {
  advancedThinkingEnabled: boolean;
  knowledgeBaseEnabled: boolean;
  memoryStrategy: 'simple' | 'summary' | 'vector';
  maxMemoryTokens: number;
  systemPrompt?: string;
  preferredModel: string;
  settings: {
    webSearchEnabled: boolean;
    thinkingStepsVisible: boolean;
    knowledgeBaseWeight: number; // 0-1, how much to weight KB vs general knowledge
  };
}

export interface KnowledgeBaseDocument {
  id: string;
  userId: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  processedAt?: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';

  // File storage
  storagePath: string; // Firebase Storage path

  // Processing metadata
  processingMetadata: {
    totalChunks: number;
    totalTokens: number;
    processingTime?: number;
    errorMessage?: string;
    progress?: number; // 0-100 percentage
    stage?: 'extracting' | 'chunking' | 'storing' | 'finalizing' | 'completed';
    lastUpdated?: string; // ISO timestamp
  };

  // Document metadata
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
    language?: string;
    pageCount?: number;
  };

  // LlamaIndex integration
  indexMetadata: {
    indexId: string; // LlamaIndex document ID
    vectorStoreId: string;
    embeddingModel: string;
    lastIndexed: string;
  };

  // User organization
  tags: string[];
  category?: string;
  description?: string;
  isActive: boolean;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;

  // Position in document
  startPosition: number;
  endPosition: number;
  pageNumber?: number;

  // Vector embedding metadata
  embeddingMetadata: {
    model: string;
    dimensions: number;
    createdAt: string;
  };

  // Context
  previousChunkId?: string;
  nextChunkId?: string;

  // Metadata for retrieval
  metadata: {
    headings?: string[];
    keywords?: string[];
    summary?: string;
  };
}

export interface ConversationMemory {
  id: string;
  chatId: string;
  type: 'summary' | 'buffer' | 'vector';

  // Memory content
  content: string;
  tokenCount: number;

  // Temporal information
  createdAt: string;
  updatedAt: string;
  messageRange: {
    startMessageId: string;
    endMessageId: string;
    messageCount: number;
  };

  // Vector memory specific
  vectorMetadata?: {
    embeddingModel: string;
    dimensions: number;
    similarity_threshold: number;
  };

  // Summary memory specific
  summaryMetadata?: {
    compressionRatio: number;
    originalTokenCount: number;
    summaryModel: string;
  };
}

export interface UserAIChatSettings {
  userId: string;

  // Default preferences
  defaultAdvancedThinking: boolean;
  defaultKnowledgeBase: boolean;
  defaultModel: string;
  defaultMemoryStrategy: 'simple' | 'summary' | 'vector';

  // Knowledge base settings
  knowledgeBaseSettings: {
    maxDocuments: number;
    maxTotalSize: number; // in bytes
    autoProcessing: boolean;
    embeddingModel: string;
    chunkSize: number;
    chunkOverlap: number;
  };

  // Advanced thinking settings
  thinkingSettings: {
    showStepsToUser: boolean;
    maxThinkingSteps: number;
    enableWebSearch: boolean;
    enableKnowledgeQuery: boolean;
  };

  // API settings
  apiSettings: {
    openRouterApiKey?: string;
    preferredProvider: 'openrouter' | 'openai' | 'anthropic';
    customEndpoints?: { [key: string]: string };
  };

  // Privacy settings
  privacySettings: {
    encryptKnowledgeBase: boolean;
    shareKnowledgeBase: boolean;
    retainConversationMemory: boolean;
  };
}

export interface OpenRouterModel {
  id: string;
  name: string;
}