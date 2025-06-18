'use client';

import { useState } from 'react';
import { Chat } from '@/types/chat';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { PanelRight, Key, LogOut } from 'lucide-react';

interface ChatSidebarProps {
  chats: Chat[];
  currentChatId: string | null;
  onSelectChat: (chatId: string, tempChat?: Chat) => void;
}

export default function ChatSidebar({ chats, currentChatId, onSelectChat }: ChatSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const handleNewChat = () => {
    if (!auth.currentUser) return;
    // Generate a temporary ID for the new chat
    const tempId = `temp-${Date.now()}`;
    // Create a temporary chat object
    const tempChat = {
      id: tempId,
      title: 'New Chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: auth.currentUser.uid,
      participants: [auth.currentUser.uid],
      isCollaborative: false,
      isShared: false,
      shareToken: '',
      isTemporary: true // Flag to identify temporary chats
    };
    // Pass the temporary chat to the parent component
    onSelectChat(tempId, tempChat);
  };

  const handleSaveApiKey = () => {
    // Save API key to localStorage or state management
    localStorage.setItem('openrouter_api_key', apiKey);
    setShowApiKeyModal(false);
  };

  return (
    <>
      <div className={`${isCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 bg-primary/10 border-r border-secondary/20 p-4 flex flex-col relative h-screen`}>
        {/* Toggle button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-4 bg-primary text-light rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:opacity-80"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelRight size={16} />
        </button>
        
        {/* App title - show abbreviated version when collapsed */}
        {isCollapsed ? (
          <h1 className="text-2xl font-light text-primary text-center mb-4">T</h1>
        ) : (
          <h1 className="text-3xl font-light text-primary mb-4">T<span className='font-bold'>(:3)</span></h1>
        )}
        
        {/* New chat button */}
        <div className="mb-4">
          <button
            onClick={handleNewChat}
            className={`w-full p-2 py-1 bg-gradient-to-bl from-accent to-primary text-light rounded-lg hover:opacity-80 cursor-pointer ${isCollapsed ? 'flex justify-center' : ''}`}
            title="New Chat"
          >
            {isCollapsed ? '+' : 'New Chat'}
          </button>
        </div>
        
        {/* Chat list - only show when not collapsed */}
        {!isCollapsed && (
          <div className="flex-1 min-h-0 flex flex-col -mr-4">
            <div className="overflow-y-auto min-h-0 flex-1">
              {chats.length === 0 ? (
                <p className="text-secondary text-center p-4">No chats yet. Start a new conversation!</p>
              ) : (
                chats.map((chat) => {
                  if (chat.id.startsWith('temp-')) return null;
                  return <div
                    key={chat.id}
                    onClick={() => onSelectChat(chat.id)}
                    className={`p-2 rounded-lg text-text cursor-pointer ${chat.id === currentChatId
                      ? 'bg-primary/20'
                      : 'hover:bg-secondary/10'
                      }`}
                    title={chat.title}
                  >
                    <p className="text-sm font-medium">{chat.title}</p>
                  </div>;
                })
              )}
            </div>
          </div>
        )}
        
        {/* Bottom buttons */}
        <div className={`mt-auto flex ${isCollapsed ? 'flex-col items-center' : 'flex-col'} gap-2`}>         
          <button
            onClick={() => setShowApiKeyModal(true)}
            className={`w-full p-2 bg-primary/20 text-text rounded-lg hover:opacity-80 flex items-center justify-center gap-2 ${isCollapsed ? '' : ''}`}
            title="API Key"
          >
            <Key size={16} />
            {!isCollapsed && <span>API Key</span>}
          </button>
          
          <button
            onClick={() => signOut(auth)}
            className={`w-full p-2 bg-accent text-text rounded-lg hover:opacity-80 ${isCollapsed ? 'flex justify-center' : ''}`}
            title="Sign Out"
          >
            {isCollapsed ? <LogOut size={16} /> : 'Sign Out'}
          </button>
        </div>
      </div>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-primary">Set OpenRouter API Key</h2>
            <p className="text-sm text-secondary mb-4">
              Enter your OpenRouter API key to use your own account for model access.
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-..."
              className="w-full p-2 border border-secondary/20 rounded-lg mb-4 bg-background text-text"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="px-4 py-2 bg-secondary/20 text-text rounded-lg hover:opacity-80"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiKey}
                className="px-4 py-2 bg-gradient-to-bl from-accent to-primary text-light rounded-lg hover:opacity-80"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
