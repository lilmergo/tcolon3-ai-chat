'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { OpenRouterModel } from '@/types/chat';
import ThemeToggle from '../ui/ThemeToggle';

interface ChatInputProps {
  onSendMessage: (message: string, model: string, apiKey?: string, file?: File, enableWebSearch?: boolean, advancedThinking?: boolean, knowledgeBaseEnabled?: boolean) => void;
  isLoading: boolean;
  chatId?: string;
  userId?: string;
}

export default function ChatInput({ onSendMessage, isLoading, chatId, userId }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [error, setError] = useState('');
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [advancedThinking, setAdvancedThinking] = useState(false);
  const [knowledgeBaseEnabled, setKnowledgeBaseEnabled] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const { data: models = [], error: modelError } = useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      const response = await axios.get<OpenRouterModel[]>('/api/models');
      return response.data.filter((model) => model.name.includes('(free)'));
    },
  });

  useEffect(() => {
    if (models.length > 0) setSelectedModel(models[0].id);
  }, [models]);

  useEffect(() => {
    if (modelError) setError('Failed to load models: ' + (modelError instanceof Error ? modelError.message : 'Unknown error'));
  }, [modelError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      // Get API key from localStorage if available
      const apiKey = localStorage.getItem('openrouter_api_key') || undefined;
      onSendMessage(message, selectedModel, apiKey, selectedFile || undefined, enableWebSearch, advancedThinking, knowledgeBaseEnabled);
      setMessage('');
      setSelectedFile(null);
      setError('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (message.trim() && !isLoading) {
        // Get API key from localStorage if available
        const apiKey = localStorage.getItem('openrouter_api_key') || undefined;
        onSendMessage(message, selectedModel, apiKey, selectedFile || undefined, enableWebSearch, advancedThinking, knowledgeBaseEnabled);
        setMessage('');
        setSelectedFile(null);
        setError('');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="fixed w-3xl max-w-3xl bottom-0 align-center p-4 text-text bg-background">
      {error && <p className="text-red-500 mb-2">{error}</p>}
      
      {/* Main input area with message and send button */}
      <div className="flex gap-2 mb-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          className="flex-1 p-2 border rounded-lg focus:ring-primary h-12 resize-none bg-background text-text"
          disabled={isLoading}
        />
        <button
          type="submit"
          className={`px-4 rounded-lg ${
            isLoading 
              ? 'bg-secondary cursor-not-allowed' 
              : 'bg-gradient-to-bl from-accent to-primary hover:opacity-80 text-light'
          }`}
          disabled={isLoading}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
      
      {/* File upload area */}
      {selectedFile && (
        <div className="mb-2 p-2 bg-secondary/20 rounded-lg flex items-center justify-between">
          <span className="text-sm text-text">📎 {selectedFile.name}</span>
          <button
            type="button"
            onClick={() => setSelectedFile(null)}
            className="text-red-500 hover:text-red-700 text-sm"
          >
            Remove
          </button>
        </div>
      )}

      {/* Bottom controls area */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-48">
          <select
            id="model"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full p-1 border rounded-lg focus:ring-blue-500 text-sm"
            disabled={isLoading}
          >
            {models.map((model: OpenRouterModel) => {
              // Format display name: remove "(free)" and add reasoning label for thinking models
              const displayName = model.name.replace(/\s*\(free\)\s*/g, '');

              // Check if this is a thinking model
              const isThinkingModel = [
                'microsoft/phi-4-reasoning-plus:free',
                'moonshotai/kimi-dev-72b:free',
                'rekaai/reka-flash-3:free'
              ].includes(model.id);

              // Add reasoning label for thinking models
              const finalDisplayName = isThinkingModel
                ? `${displayName} (Experimental reasoning)`
                : displayName;

              return (
                <option key={model.id} value={model.id}>{finalDisplayName}</option>
              );
            })}
          </select>
        </div>

        {/* File upload button */}
        <label className="cursor-pointer">
          <input
            type="file"
            onChange={handleFileSelect}
            accept=".pdf,.docx,.doc,.txt,.md"
            className="hidden"
            disabled={isLoading}
          />
          <span className="px-3 py-1 bg-secondary text-text rounded-lg hover:bg-secondary/80 text-sm">
            📎 Attach
          </span>
        </label>

        {/* Advanced options toggle */}
        <button
          type="button"
          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
          className="px-3 py-1 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 text-sm"
        >
          ⚙️ Advanced
        </button>

        <span className='ml-auto'><ThemeToggle /></span>
      </div>

      {/* Advanced options panel */}
      {showAdvancedOptions && (
        <div className="mt-2 p-3 bg-secondary/10 rounded-lg border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={advancedThinking}
                onChange={(e) => setAdvancedThinking(e.target.checked)}
                disabled={isLoading}
              />
              🧠 Advanced Thinking Mode
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={knowledgeBaseEnabled}
                onChange={(e) => setKnowledgeBaseEnabled(e.target.checked)}
                disabled={isLoading}
              />
              📚 Use Knowledge Base
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enableWebSearch}
                onChange={(e) => setEnableWebSearch(e.target.checked)}
                disabled={isLoading}
              />
              🌐 Web Search
            </label>
          </div>

          <div className="mt-2 text-xs text-secondary">
            <p>• Advanced Thinking: Uses LangGraph for step-by-step reasoning</p>
            <p>• Knowledge Base: Searches your uploaded documents</p>
            <p>• Web Search: Finds current information online</p>
          </div>
        </div>
      )}
    </form>
  );
}
