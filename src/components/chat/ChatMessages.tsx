import { ChatMessage } from '@/types/chat';

interface ChatMessagesProps {
  messages: ChatMessage[];
}

export default function ChatMessages({ messages }: ChatMessagesProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
      {messages.length === 0 && (
        <p className="text-center text-gray-500">Start a conversation!</p>
      )}
      {messages.map((message) => (
        <div
          key={message.id}
          className={`p-3 rounded-lg max-w-[80%] ${
            message.role === 'user'
              ? 'bg-blue-100 ml-auto text-right'
              : 'bg-gray-200 mr-auto'
          } shadow-sm`}
        >
          <p className="text-sm">{message.content}</p>
          <span className="text-xs text-gray-500 block mt-1">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  );
}