'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { OpenRouterModel } from '@/types/chat';
import ThemeToggle from '../ui/ThemeToggle';

interface ChatInputProps {
  onSendMessage: (message: string, model: string, apiKey?: string, file?: File, enableWebSearch?: boolean) => void;
  isLoading: boolean;
}

export default function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [error, setError] = useState('');
  const [enableWebSearch, setEnableWebSearch] = useState(false);

  const { data: models = [], error: modelError } = useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      const response = await axios.get<OpenRouterModel[]>('/api/models');
      return response.data.filter((model) => model.name.includes('(free)'));
    },
  });
  console.log('models', models);

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
      onSendMessage(message, selectedModel, apiKey, undefined, enableWebSearch);
      setMessage('');
      setError('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (message.trim() && !isLoading) {
        // Get API key from localStorage if available
        const apiKey = localStorage.getItem('openrouter_api_key') || undefined;
        onSendMessage(message, selectedModel, apiKey, undefined, enableWebSearch);
        setMessage('');
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
      
      {/* Bottom controls area with model dropdown and web search toggle */}
      <div className="flex items-center gap-4">
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
        
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={enableWebSearch}
            onChange={(e) => setEnableWebSearch(e.target.checked)}
            disabled={isLoading}
          />
          Enable Web Search (Experimental)
        </label>
        <span className='ml-auto'><ThemeToggle /></span>
      </div>
    </form>
  );
}
