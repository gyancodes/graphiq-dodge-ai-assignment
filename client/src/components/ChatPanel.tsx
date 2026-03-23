import { useEffect, useRef } from 'react';
import { Cpu, Send, ShieldCheck } from 'lucide-react';
import type { Message } from '../types/app';
import { ChatMessage } from './ChatMessage';

interface ChatPanelProps {
  messages: Message[];
  suggestions: string[];
  input: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onSend: (messageText?: string) => void;
}

export function ChatPanel({
  messages,
  suggestions,
  input,
  loading,
  onInputChange,
  onSend,
}: ChatPanelProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header-top">
          <h2>
            <Cpu size={16} style={{ color: 'var(--accent-indigo)' }} />
            GraphIQ AI
          </h2>
          <span title="Guardrails Active">
            <ShieldCheck size={14} style={{ color: 'var(--accent-emerald)' }} />
          </span>
        </div>
        <p>Natural language analytics for Order-to-Cash data</p>
      </div>

      {suggestions.length > 0 && messages.length <= 1 && (
        <div className="suggestions">
          <div className="suggestions-title">Suggested Queries</div>
          <div className="suggestion-chips">
            {suggestions.slice(0, 6).map((suggestion, index) => (
              <button key={index} className="suggestion-chip" onClick={() => onSend(suggestion)}>
                {suggestion.length > 45 ? `${suggestion.slice(0, 42)}...` : suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="chat-messages">
        {messages.map((message, index) => (
          <ChatMessage key={`${message.role}-${message.timestamp}-${index}`} message={message} />
        ))}

        {loading && (
          <div className="message-group">
            <div className="message-avatar assistant">
              <Cpu size={14} />
            </div>
            <div className="message-content">
              <div className="message-sender">GraphIQ AI</div>
              <div className="thinking-indicator">
                <div className="thinking-dot" />
                <div className="thinking-dot" />
                <div className="thinking-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <div className="chat-footer">
        <div className="input-container">
          <textarea
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
            placeholder="Ask about sales orders, deliveries, billing..."
            rows={2}
          />
          <div className="input-footer">
            <div className="input-hint">
              <kbd>Enter</kbd> to send | <kbd>Shift+Enter</kbd> for new line
            </div>
            <button
              className={`send-button ${input.trim() && !loading ? 'active' : ''}`}
              onClick={() => onSend()}
              disabled={loading || !input.trim()}
            >
              <Send size={13} /> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
