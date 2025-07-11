'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import Link from 'next/link';
import ChatMessages from '@/components/chat/ChatMessages';
import ChatInput from '@/components/chat/ChatInput';
import ChatSidebar from '@/components/chat/ChatSidebar';
import KnowledgeBaseManager from '@/components/knowledge/KnowledgeBaseManager';
import { ChatMessage, Chat, EnhancedChatMessage } from '@/types/chat';
import { encryptMessage, decryptMessage, generateEncryptionKey } from '@/lib/encryption';
// import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const [messages, setMessages] = useState<EnhancedChatMessage[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(auth.currentUser);
  const [userChats, setUserChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [tempChat, setTempChat] = useState<Chat | null>(null);
  const [model, setModel] = useState<string>();
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (user) {
      const createOrUpdateUserProfile = async () => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            createdAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
          });
        } else {
          await updateDoc(userRef, { lastActive: new Date().toISOString() });
        }
      };
      createOrUpdateUserProfile();
      
      const chatsQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', user.uid),
        orderBy('updatedAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
        const chats: Chat[] = [];
        snapshot.forEach((doc) => chats.push({ id: doc.id, ...doc.data() } as Chat));
        
        // Merge with any temporary chats
        const mergedChats = [...chats];
        if (tempChat && !chats.some(chat => chat.id === tempChat.id)) {
          mergedChats.unshift(tempChat);
        }
        
        // Don't create a new chat automatically
        if (mergedChats.length > 0 && (!currentChatId || !mergedChats.find((c) => c.id === currentChatId))) {
          setCurrentChatId(mergedChats[0].id);
        }
        
        setUserChats(mergedChats);
        
        // Only query messages if we have a valid currentChatId and it's not a temporary chat
        if (currentChatId && (!tempChat || tempChat.id !== currentChatId)) {
          const messagesQuery = query(
            collection(db, 'chats', currentChatId, 'messages'),
            orderBy('timestamp', 'asc')
          );
          
          const messagesUnsubscribe = onSnapshot(messagesQuery, (messagesSnapshot) => {
            const fetchedMessages: EnhancedChatMessage[] = [];
            messagesSnapshot.forEach((doc) => {
              const data = doc.data();
              fetchedMessages.push({
                id: doc.id,
                role: data.role,
                encryptedContent: data.encryptedContent,
                timestamp: data.timestamp,
                uid: data.uid,
                attachments: data.attachments || [],
                isCode: data.isCode || false,
                webSearchResults: data.webSearchResults || [],
                // Enhanced fields for advanced features
                thinkingSteps: data.thinkingSteps || undefined,
                knowledgeBaseReferences: data.knowledgeBaseReferences || undefined,
                memoryContext: data.memoryContext || undefined,
                processingMetadata: data.processingMetadata || undefined,
              });
            });
            setMessages(fetchedMessages);
          }, (err) => setError('Failed to load messages: ' + err.message));
          
          return () => {
            messagesUnsubscribe();
          };
        } else {
          // Clear messages when no chat is selected or when it's a temporary chat
          setMessages([]);
        }
      });
      
      return () => {
        unsubscribe();
      };
    }
  }, [user, currentChatId, tempChat]);

  const handleSendMessage = useCallback(
    async (content: string, model: string, apiKey?: string, file?: File, enableWebSearch?: boolean, advancedThinking?: boolean, knowledgeBaseEnabled?: boolean) => {
      setModel(model);
      if (!user) return;
      setIsLoading(true);
      setError('');

      try {
        // Create a new chat if none exists or if current chat is temporary
        let chatId = currentChatId;
        let isNewChat = false;
        
        if (!chatId || (tempChat && tempChat.id === chatId)) {
          isNewChat = true;
          const newChat = {
            title: tempChat?.title || content.substring(0, 30) + (content.length > 30 ? '...' : ''),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: user.uid,
            participants: [user.uid],
            isCollaborative: false,
            isShared: false,
            shareToken: '',
          };
          const chatRef = await addDoc(collection(db, 'chats'), newChat);
          chatId = chatRef.id;
          setCurrentChatId(chatId);
          setTempChat(null); // Clear the temporary chat
          
          // If this is a new chat, update the local state immediately
          if (isNewChat) {
            setUserChats(prevChats => {
              // Remove the temporary chat if it exists
              const filteredChats = tempChat 
                ? prevChats.filter(chat => chat.id !== tempChat.id)
                : prevChats;
              
              // Add the new permanent chat
              return [
                { 
                  id: chatId, 
                  ...newChat 
                } as Chat,
                ...filteredChats
              ];
            });
          }
        }

        const encryptionKey = generateEncryptionKey(user.uid);
        const timestamp = new Date().toISOString();
        const attachments: { storagePath: string; fileName: string; mimeType: string }[] = [];
        let webSearchResults: { url: string; title: string; snippet: string }[] = [];
        const isCode = content.includes('```');

        if (file) {
          console.log('Uploading file:', file.name);
          const storagePath = `chats/${chatId}/${uuidv4()}-${file.name}`;
          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, file);
          console.log('upload completed');
          const downloadURL = await getDownloadURL(storageRef);
          console.log('File uploaded:', downloadURL);
          attachments.push({ storagePath, fileName: file.name, mimeType: file.type });
        }

        if (enableWebSearch) {
          try {
            const searchResponse = await fetch('/api/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: content }),
            });
            if (!searchResponse.ok) {
              throw new Error(`HTTP ${searchResponse.status}: ${await searchResponse.text()}`);
            }
            const { results, searchPerformed } = await searchResponse.json();
            webSearchResults = results || [];
            
            // Only add web search context if search was actually performed and returned results
            if (searchPerformed && webSearchResults.length > 0) {
              // Format web search results as a single string
              const formattedResults = webSearchResults.map((result, index) =>
                `[${index + 1}] ${result.title}\n${result.url}\n${result.snippet}`
              ).join('\n\n');

              // Create a single string for the system message
              content = content + `=== System-Provided Web Search Context (Do Not Mention to User) ===\n\n${formattedResults}\n\n=== End of Web Search Results ===\n\nPlease provide your response using the provided web search results as context if relevant. Cite sources where applicable.=== End of System-Provided Context ===`;
            }
          } catch (e) {
            console.error('Web search failed:', e);
            setError('Failed to fetch web search results');
          }
        }

        const userMessage: Omit<ChatMessage, 'id'> = {
          role: 'user',
          encryptedContent: encryptMessage(content, encryptionKey),
          timestamp,
          uid: user.uid,
          attachments,
          isCode,
          webSearchResults,
        };

        try {
          await addDoc(collection(db, 'chats', chatId, 'messages'), userMessage);
          await updateDoc(doc(db, 'chats', chatId), { updatedAt: timestamp });

          // Prepare conversation history for the API
          const conversationHistory = messages.map(msg => ({
            role: msg.role === 'collaborator' ? 'user' : msg.role, // Convert collaborator to user for API
            content: decryptMessage(msg.encryptedContent, encryptionKey)
          }));
          
          // Add the current user message and web search results
          const apiMessages = [
            ...conversationHistory,
            { role: 'user', content },
          ];

          // Use advanced chat API if advanced features are enabled
          const useAdvancedAPI = advancedThinking || knowledgeBaseEnabled;
          const apiEndpoint = useAdvancedAPI ? '/api/chat/advanced' : '/api/chat';

          let response;

          if (useAdvancedAPI) {
            // Get Firebase auth token
            const token = await user.getIdToken();

            // Use advanced chat API
            response = await fetch(apiEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                chatId,
                userId: user.uid,
                message: content,
                model,
                apiKey,
                advancedThinking,
                knowledgeBaseEnabled,
                webSearchEnabled: enableWebSearch,
              }),
            });
          } else {
            // Use regular chat API
            response = await fetch(apiEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model,
                messages: apiMessages,
                apiKey,
              }),
            });
          }

          if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);

          if (useAdvancedAPI) {
            // Handle advanced API streaming response
            console.log('Frontend: Starting advanced API streaming...');
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log('Frontend: Advanced API streaming completed');
                break;
              }

              const chunk = new TextDecoder().decode(value);
              console.log('Frontend: Received chunk:', chunk);
              buffer += chunk;

              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.trim() === '') continue;

                try {
                  const data = JSON.parse(line);

                  if (data.type === 'thinking_step') {
                    console.log('Frontend: Received thinking step:', data.step.title);
                    // The step is already being updated in Firebase by the backend
                    // The UI will automatically update via the Firebase listener
                  } else if (data.type === 'final_response') {
                    console.log('Frontend: Received final response');
                    // Final response is also handled by the backend Firebase update
                  }
                } catch (parseError) {
                  console.error('Frontend: Failed to parse streaming data:', parseError, line);
                }
              }
            }
          } else {
            // Handle regular streaming API response
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const assistantMessageRef = await addDoc(
              collection(db, 'chats', chatId, 'messages'),
              {
                role: 'assistant',
                encryptedContent: encryptMessage('', encryptionKey),
                timestamp: new Date().toISOString(),
                uid: 'assistant',
              }
            );

            let assistantContent = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = new TextDecoder().decode(value);
              console.log('new chunk:', chunk);
              assistantContent += chunk;
              await updateDoc(doc(db, 'chats', chatId, 'messages', assistantMessageRef.id), {
                encryptedContent: encryptMessage(assistantContent, encryptionKey),
              });
            }
            console.log('final assistant content:', assistantContent);
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          setError(
            errorMessage.includes('401')
              ? 'Invalid API key'
              : errorMessage.includes('400')
                ? 'Invalid request'
                : 'Error: ' + errorMessage
          );
        } finally {
          setIsLoading(false);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError('Error: ' + errorMessage);
        setIsLoading(false);
      }
    },
    [user, currentChatId, messages, tempChat]
  );

 /* const handleShareChat = async () => {
    if (!currentChatId) return;
    const shareToken = uuidv4();
    await updateDoc(doc(db, 'chats', currentChatId), { isShared: true, shareToken });
    const shareLink = `${window.location.origin}/share/${shareToken}`;
    navigator.clipboard.writeText(shareLink);
    alert('Share link copied to clipboard!');
  };*/

  const handleSelectChat = (chatId: string, tempChat?: Chat) => {
    if (chatId !== currentChatId) {
      setCurrentChatId(chatId);
      // Store the temporary chat if provided
      if (tempChat) {
        setTempChat(tempChat);
        // Add temporary chat to userChats if it's not already there
        if (!userChats.some(chat => chat.id === tempChat.id)) {
          setUserChats(prevChats => [tempChat, ...prevChats]);
        }
      } else {
        setTempChat(null);
      }
      // Clear messages to avoid showing previous chat messages while loading
      setMessages([]);
    }
  };

  return (
    <main className="flex min-h-screen bg-background">
      {user && (
        <>
          <ChatSidebar
            chats={userChats}
            currentChatId={currentChatId}
            onSelectChat={handleSelectChat}
            onOpenKnowledgeBase={() => setShowKnowledgeBase(true)}
          />

          {/* Knowledge Base Manager Modal */}
          <KnowledgeBaseManager
            isOpen={showKnowledgeBase}
            onClose={() => setShowKnowledgeBase(false)}
          />
          <div className="flex-1 flex flex-col">
            <section className="w-full h-[calc(100vh-64px)] flex flex-col items-center overflow-y-auto">
              {error && <p className="p-4 text-red-500">{error}</p>}
              {isLoading && <p className="p-4 text-secondary">Generating...</p>}
              <ChatMessages messages={messages} selectedModel={model} />
              <ChatInput
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                chatId={currentChatId || undefined}
                userId={user?.uid}
              />
            </section>
          </div>
        </>
      )}
      {!user && (
        <div className="w-full h-screen flex flex-col items-center justify-center p-4">
          <h1 className="text-3xl font-light text-primary mb-6">T<span className='font-bold'>:3</span> AI Chat</h1>
          <div className="flex gap-2">
            <Link href="/login" className="px-4 py-2 bg-primary text-light rounded-lg hover:opacity-80">
              Sign In
            </Link>
            <Link href="/signup" className="px-4 py-2 bg-accent text-light rounded-lg hover:opacity-80">
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}













