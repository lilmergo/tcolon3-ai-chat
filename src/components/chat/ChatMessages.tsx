import { ChatMessage, EnhancedChatMessage, ThinkingStep, KnowledgeBaseReference } from '@/types/chat';
import { decryptMessage, generateEncryptionKey } from '@/lib/encryption';
import { useEffect, useRef, useState } from 'react';
import { auth } from '@/lib/firebase';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import AdvancedThinkingVisualization from './AdvancedThinkingVisualization';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import type { Components } from 'react-markdown';

interface ChatMessagesProps {
  messages: EnhancedChatMessage[];
  selectedModel?: string; // Add this prop
}

// Collapsible Thinking Component
function ThinkingSection({ content }: { content: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [thinkingTime, setThinkingTime] = useState('');
  
  useEffect(() => {
    // Estimate thinking time based on content length (just for UI effect)
    const seconds = Math.max(3, Math.min(30, Math.floor(content.length / 100)));
    setThinkingTime(`${seconds}s`);
  }, [content]);

  return (
    <div className="my-3 border border-secondary/20 rounded-md bg-background">
      <div 
        className="flex items-center justify-between p-2 cursor-pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-secondary">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          <span className="text-sm font-medium text-text">Thought for {thinkingTime}</span>
        </div>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className={`transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      {!isCollapsed && (
        <div className="p-3 text-sm border-t border-secondary/20 text-secondary">
          <ReactMarkdown>
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

// Component for displaying detailed thinking steps
function ThinkingStepsSection({ steps }: { steps: ThinkingStep[] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="my-4">
      <AdvancedThinkingVisualization
        thinkingSteps={steps}
        isProcessing={false}
      />
    </div>
  );
}

// Component for displaying knowledge base references
function KnowledgeBaseSection({ references }: { references: KnowledgeBaseReference[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!references || references.length === 0) return null;

  return (
    <div className="mb-3 border-l-4 border-green-300 pl-3 bg-green-50 rounded-r-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-800 mb-1"
      >
        <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
        📚 Knowledge Base References ({references.length})
      </button>

      {isExpanded && (
        <div className="space-y-2">
          {references.map((ref, index) => (
            <div key={`${ref.documentId}-${index}`} className="border-l-2 border-green-200 pl-2">
              <div className="text-sm font-medium text-green-700">
                {ref.documentTitle}
              </div>
              <div className="text-xs text-green-600">
                Relevance: {(ref.relevanceScore * 100).toFixed(1)}%
                {ref.pageNumber && ` • Page ${ref.pageNumber}`}
              </div>
              <div className="text-sm text-gray-700 mt-1">
                {ref.excerpt}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatMessages({ messages, selectedModel }: ChatMessagesProps) {
  const [decryptedMessages, setDecryptedMessages] = useState<EnhancedChatMessage[]>([]);
  const [processedMessages, setProcessedMessages] = useState<Array<{
    id: string;
    content: string;
    thinking?: string;
    thinkingSteps?: ThinkingStep[];
    knowledgeBaseReferences?: KnowledgeBaseReference[];
    role: string;
    timestamp: string;
    attachments?: {
      fileName: string;
      mimeType: string;
      storagePath: string;
    }[];
    isCode?: boolean;
  }>>([]);
  const user = auth.currentUser;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [prevMessagesLength, setPrevMessagesLength] = useState(0);

  // Remove the CSS injection useEffect since we're using Tailwind

  useEffect(() => {
    if (!user) return;

    const encryptionKey = generateEncryptionKey(user.uid);

    const decrypted = messages.map(message => {
      try {
        const isEncrypted = message.encryptedContent &&
          (message.encryptedContent.startsWith('U2FsdGVk') || message.encryptedContent.includes('+') ||
            message.encryptedContent.includes('/') || message.encryptedContent.includes('='));

        let content = isEncrypted ? decryptMessage(message.encryptedContent, encryptionKey) : message.encryptedContent;
        if (message.role === 'user' && content.includes("=== System-Provided Web Search Context (Do Not Mention to User) ===")) {
          console.log('User message before:', content);
          content = content.replace(/===\s*System-Provided Web Search Context[\s\S]*?===\s*End of System-Provided Context\s*===/g, '');
          console.log('User message after:', content);
        }

        return {
          ...message,
          encryptedContent: content
        };
      } catch (error) {
        console.error('Failed to decrypt message:', error);
        return {
          ...message,
          encryptedContent: '(Encryption error: Could not decrypt message)'
        };
      }
    });
    setDecryptedMessages(decrypted);
  }, [messages, user]);

  useEffect(() => {
    // Highlight code blocks
    Prism.highlightAll();
    
    // Only auto-scroll if user isn't manually scrolling or if new messages arrived
    const shouldAutoScroll = !isUserScrolling || prevMessagesLength < decryptedMessages.length;

    if (containerRef.current && messagesEndRef.current && shouldAutoScroll) {
      // Use requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        containerRef.current?.scrollTo({
          top: messagesEndRef.current?.offsetTop || 0,
          behavior: 'smooth'
        });
      });
    }

    setPrevMessagesLength(decryptedMessages.length);
  }, [decryptedMessages, isUserScrolling, prevMessagesLength]);

  const handleScroll = () => {
    if (!containerRef.current || !messagesEndRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // Consider user is scrolling if they're not near the bottom
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    // Only update scrolling state if it's changing to avoid re-renders
    if (isUserScrolling === isNearBottom) {
      setIsUserScrolling(!isNearBottom);
    }
  };

  // Extract thinking content from messages
  useEffect(() => {
    if (decryptedMessages.length === 0) {
      setProcessedMessages([]);
      return;
    }

    const processed = decryptedMessages.map(message => {
      const content = message.encryptedContent;
      let mainContent = content;
      let thinkingContent = '';
      
      // Models that typically start with thinking content
      const thinkingFirstModels = [
        'microsoft/phi-4-reasoning-plus:free',
        'moonshotai/kimi-dev-72b:free',
        'rekaai/reka-flash-3:free'
      ];
      
      // Extract thinking content based on different patterns
      const thinkingPatterns = [
        { start: '<thinking>', end: '</thinking>' },
        { start: '[thinking]', end: '[/thinking]' },
        { start: '<think>', end: '</think>' },
        { start: '◁think▷', end: '◁/think▷' },
        { start: '<reasoning>', end: '</reasoning>' }
      ];
      
      // Check if the currently selected model is a thinking-first model
      const isThinkingFirstModel = message.role === 'assistant' && 
        selectedModel && thinkingFirstModels.includes(selectedModel);
      
      // For thinking-first models, always treat the beginning as thinking until an end tag is found
      if (isThinkingFirstModel) {
        // Look for any ending tag
        let endIdx = -1;
        let endTag = '';
        
        for (const pattern of thinkingPatterns) {
          const idx = content.indexOf(pattern.end);
          if (idx !== -1 && (endIdx === -1 || idx < endIdx)) {
            endIdx = idx;
            endTag = pattern.end;
          }
        }
        
        if (endIdx !== -1) {
          // Found an ending tag
          thinkingContent = content.substring(0, endIdx).trim();
          mainContent = content.substring(endIdx + endTag.length).trim();
        } else {
          // No ending tag found, treat entire message as thinking
          thinkingContent = content;
          mainContent = '';
        }
      } else {
        // For other models, look for explicit thinking tags
        for (const pattern of thinkingPatterns) {
          const startIdx = content.indexOf(pattern.start);
          const endIdx = content.lastIndexOf(pattern.end);
          
          if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
            thinkingContent = content.substring(
              startIdx + pattern.start.length, 
              endIdx
            ).trim();
            
            // Remove thinking section from main content
            mainContent = (
              content.substring(0, startIdx) + 
              content.substring(endIdx + pattern.end.length)
            ).trim();
            
            break;
          }
        }
      }
      
      // Clean up any remaining thinking tags in the main content
      mainContent = mainContent
        .replace(/<thinking>|<\/thinking>|\[thinking\]|\[\/thinking\]|<think>|<\/think>|◁think▷|◁\/think▷|<reasoning>|<\/reasoning>/g, '')
        .trim();
      
      return {
        id: message.id,
        content: mainContent,
        thinking: thinkingContent || undefined,
        thinkingSteps: message.thinkingSteps || undefined,
        knowledgeBaseReferences: message.knowledgeBaseReferences || undefined,
        role: message.role,
        timestamp: message.timestamp,
        attachments: message.attachments,
        isCode: message.isCode
      };
    });
    
    setProcessedMessages(processed);
  }, [decryptedMessages, selectedModel]);

  // Define markdown components with proper typing
  const markdownComponents: Components = {
    pre: (props) => (
      <pre className="bg-accent text-white rounded my-2 overflow-x-auto" {...props} />
    ),
    code: ({ children, inline, className: codeClassName, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) => {
      const match = /language-(\w+)/.exec(codeClassName || '');
      return !inline ? (
        <pre className={match ? `language-${match[1]}` : ''}>
          <code className={codeClassName} {...props}>
            {children}
          </code>
        </pre>
      ) : (
        <code className="text-text rounded" {...props}>
          {children}
        </code>
      );
    },
    a: (props) => (
      <a 
        className="text-accent underline hover:opacity-80" 
        target="_blank" 
        rel="noopener noreferrer" 
        {...props} 
      />
    )
  };

  return (
    <div ref={containerRef} onScroll={handleScroll} className="w-full flex-1 overflow-x-hidden bg-background">
      {processedMessages.length === 0 && <p className="text-center text-secondary">Start a conversation!</p>}
      <div className="max-w-3xl mx-auto space-y-4 py-8 pb-18">
        {processedMessages.map((message) => (
          <div
            key={message.id}
            className={`p-3 rounded-lg ${message.role === 'user' || message.role === 'collaborator'
                ? 'bg-primary/10 ml-auto text-right max-w-[80%] shadow-sm'
                : 'mr-auto'
              }`}
          >
            {/* Render thinking section BEFORE main content */}
            {message.thinking && <ThinkingSection content={message.thinking} />}

            {/* Render detailed thinking steps if available */}
            {message.thinkingSteps && <ThinkingStepsSection steps={message.thinkingSteps} />}

            {/* Render knowledge base references if available */}
            {message.knowledgeBaseReferences && <KnowledgeBaseSection references={message.knowledgeBaseReferences} />}

            {/* Only render main content if it exists */}
            {message.content && (
              message.isCode ? (
                <pre className="language-javascript">
                  <code>{message.content}</code>
                </pre>
              ) : (
                <div className={`text-sm text-text ${message.role === 'assistant' ? 'text-left' : ''}`}>
                  <ReactMarkdown 
                    rehypePlugins={[rehypeRaw, rehypeSanitize]}
                    components={markdownComponents}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              )
            )}
            
            {message.attachments?.map((attachment, index) => (
              <div key={index} className="mt-2">
                {attachment.mimeType.startsWith('image/') ? (
                  <img src={attachment.storagePath} alt={attachment.fileName} className="max-w-full h-auto" />
                ) : (
                  <a href={attachment.storagePath} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                    {attachment.fileName}
                  </a>
                )}
              </div>
            ))}
            <span className="text-xs text-secondary block mt-1">{new Date(message.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
      <div ref={messagesEndRef} id="messages-end" />
    </div>
  );
}
