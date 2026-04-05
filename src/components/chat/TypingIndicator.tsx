export default function TypingIndicator() {
  return (
    <div className="flex flex-col items-start gap-1 max-w-[80%] mr-auto">
      <div className="flex items-end gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#2563EB' }}
        >
          <span className="text-white text-xs font-bold">H</span>
        </div>
        <div className="bg-white rounded-2xl rounded-bl-md p-3 shadow-sm">
          <div className="flex items-center gap-1 py-1">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{
                backgroundColor: '#6B7280',
                opacity: 0.5,
                animation: 'bounce-dot 1.4s infinite ease-in-out',
                animationDelay: '0s',
              }}
            />
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{
                backgroundColor: '#6B7280',
                opacity: 0.5,
                animation: 'bounce-dot 1.4s infinite ease-in-out',
                animationDelay: '0.2s',
              }}
            />
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{
                backgroundColor: '#6B7280',
                opacity: 0.5,
                animation: 'bounce-dot 1.4s infinite ease-in-out',
                animationDelay: '0.4s',
              }}
            />
          </div>
        </div>
      </div>
      <p className="text-xs ml-8" style={{ color: '#6B7280' }}>
        Hermes está analizando...
      </p>
    </div>
  );
}
