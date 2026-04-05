import type { ChatMessage } from '../../types/chat';

interface ChatBubbleProps {
  message: ChatMessage;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

/** Renders text with **bold** markdown as <strong> tags */
function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className={`text-sm whitespace-pre-wrap ${className ?? ''}`}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
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
          style={{ backgroundColor: '#2563EB' }}
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
            <RichText text={message.content} className="text-white" />
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
        style={{ backgroundColor: '#2563EB' }}
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
            <RichText text={message.content} className="text-text" />
          )}
        </div>
        <span className="text-xs mt-1" style={{ color: 'rgba(107, 114, 128, 0.6)' }}>
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
