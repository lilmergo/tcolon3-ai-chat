'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { KnowledgeBaseDocument } from '@/types/chat';

interface KnowledgeBaseManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KnowledgeBaseManager({ isOpen, onClose }: KnowledgeBaseManagerProps) {
  const [documents, setDocuments] = useState<KnowledgeBaseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [error, setError] = useState('');
  const user = auth.currentUser;

  useEffect(() => {
    if (isOpen && user) {
      fetchDocuments();
    }
  }, [isOpen, user]);

  const fetchDocuments = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/knowledge-base', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Failed to load knowledge base documents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !user) return;

    for (const file of Array.from(files)) {
      const fileId = `${Date.now()}-${file.name}`;
      setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));

      try {
        const token = await user.getIdToken();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', user.uid);

        const response = await fetch('/api/knowledge-base', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const result = await response.json();
        setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));
        
        // Refresh the documents list
        await fetchDocuments();
        
        // Remove progress indicator after a delay
        setTimeout(() => {
          setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileId];
            return newProgress;
          });
        }, 2000);

      } catch (error) {
        console.error('Upload error:', error);
        setError(`Failed to upload ${file.name}`);
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      }
    }

    // Reset the input
    event.target.value = '';
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!user || !confirm('Are you sure you want to delete this document?')) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/knowledge-base?documentId=${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      // Refresh the documents list
      await fetchDocuments();
    } catch (error) {
      console.error('Delete error:', error);
      setError('Failed to delete document');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'ready': return 'text-green-600 bg-green-100';
      case 'processing': return 'text-yellow-600 bg-yellow-100';
      case 'uploading': return 'text-blue-600 bg-blue-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-x-hidden overflow-y-visible">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-secondary/20">
          <h2 className="text-xl font-semibold text-text">Knowledge Base Manager</h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-text transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-120px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
              {error}
              <button
                onClick={() => setError('')}
                className="ml-2 text-red-500 hover:text-red-700"
              >
                ✕
              </button>
            </div>
          )}

          {/* Upload Area */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-text mb-2">
              Upload Documents
            </label>
            <div className="border-2 border-dashed border-secondary/30 rounded-lg p-6 text-center">
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.md"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
              >
                📁 Choose Files
              </label>
              <p className="mt-2 text-sm text-secondary">
                Supported formats: PDF, DOCX, DOC, TXT, MD (Max 50MB each)
              </p>
            </div>

            {/* Upload Progress */}
            {Object.entries(uploadProgress).length > 0 && (
              <div className="mt-4 space-y-2">
                {Object.entries(uploadProgress).map(([fileId, progress]) => (
                  <div key={fileId} className="bg-secondary/10 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-text">Uploading...</span>
                      <span className="text-sm text-secondary">{progress}%</span>
                    </div>
                    <div className="w-full bg-secondary/20 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents List */}
          <div>
            <h3 className="text-lg font-medium text-text mb-4">
              Your Documents ({documents.length})
            </h3>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-secondary">Loading documents...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-secondary">
                <p>No documents uploaded yet.</p>
                <p className="text-sm mt-1">Upload your first document to get started!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="border border-secondary/20 rounded-lg p-4 hover:bg-secondary/5 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-text">{doc.metadata.title || doc.originalFileName}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                            {doc.status}
                          </span>
                        </div>
                        
                        <div className="text-sm text-secondary space-y-1">
                          <p>File: {doc.originalFileName}</p>
                          <p>Size: {formatFileSize(doc.fileSize)}</p>
                          <p>Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}</p>

                          {/* Processing Progress */}
                          {doc.status === 'processing' && doc.processingMetadata.progress !== undefined && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-blue-600 font-medium">
                                  {doc.processingMetadata.stage || 'Processing'}...
                                </span>
                                <span className="text-xs text-blue-600">
                                  {doc.processingMetadata.progress}%
                                </span>
                              </div>
                              <div className="w-full bg-blue-100 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${doc.processingMetadata.progress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {doc.processingMetadata.totalChunks > 0 && (
                            <p>Chunks: {doc.processingMetadata.totalChunks} • Tokens: {doc.processingMetadata.totalTokens}</p>
                          )}
                          {doc.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {doc.tags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-1 bg-accent/10 text-accent rounded text-xs"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="ml-4 text-red-500 hover:text-red-700 transition-colors"
                        title="Delete document"
                      >
                        🗑️
                      </button>
                    </div>

                    {doc.status === 'error' && doc.processingMetadata.errorMessage && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        Error: {doc.processingMetadata.errorMessage}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-secondary/20 bg-secondary/5">
          <div className="text-sm text-secondary">
            Total documents: {documents.filter(d => d.status === 'ready').length} ready, {documents.filter(d => d.status === 'processing').length} processing
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-secondary text-text rounded-lg hover:bg-secondary/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
