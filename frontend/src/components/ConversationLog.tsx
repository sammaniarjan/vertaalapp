import { useEffect, useRef, type CSSProperties } from 'react';
import type { ConversationMessage } from '../types/messages';
import { MessageBubble } from './MessageBubble';

interface ConversationLogProps {
  messages: ConversationMessage[];
}

export function ConversationLog({ messages }: ConversationLogProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const containerStyle: CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    scrollBehavior: 'smooth',
  };

  const emptyStateStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '15px',
    padding: '20px',
    lineHeight: 1.6,
  };

  if (messages.length === 0) {
    return (
      <div style={containerStyle} ref={scrollContainerRef}>
        <div style={emptyStateStyle}>
          Start een gesprek door een knop ingedrukt te houden
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle} ref={scrollContainerRef}>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  );
}
