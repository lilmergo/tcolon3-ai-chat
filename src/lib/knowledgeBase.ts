// Simplified knowledge base implementation
// LlamaIndex integration will be added later
import { adminDb, adminStorage } from './firebase-admin';
import { KnowledgeBaseDocument, DocumentChunk } from '@/types/chat';
import { encryptMessage, decryptMessage, generateEncryptionKey } from './encryption';
// PDF and document parsing will be implemented later
// import * as pdfParse from 'pdf-parse';
// import mammoth from 'mammoth';

// Configure LlamaIndex settings (commented out for now)
// Settings.llm = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY || '',
//   model: 'gpt-3.5-turbo',
// });

export class KnowledgeBaseManager {
  private userId: string;
  private encryptionKey: string;

  constructor(userId: string) {
    this.userId = userId;
    this.encryptionKey = generateEncryptionKey(userId);
  }

  /**
   * Upload and process a document for the knowledge base
   */
  async uploadDocument(file: File): Promise<string> {
    try {
      // Validate file
      this.validateFile(file);

      // Create document record
      const documentId = await this.createDocumentRecord(file);

      // Upload file to Firebase Storage
      const storagePath = await this.uploadFileToStorage(file, documentId);

      // Process the document
      await this.processDocument(documentId, file, storagePath);

      return documentId;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: File): void {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown'
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    // 50MB limit
    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File size exceeds 50MB limit');
    }
  }

  /**
   * Create initial document record in Firestore
   */
  private async createDocumentRecord(file: File): Promise<string> {
    const documentData: Omit<KnowledgeBaseDocument, 'id'> = {
      userId: this.userId,
      fileName: `${Date.now()}-${file.name}`,
      originalFileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      status: 'uploading',
      storagePath: '',
      processingMetadata: {
        totalChunks: 0,
        totalTokens: 0,
      },
      metadata: {
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        keywords: [],
      },
      indexMetadata: {
        indexId: '',
        vectorStoreId: '',
        embeddingModel: 'text-embedding-ada-002',
        lastIndexed: '',
      },
      tags: [],
      isActive: true,
    };

    const docRef = await adminDb
      .collection('users')
      .doc(this.userId)
      .collection('knowledgeBase')
      .add(documentData);

    return docRef.id;
  }

  /**
   * Upload file to Firebase Storage
   */
  private async uploadFileToStorage(file: File, documentId: string): Promise<string> {
    const storagePath = `users/${this.userId}/knowledgeBase/${documentId}/${file.name}`;
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(storagePath);

    // Convert File to Buffer for admin SDK
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
      },
    });

    // Update document record with storage path
    await adminDb
      .collection('users')
      .doc(this.userId)
      .collection('knowledgeBase')
      .doc(documentId)
      .update({ storagePath, status: 'processing' });

    return storagePath;
  }

  /**
   * Process document content and create embeddings
   */
  private async processDocument(documentId: string, file: File, storagePath: string): Promise<void> {
    try {
      // Update progress: Starting text extraction
      await this.updateProcessingProgress(documentId, 'extracting', 10);

      // Extract text content
      const textContent = await this.extractTextContent(file);

      // Update progress: Text extracted, starting chunking
      await this.updateProcessingProgress(documentId, 'chunking', 30);

      // Split into chunks and store
      const chunks = await this.createDocumentChunks(textContent, documentId);

      // Update progress: Chunks created, storing in database
      await this.updateProcessingProgress(documentId, 'storing', 70);

      // Store chunks in Firestore
      await this.storeDocumentChunks(documentId, chunks);
      
      // Update progress: Finalizing
      await this.updateProcessingProgress(documentId, 'finalizing', 90);

      // Update document record
      await adminDb
        .collection('users')
        .doc(this.userId)
        .collection('knowledgeBase')
        .doc(documentId)
        .update({
          status: 'ready',
          processedAt: new Date().toISOString(),
          'processingMetadata.totalChunks': chunks.length,
          'processingMetadata.totalTokens': chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
          'processingMetadata.progress': 100,
          'processingMetadata.stage': 'completed',
          'indexMetadata.indexId': documentId,
          'indexMetadata.lastIndexed': new Date().toISOString(),
        });

    } catch (error) {
      console.error('Error processing document:', error);
      
      // Update document status to error
      await adminDb
        .collection('users')
        .doc(this.userId)
        .collection('knowledgeBase')
        .doc(documentId)
        .update({
          status: 'error',
          'processingMetadata.errorMessage': error instanceof Error ? error.message : 'Unknown error',
        });
      
      throw error;
    }
  }

  /**
   * Update processing progress for real-time feedback
   */
  private async updateProcessingProgress(
    documentId: string,
    stage: 'extracting' | 'chunking' | 'storing' | 'finalizing',
    progress: number
  ): Promise<void> {
    await adminDb
      .collection('users')
      .doc(this.userId)
      .collection('knowledgeBase')
      .doc(documentId)
      .update({
        'processingMetadata.progress': progress,
        'processingMetadata.stage': stage,
        'processingMetadata.lastUpdated': new Date().toISOString(),
      });
  }

  /**
   * Extract text content from different file types
   */
  private async extractTextContent(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();

    switch (file.type) {
      case 'text/plain':
      case 'text/markdown':
        return new TextDecoder().decode(buffer);

      case 'application/pdf':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        // For now, return placeholder text for these file types
        // TODO: Implement proper PDF and DOCX parsing
        return `[${file.type} file: ${file.name}]\nContent extraction for this file type will be implemented in a future update.`;

      default:
        throw new Error(`Unsupported file type for text extraction: ${file.type}`);
    }
  }

  /**
   * Create document chunks for vector storage
   */
  private async createDocumentChunks(content: string, documentId: string): Promise<DocumentChunk[]> {
    const chunkSize = 1000; // characters
    const chunkOverlap = 200;
    const chunks: DocumentChunk[] = [];
    
    let startPosition = 0;
    let chunkIndex = 0;
    
    while (startPosition < content.length) {
      const endPosition = Math.min(startPosition + chunkSize, content.length);
      const chunkContent = content.slice(startPosition, endPosition);
      
      // Estimate token count (rough approximation: 1 token ≈ 4 characters)
      const tokenCount = Math.ceil(chunkContent.length / 4);
      
      const chunk: DocumentChunk = {
        id: `${documentId}-chunk-${chunkIndex}`,
        documentId,
        chunkIndex,
        content: encryptMessage(chunkContent, this.encryptionKey),
        tokenCount,
        startPosition,
        endPosition,
        embeddingMetadata: {
          model: 'text-embedding-ada-002',
          dimensions: 1536,
          createdAt: new Date().toISOString(),
        },
        previousChunkId: chunkIndex > 0 ? `${documentId}-chunk-${chunkIndex - 1}` : undefined,
        nextChunkId: endPosition < content.length ? `${documentId}-chunk-${chunkIndex + 1}` : undefined,
        metadata: {
          keywords: this.extractKeywords(chunkContent),
        },
      };
      
      chunks.push(chunk);
      
      // Move to next chunk with overlap
      startPosition = endPosition - chunkOverlap;
      chunkIndex++;
    }
    
    return chunks;
  }

  /**
   * Store document chunks in Firestore
   */
  private async storeDocumentChunks(documentId: string, chunks: DocumentChunk[]): Promise<void> {
    const batch = adminDb.batch();

    chunks.forEach(chunk => {
      const chunkRef = adminDb
        .collection('users')
        .doc(this.userId)
        .collection('knowledgeBase')
        .doc(documentId)
        .collection('chunks')
        .doc();
      batch.set(chunkRef, chunk);
    });

    await batch.commit();
  }

  /**
   * Extract keywords from text content
   */
  private extractKeywords(content: string): string[] {
    // Simple keyword extraction - can be enhanced with NLP libraries
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Get unique words and return top 10 most frequent
    const wordCount = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(wordCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Query knowledge base for relevant documents
   */
  async queryKnowledgeBase(query: string, limit: number = 5): Promise<KnowledgeBaseDocument[]> {
    // Get user's knowledge base documents
    const snapshot = await adminDb
      .collection('users')
      .doc(this.userId)
      .collection('knowledgeBase')
      .where('status', '==', 'ready')
      .where('isActive', '==', true)
      .orderBy('uploadedAt', 'desc')
      .get();

    const documents: KnowledgeBaseDocument[] = [];

    snapshot.forEach(doc => {
      documents.push({ id: doc.id, ...doc.data() } as KnowledgeBaseDocument);
    });
    
    // TODO: Implement semantic search using vector embeddings
    // For now, return simple text matching
    const relevantDocs = documents.filter(doc => 
      doc.metadata.title?.toLowerCase().includes(query.toLowerCase()) ||
      doc.metadata.keywords?.some(keyword => 
        keyword.toLowerCase().includes(query.toLowerCase())
      )
    );
    
    return relevantDocs.slice(0, limit);
  }

  /**
   * Delete a document from knowledge base
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      // Get document data
      const docRef = adminDb
        .collection('users')
        .doc(this.userId)
        .collection('knowledgeBase')
        .doc(documentId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        throw new Error('Document not found');
      }

      const docData = docSnap.data() as KnowledgeBaseDocument;

      // Delete from Firebase Storage
      if (docData.storagePath) {
        const bucket = adminStorage.bucket();
        const fileRef = bucket.file(docData.storagePath);
        await fileRef.delete();
      }

      // Delete chunks subcollection
      const chunksSnapshot = await adminDb
        .collection('users')
        .doc(this.userId)
        .collection('knowledgeBase')
        .doc(documentId)
        .collection('chunks')
        .get();

      const batch = adminDb.batch();
      chunksSnapshot.docs.forEach(chunkDoc => {
        batch.delete(chunkDoc.ref);
      });
      await batch.commit();

      // Delete document record
      await docRef.delete();
      
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Get all user's knowledge base documents
   */
  async getUserDocuments(): Promise<KnowledgeBaseDocument[]> {
    const snapshot = await adminDb
      .collection('users')
      .doc(this.userId)
      .collection('knowledgeBase')
      .orderBy('uploadedAt', 'desc')
      .get();

    const documents: KnowledgeBaseDocument[] = [];

    snapshot.forEach(doc => {
      documents.push({ id: doc.id, ...doc.data() } as KnowledgeBaseDocument);
    });

    return documents;
  }
}
