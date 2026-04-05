import type { ChatMessage } from '../../types/chat';

interface ChatBubbleProps {
  message: ChatMessage;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span
        className="w-2 h-2 rounded-full bg-text-secondary/40 inline-block"
        style={{ animation: 'bounce-dot 1.4s infinite ease-in-out', animationDelay: '0s' }}
      />
      <span
        className="w-2 h-2 rounded-full bg-text-secondary/40 inline-block"
        style={{ animation: 'bounce-dot 1.4s infinite ease-in-out', animationDelay: '0.2s' }}
      />
      <span
        className="w-2 h-2 rounded-full bg-text-secondary/40 inline-block"
        style={{ animation: 'bounce-dot 1.4s infinite ease-in-out', animationDelay: '0.4s' }}
      />
    </div>
  );
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex flex-col items-end max-w-[80%] ml-auto">
        <div
          className="rounded-2xl rounded-br-md p-3"
          style={{ backgroundColor: '#E8961A' }}
        >
          {message.photo_url && (
            <img
              src={message.photo_url}
              alt="Foto adjunta"
              className="rounded-lg max-h-48 object-cover mb-2 w-full"
            />
          )}
          {message.loading ? (
            <LoadingDots />
          ) : (
            <p className="text-white text-sm whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
        <span className="text-xs mt-1" style={{ color: 'rgba(107, 114, 128, 0.6)' }}>
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 max-w-[80%] mr-auto">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mb-5"
        style={{ backgroundColor: '#E8961A' }}
      >
        <span className="text-white text-xs font-bold">H</span>
      </div>
      <div className="flex flex-col items-start">
        <div className="bg-white rounded-2xl rounded-bl-md p-3 shadow-sm">
          {message.photo_url && (
            <img
              src={message.photo_url}
              alt="Foto adjunta"
              className="rounded-lg max-h-48 object-cover mb-2 w-full"
            />
          )}
          {message.loading ? (
            <LoadingDots />
          ) : (
            <p className="text-text text-sm whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
        <span className="text-xs mt-1" style={{ color: 'rgba(107, 114, 128, 0.6)' }}>
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
