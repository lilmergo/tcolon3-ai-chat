'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { OpenRouterModel } from '@/types/chat';

interface ChatInputProps {
  onSendMessage: (message: string, model: string, apiKey?: string) => void;
  isLoading: boolean;
}

export default function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const { data: models = [], error: modelError } = useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      const response = await axios.get<OpenRouterModel[]>('/api/models');
      return response.data;
    },
  });

  useEffect(() => {
    if (models.length > 0) {
      setSelectedModel(models[0].id);
    }
  }, [models]);

  useEffect(() => {
    if (modelError) {
      setError('Failed to load models: ' + (modelError instanceof Error ? modelError.message : 'Unknown error'));
    }
  }, [modelError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message, selectedModel, apiKey || undefined);
      setMessage('');
      setError('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <div className="mb-2">
        <label htmlFor="model" className="block text-sm font-medium">
          Select Model
        </label>
        <select
          id="model"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full p-2 border rounded"
          disabled={isLoading}
        >
          {models.map((model: OpenRouterModel) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-2">
        <label htmlFor="apiKey" className="block text-sm font-medium">
          OpenRouter API Key (Optional)
        </label>
        <input
          id="apiKey"
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your OpenRouter API key"
          className="w-full p-2 border rounded"
          disabled={isLoading}
        />
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 p-2 border rounded"
          disabled={isLoading}
        />
        <button
          type="submit"
          className={`px-4 py-2 text-white rounded ${
            isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
          }`}
          disabled={isLoading}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </form>
  );
}