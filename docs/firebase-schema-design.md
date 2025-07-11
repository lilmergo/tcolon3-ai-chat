# Firebase Schema Design for Advanced AI Chat

## Overview
This document outlines the updated Firebase schema to support:
- Advanced thinking mode with LangGraph
- Knowledge base management with LlamaIndex
- Enhanced conversation memory with LangChain
- File uploads and processing

## Current Schema (for reference)

### Chats Collection: `/chats/{chatId}`
```typescript
interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  participants: string[];
  isCollaborative: boolean;
  isShared: boolean;
  shareToken: string;
  isTemporary?: boolean;
}
```

### Messages Subcollection: `/chats/{chatId}/messages/{messageId}`
```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'collaborator';
  encryptedContent: string;
  timestamp: string;
  uid: string;
  attachments?: { storagePath: string; fileName: string; mimeType: string }[];
  isCode?: boolean;
  webSearchResults?: { url: string; title: string; snippet: string }[];
}
```

## New Schema Design

### 1. Enhanced Chats Collection: `/chats/{chatId}`
```typescript
interface EnhancedChat {
  // Existing fields
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  participants: string[];
  isCollaborative: boolean;
  isShared: boolean;
  shareToken: string;
  isTemporary?: boolean;
  
  // New fields for advanced features
  advancedThinkingEnabled: boolean;
  knowledgeBaseEnabled: boolean;
  memoryStrategy: 'simple' | 'summary' | 'vector'; // LangChain memory type
  maxMemoryTokens: number;
  systemPrompt?: string; // Custom system prompt
  preferredModel: string;
  settings: {
    webSearchEnabled: boolean;
    thinkingStepsVisible: boolean;
    knowledgeBaseWeight: number; // 0-1, how much to weight KB vs general knowledge
  };
}
```

### 2. Enhanced Messages Subcollection: `/chats/{chatId}/messages/{messageId}`
```typescript
interface EnhancedChatMessage {
  // Existing fields
  id: string;
  role: 'user' | 'assistant' | 'system' | 'collaborator';
  encryptedContent: string;
  timestamp: string;
  uid: string;
  attachments?: { storagePath: string; fileName: string; mimeType: string }[];
  isCode?: boolean;
  webSearchResults?: { url: string; title: string; snippet: string }[];
  
  // New fields for advanced features
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

interface ThinkingStep {
  id: string;
  stepType: 'analysis' | 'planning' | 'knowledge_query' | 'web_search' | 'reasoning' | 'synthesis';
  title: string;
  content: string;
  timestamp: string;
  duration?: number;
  metadata?: any;
}

interface KnowledgeBaseReference {
  documentId: string;
  documentTitle: string;
  relevanceScore: number;
  excerpt: string;
  pageNumber?: number;
  chunkId: string;
}
```

### 3. New Knowledge Base Collection: `/users/{userId}/knowledgeBase/{documentId}`
```typescript
interface KnowledgeBaseDocument {
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
```

### 4. New Document Chunks Subcollection: `/users/{userId}/knowledgeBase/{documentId}/chunks/{chunkId}`
```typescript
interface DocumentChunk {
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
```

### 5. New Conversation Memory Collection: `/chats/{chatId}/memory/{memoryId}`
```typescript
interface ConversationMemory {
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
```

### 6. New User Settings Collection: `/users/{userId}/settings/aiChat`
```typescript
interface UserAIChatSettings {
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
```

## Storage Structure

### Firebase Storage Paths
```
/users/{userId}/knowledgeBase/{documentId}/{fileName}
/users/{userId}/knowledgeBase/{documentId}/processed/{chunkId}.json
/chats/{chatId}/attachments/{messageId}/{fileName}
```

## Security Rules Updates

### Firestore Security Rules
```javascript
// Knowledge base documents - user can only access their own
match /users/{userId}/knowledgeBase/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}

// User settings - user can only access their own
match /users/{userId}/settings/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}

// Enhanced chat messages - maintain existing security
match /chats/{chatId}/messages/{messageId} {
  allow read, write: if request.auth != null && 
    request.auth.uid in resource.data.participants;
}

// Conversation memory - same as messages
match /chats/{chatId}/memory/{memoryId} {
  allow read, write: if request.auth != null && 
    request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
}
```

## Migration Strategy

1. **Phase 1**: Add new optional fields to existing collections
2. **Phase 2**: Create new collections for knowledge base and memory
3. **Phase 3**: Update client code to use new schema
4. **Phase 4**: Migrate existing data where applicable

## Implementation Notes

- All new fields are optional to maintain backward compatibility
- Encryption keys remain the same for existing encrypted content
- Knowledge base documents will be encrypted using the same user-specific encryption
- Vector embeddings will be stored in a separate vector database (Pinecone/Weaviate) referenced by ID
- LangGraph state will be serialized as JSON for persistence between steps
