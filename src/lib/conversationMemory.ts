import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { OpenRouterLLM } from './openRouterLLM';
import { adminDb } from './firebase-admin';
import { ConversationMemory, ChatMessage } from '@/types/chat';
import { decryptMessage, generateEncryptionKey } from './encryption';

export class ConversationMemoryManager {
  private chatId: string;
  private userId: string;
  private memoryStrategy: 'simple' | 'summary' | 'vector';
  private maxTokens: number;
  private llm: OpenRouterLLM;
  private encryptionKey: string;

  constructor(
    chatId: string,
    userId: string,
    memoryStrategy: 'simple' | 'summary' | 'vector' = 'summary',
    maxTokens: number = 4000,
    apiKey?: string
  ) {
    this.chatId = chatId;
    this.userId = userId;
    this.memoryStrategy = memoryStrategy;
    this.maxTokens = maxTokens;
    this.encryptionKey = generateEncryptionKey(userId);

    this.llm = new OpenRouterLLM({
      apiKey: apiKey || process.env.OPENROUTER_API_KEY,
      modelName: 'meta-llama/llama-3.2-3b-instruct',
      temperature: 0,
    });
  }

  /**
   * Get conversation context for the current chat
   */
  async getConversationContext(messageLimit?: number): Promise<BaseMessage[]> {
    switch (this.memoryStrategy) {
      case 'simple':
        return this.getSimpleBufferContext(messageLimit);
      case 'summary':
        return this.getSummaryBufferContext();
      case 'vector':
        return this.getVectorContext();
      default:
        return this.getSimpleBufferContext(messageLimit);
    }
  }

  /**
   * Simple buffer memory - just return recent messages
   */
  private async getSimpleBufferContext(messageLimit: number = 20): Promise<BaseMessage[]> {
    const snapshot = await adminDb
      .collection('chats')
      .doc(this.chatId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(messageLimit)
      .get();

    const messages: BaseMessage[] = [];

    // Reverse to get chronological order
    const docs = snapshot.docs.reverse();
    
    for (const doc of docs) {
      const data = doc.data() as ChatMessage;
      const content = decryptMessage(data.encryptedContent, this.encryptionKey);
      
      if (data.role === 'user' || data.role === 'collaborator') {
        messages.push(new HumanMessage(content));
      } else if (data.role === 'assistant') {
        messages.push(new AIMessage(content));
      }
    }

    return messages;
  }

  /**
   * Summary buffer memory - maintain summaries of older conversations
   */
  private async getSummaryBufferContext(): Promise<BaseMessage[]> {
    // Get existing memory summaries using Admin SDK
    const memorySnapshot = await adminDb
      .collection('chats')
      .doc(this.chatId)
      .collection('memory')
      .where('type', '==', 'summary')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    const messages: BaseMessage[] = [];

    // Add summary if exists
    if (!memorySnapshot.empty) {
      const latestMemory = memorySnapshot.docs[0].data() as ConversationMemory;
      messages.push(new AIMessage(`Previous conversation summary: ${latestMemory.content}`));
    }

    // Get recent messages that aren't summarized yet
    const recentMessages = await this.getRecentUnsummarizedMessages();
    messages.push(...recentMessages);

    // Check if we need to create a new summary
    const totalTokens = this.estimateTokenCount(messages);
    if (totalTokens > this.maxTokens) {
      await this.createConversationSummary(recentMessages);
      // Return updated context after summarization
      return this.getSummaryBufferContext();
    }

    return messages;
  }

  /**
   * Get recent messages that haven't been summarized
   */
  private async getRecentUnsummarizedMessages(): Promise<BaseMessage[]> {
    // Get the latest memory to find where we left off
    const memorySnapshot = await adminDb
      .collection('chats')
      .doc(this.chatId)
      .collection('memory')
      .where('type', '==', 'summary')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    let startAfterMessageId = '';

    if (!memorySnapshot.empty) {
      const latestMemory = memorySnapshot.docs[0].data() as ConversationMemory;
      startAfterMessageId = latestMemory.messageRange.endMessageId;
    }

    // Get messages after the last summarized message
    const snapshot = await adminDb
      .collection('chats')
      .doc(this.chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .get();
    const messages: BaseMessage[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data() as ChatMessage;
      
      // Skip messages that are already summarized
      if (startAfterMessageId && doc.id <= startAfterMessageId) {
        continue;
      }

      const content = decryptMessage(data.encryptedContent, this.encryptionKey);
      
      if (data.role === 'user' || data.role === 'collaborator') {
        messages.push(new HumanMessage(content));
      } else if (data.role === 'assistant') {
        messages.push(new AIMessage(content));
      }
    }

    return messages;
  }

  /**
   * Create a conversation summary for older messages
   */
  private async createConversationSummary(messages: BaseMessage[]): Promise<void> {
    if (messages.length === 0) return;

    const conversationText = messages
      .map(msg => `${msg._getType()}: ${msg.content}`)
      .join('\n');

    const summaryPrompt = `
    Summarize the following conversation, preserving key information, decisions, and context that might be relevant for future messages:

    ${conversationText}

    Create a concise but comprehensive summary that maintains important details.
    `;

    const summaryResponse = await this.llm.invoke([new HumanMessage(summaryPrompt)]);
    const summary = summaryResponse.content as string;

    // Estimate token counts
    const originalTokens = this.estimateTokenCount(messages);
    const summaryTokens = this.estimateTokenCount([summaryResponse]);

    // Create memory record
    const memoryData: Omit<ConversationMemory, 'id'> = {
      chatId: this.chatId,
      type: 'summary',
      content: summary,
      tokenCount: summaryTokens,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageRange: {
        startMessageId: '', // Would need to track actual message IDs
        endMessageId: '',   // Would need to track actual message IDs
        messageCount: messages.length,
      },
      summaryMetadata: {
        compressionRatio: summaryTokens / originalTokens,
        originalTokenCount: originalTokens,
        summaryModel: 'gpt-3.5-turbo',
      },
    };

    await adminDb
      .collection('chats')
      .doc(this.chatId)
      .collection('memory')
      .add(memoryData);
  }

  /**
   * Vector memory - use semantic similarity for context retrieval
   */
  private async getVectorContext(): Promise<BaseMessage[]> {
    // This would require implementing vector storage and retrieval
    // For now, fall back to summary buffer
    return this.getSummaryBufferContext();
  }

  /**
   * Add a new message to the conversation context
   */
  async addMessage(message: BaseMessage): Promise<void> {
    // The message is already stored in Firestore by the main chat system
    // This method could be used for additional processing if needed
    
    // For vector memory, we might want to create embeddings here
    if (this.memoryStrategy === 'vector') {
      await this.createMessageEmbedding(message);
    }
  }

  /**
   * Create vector embedding for a message (placeholder)
   */
  private async createMessageEmbedding(message: BaseMessage): Promise<void> {
    // TODO: Implement vector embedding creation and storage
    // This would involve:
    // 1. Creating embeddings using OpenAI embeddings API
    // 2. Storing in a vector database (Pinecone, Weaviate, etc.)
    // 3. Updating the memory record with vector metadata
  }

  /**
   * Estimate token count for messages (rough approximation)
   */
  private estimateTokenCount(messages: BaseMessage[]): number {
    const totalChars = messages.reduce((sum, msg) => sum + (msg.content as string).length, 0);
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(totalChars / 4);
  }

  /**
   * Clear conversation memory
   */
  async clearMemory(): Promise<void> {
    const snapshot = await adminDb
      .collection('chats')
      .doc(this.chatId)
      .collection('memory')
      .get();

    const batch = adminDb.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(): Promise<{
    totalMemoryRecords: number;
    totalTokens: number;
    memoryStrategy: string;
    lastSummaryDate?: string;
  }> {
    const snapshot = await adminDb
      .collection('chats')
      .doc(this.chatId)
      .collection('memory')
      .get();
    
    let totalTokens = 0;
    let lastSummaryDate: string | undefined;

    snapshot.docs.forEach(doc => {
      const data = doc.data() as ConversationMemory;
      totalTokens += data.tokenCount;
      
      if (data.type === 'summary' && (!lastSummaryDate || data.createdAt > lastSummaryDate)) {
        lastSummaryDate = data.createdAt;
      }
    });

    return {
      totalMemoryRecords: snapshot.size,
      totalTokens,
      memoryStrategy: this.memoryStrategy,
      lastSummaryDate,
    };
  }

  /**
   * Update memory strategy
   */
  async updateMemoryStrategy(newStrategy: 'simple' | 'summary' | 'vector'): Promise<void> {
    this.memoryStrategy = newStrategy;
    
    // If switching to a more advanced strategy, might need to process existing messages
    if (newStrategy === 'summary' || newStrategy === 'vector') {
      // Could trigger background processing of existing conversation
    }
  }

  /**
   * Optimize memory by removing old summaries and creating new ones
   */
  async optimizeMemory(): Promise<void> {
    if (this.memoryStrategy !== 'summary') return;

    const snapshot = await adminDb
      .collection('chats')
      .doc(this.chatId)
      .collection('memory')
      .where('type', '==', 'summary')
      .orderBy('createdAt', 'asc')
      .get();
    
    // If we have more than 3 summaries, consolidate older ones
    if (snapshot.size > 3) {
      const oldSummaries = snapshot.docs.slice(0, -2); // Keep last 2
      const summaryTexts = oldSummaries.map(doc => (doc.data() as ConversationMemory).content);
      
      // Create a meta-summary
      const metaSummaryPrompt = `
      Create a consolidated summary from these conversation summaries:
      
      ${summaryTexts.join('\n\n---\n\n')}
      
      Preserve the most important information while reducing redundancy.
      `;

      const metaSummaryResponse = await this.llm.invoke([new HumanMessage(metaSummaryPrompt)]);
      
      // Delete old summaries
      const deletePromises = oldSummaries.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      
      // Create new consolidated summary
      const consolidatedMemory: Omit<ConversationMemory, 'id'> = {
        chatId: this.chatId,
        type: 'summary',
        content: metaSummaryResponse.content as string,
        tokenCount: this.estimateTokenCount([metaSummaryResponse]),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageRange: {
          startMessageId: '',
          endMessageId: '',
          messageCount: oldSummaries.reduce((sum, doc) => 
            sum + (doc.data() as ConversationMemory).messageRange.messageCount, 0
          ),
        },
        summaryMetadata: {
          compressionRatio: 0.1, // Highly compressed
          originalTokenCount: summaryTexts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0),
          summaryModel: 'gpt-3.5-turbo',
        },
      };

      await adminDb
        .collection('chats')
        .doc(this.chatId)
        .collection('memory')
        .add(consolidatedMemory);
    }
  }
}
