import type { CSSProperties } from 'react';

interface PushToTalkButtonProps {
  lang: 'nl' | 'ar';
  isRecording: boolean;
  isProcessing: boolean;
  disabled: boolean;
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerLeave: (e: React.PointerEvent) => void;
  };
}

const pulseKeyframes = `
@keyframes pulse-nl {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 107, 0, 0.5); }
  50% { box-shadow: 0 0 0 20px rgba(255, 107, 0, 0); }
}
@keyframes pulse-ar {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 137, 123, 0.5); }
  50% { box-shadow: 0 0 0 20px rgba(0, 137, 123, 0); }
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = pulseKeyframes;
  document.head.appendChild(style);
  stylesInjected = true;
}

export function PushToTalkButton({
  lang,
  isRecording,
  isProcessing,
  disabled,
  handlers,
}: PushToTalkButtonProps) {
  injectStyles();

  const color = lang === 'nl' ? 'var(--nl-color)' : 'var(--ar-color)';
  const rawColor = lang === 'nl' ? '#FF6B00' : '#00897B';
  const label = lang === 'nl' ? 'NL' : 'AR';
  const subtitle = lang === 'nl' ? 'Nederlands' : '\u0627\u0644\u0639\u0631\u0628\u064A\u0629';

  const wrapperStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  };

  const buttonStyle: CSSProperties = {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: `3px solid ${color}`,
    backgroundColor: isRecording
      ? rawColor
      : disabled
        ? 'var(--bg-tertiary)'
        : 'var(--bg-secondary)',
    color: isRecording ? '#fff' : disabled ? 'var(--text-secondary)' : color,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    transition: 'background-color 0.15s, transform 0.1s',
    transform: isRecording ? 'scale(1.05)' : 'scale(1)',
    animation: isRecording
      ? `pulse-${lang} 1.5s ease-in-out infinite`
      : 'none',
    opacity: disabled ? 0.5 : 1,
    touchAction: 'none',
    outline: 'none',
    position: 'relative',
  };

  const labelStyle: CSSProperties = {
    fontSize: '28px',
    fontWeight: 600,
    lineHeight: 1,
    letterSpacing: '1px',
  };

  const subtitleStyle: CSSProperties = {
    fontSize: '11px',
    fontWeight: 400,
    opacity: 0.8,
    fontFamily:
      lang === 'ar'
        ? "'Noto Sans Arabic', 'Inter', sans-serif"
        : "'Inter', sans-serif",
  };

  const hintStyle: CSSProperties = {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    maxWidth: '140px',
    lineHeight: 1.4,
  };

  const spinnerStyle: CSSProperties = {
    position: 'absolute',
    top: '-6px',
    left: '-6px',
    right: '-6px',
    bottom: '-6px',
    borderRadius: '50%',
    border: `3px solid transparent`,
    borderTopColor: color,
    animation: 'spin 0.8s linear infinite',
    pointerEvents: 'none',
  };

  return (
    <div style={wrapperStyle}>
      <button
        style={buttonStyle}
        disabled={disabled}
        onPointerDown={disabled ? undefined : handlers.onPointerDown}
        onPointerUp={disabled ? undefined : handlers.onPointerUp}
        onPointerLeave={disabled ? undefined : handlers.onPointerLeave}
        aria-label={`Push to talk ${lang === 'nl' ? 'Dutch' : 'Arabic'}`}
      >
        {isProcessing && <div style={spinnerStyle} />}
        <span style={labelStyle}>{label}</span>
        <span style={subtitleStyle}>{subtitle}</span>
      </button>
      <span style={hintStyle}>
        {isRecording
          ? 'Opnemen...'
          : isProcessing
            ? 'Verwerken...'
            : 'Houd ingedrukt om te spreken'}
      </span>
    </div>
  );
}
