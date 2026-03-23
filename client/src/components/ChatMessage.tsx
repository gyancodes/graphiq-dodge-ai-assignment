import ReactMarkdown from 'react-markdown';
import { Cpu, ShieldCheck, Terminal, User as UserIcon } from 'lucide-react';
import type { Message } from '../types/app';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const resultRows = message.result || [];
  const firstRow = resultRows[0];

  return (
    <div className="message-group">
      <div className={`message-avatar ${message.role}`}>
        {message.role === 'user' ? <UserIcon size={14} /> : <Cpu size={14} />}
      </div>

      <div className="message-content">
        <div className="message-sender">
          {message.role === 'user' ? 'You' : 'GraphIQ AI'}
          <span className="timestamp">{message.timestamp}</span>
        </div>

        {message.guardrailTriggered && (
          <div className="guardrail-badge">
            <ShieldCheck size={11} /> Guardrail
          </div>
        )}

        <div className={`message-text ${message.role === 'user' ? 'user-msg' : ''}`}>
          {message.role === 'assistant' ? <ReactMarkdown>{message.content}</ReactMarkdown> : message.content}
        </div>

        {message.sql && (
          <details className="sql-block">
            <summary className="sql-block-header sql-block-toggle">
              <div className="sql-tag">
                <Terminal size={11} /> Show generated SQL
              </div>
            </summary>
            <div className="sql-block-body">
              <code>{message.sql}</code>
            </div>
          </details>
        )}

        {firstRow && (
          <div className="result-table-wrapper">
            <div className="result-table-header">
              <span>Query Results</span>
              <span>{message.totalRows || resultRows.length} rows</span>
            </div>
            <div className="result-table-container">
              <table className="result-table">
                <thead>
                  <tr>
                    {Object.keys(firstRow).map((key) => (
                      <th key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultRows.slice(0, 5).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {Object.values(row).map((value, cellIndex) => (
                        <td key={cellIndex}>{value !== null ? String(value) : '-'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {resultRows.length > 5 && (
                <div className="result-more">
                  + {resultRows.length - 5} more rows
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
