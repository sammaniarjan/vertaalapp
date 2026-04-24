import type { CSSProperties } from 'react';
import type { ConversationMessage } from '../types/messages';

interface MessageBubbleProps {
  message: ConversationMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isArabicSource = message.source_lang === 'ar';
  const borderColor =
    message.source_lang === 'nl' ? 'var(--nl-color)' : 'var(--ar-color)';

  const isInterim = message.is_interim;

  const containerStyle: CSSProperties = {
    padding: '12px 16px',
    marginBottom: '12px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '8px',
    borderLeft: isArabicSource ? 'none' : `4px solid ${borderColor}`,
    borderRight: isArabicSource ? `4px solid ${borderColor}` : 'none',
    opacity: isInterim ? 0.7 : 1,
    transition: 'opacity 0.2s',
  };

  const originalStyle: CSSProperties = {
    fontSize: '15px',
    lineHeight: 1.6,
    color: 'var(--text-primary)',
    marginBottom: message.translated_text ? '8px' : 0,
    direction: isArabicSource ? 'rtl' : 'ltr',
    textAlign: isArabicSource ? 'right' : 'left',
    fontFamily: isArabicSource
      ? "'Noto Sans Arabic', 'Inter', sans-serif"
      : "'Inter', sans-serif",
  };

  const translatedStyle: CSSProperties = {
    fontSize: '15px',
    lineHeight: 1.6,
    color: 'var(--text-primary)',
    paddingTop: '8px',
    borderTop: '1px solid var(--border-color)',
    direction: isArabicSource ? 'ltr' : 'rtl',
    textAlign: isArabicSource ? 'left' : 'right',
    fontFamily: isArabicSource
      ? "'Inter', sans-serif"
      : "'Noto Sans Arabic', 'Inter', sans-serif",
  };

  const metaStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
  };

  const langBadgeStyle: CSSProperties = {
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: '3px',
    backgroundColor: borderColor,
    color: '#fff',
    fontSize: '10px',
    fontWeight: 600,
    marginRight: '8px',
    letterSpacing: '0.5px',
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div style={containerStyle}>
      <div style={originalStyle}>
        <span style={langBadgeStyle}>
          {message.source_lang.toUpperCase()}
        </span>
        {message.original_text}
      </div>
      {message.translated_text && (
        <div style={translatedStyle}>{message.translated_text}</div>
      )}
      <div style={metaStyle}>
        <span>{formatTime(message.timestamp)}</span>
        {message.processing_time_ms !== undefined && (
          <span>{message.processing_time_ms}ms</span>
        )}
      </div>
    </div>
  );
}
