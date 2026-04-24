import { useEffect, useRef, type CSSProperties } from 'react';
import type { ConversationMessage } from '../types/messages';

export interface LangInfo {
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
}

interface SpeakerPanelProps {
  side: 'left' | 'right';
  lang: LangInfo;
  otherLang: LangInfo;
  keyHint: string;
  messages: ConversationMessage[];
  isRecording: boolean;
  isProcessing: boolean;
  disabled: boolean;
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerLeave: (e: React.PointerEvent) => void;
  };
}

export function SpeakerPanel({
  side,
  lang,
  otherLang,
  keyHint,
  messages,
  isRecording,
  isProcessing,
  disabled,
  handlers,
}: SpeakerPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isLeft = side === 'left';
  const accent = isLeft ? 'var(--accent)' : 'var(--teal)';

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const panelStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    height: '100%',
    backgroundColor: 'var(--bg)',
    overflow: 'hidden',
  };

  const headerStyle: CSSProperties = {
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  };

  const titleStyle: CSSProperties = {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '15px',
    fontWeight: 700,
    color: accent,
    letterSpacing: '-0.3px',
  };

  const titleDotStyle: CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '9999px',
    backgroundColor: accent,
    opacity: 0.5,
  };

  const messagesStyle: CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 20px 20px',
    scrollBehavior: 'smooth',
  };

  const emptyStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '32px',
  };

  const instructionCardStyle: CSSProperties = {
    backgroundColor: 'var(--bg)',
    boxShadow: 'var(--shadow-extruded)',
    borderRadius: '24px',
    padding: '32px 28px',
    maxWidth: '300px',
    textAlign: lang.rtl ? 'right' : 'left',
    direction: lang.rtl ? 'rtl' : 'ltr',
  };

  const instructionTitleStyle: CSSProperties = {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '20px',
    fontWeight: 800,
    color: 'var(--fg)',
    marginBottom: '14px',
    letterSpacing: '-0.5px',
  };

  const instructionTextStyle: CSSProperties = {
    fontSize: '14px',
    lineHeight: 1.8,
    fontWeight: 400,
    color: 'var(--muted)',
    fontFamily: lang.rtl
      ? "'Noto Sans Arabic', 'DM Sans', sans-serif"
      : "'DM Sans', sans-serif",
  };

  const kbdInlineStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '8px',
    backgroundColor: 'var(--bg)',
    boxShadow: 'var(--shadow-extruded-sm)',
    fontSize: '12px',
    fontWeight: 700,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: accent,
    verticalAlign: 'middle',
    marginLeft: '2px',
    marginRight: '2px',
  };

  const footerStyle: CSSProperties = {
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'center',
  };

  const buttonStyle: CSSProperties = {
    width: '100%',
    maxWidth: '320px',
    padding: '16px 24px',
    borderRadius: '16px',
    border: 'none',
    backgroundColor: isRecording ? accent : 'var(--bg)',
    color: isRecording ? '#fff' : 'var(--fg)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.2s ease-out',
    transform: isRecording ? 'translateY(1px)' : 'translateY(0)',
    boxShadow: isRecording
      ? 'inset 6px 6px 10px rgba(0,0,0,0.2), inset -6px -6px 10px rgba(255,255,255,0.1)'
      : disabled
        ? 'var(--shadow-extruded-sm)'
        : 'var(--shadow-extruded)',
    opacity: disabled ? 0.5 : 1,
    touchAction: 'none',
    outline: 'none',
    direction: 'ltr',
  };

  const kbdStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '10px',
    backgroundColor: isRecording ? 'rgba(255,255,255,0.2)' : 'var(--bg)',
    boxShadow: isRecording ? 'none' : 'var(--shadow-inset-sm)',
    fontSize: '13px',
    fontWeight: 700,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: isRecording ? '#fff' : accent,
    flexShrink: 0,
  };

  const dotsStyle: CSSProperties = {
    display: 'inline-flex',
    gap: '6px',
    alignItems: 'center',
  };

  const dotBase: CSSProperties = {
    width: '7px',
    height: '7px',
    borderRadius: '9999px',
    backgroundColor: isRecording ? '#fff' : accent,
  };

  // Instruction text based on whether the lang is RTL or not
  const getInstructionTitle = () => {
    if (lang.code === 'nl') return 'Welkom';
    if (lang.code === 'ar') return 'مرحبًا';
    if (lang.code === 'tr') return 'Hoş geldiniz';
    if (lang.code === 'fr') return 'Bienvenue';
    if (lang.code === 'de') return 'Willkommen';
    if (lang.code === 'fa') return 'خوش آمدید';
    if (lang.code === 'so') return 'Soo dhawoow';
    if (lang.code === 'ti') return 'እንቋዕ ብደሓን';
    return 'Welcome';
  };

  const getButtonLabel = () => {
    if (isRecording) {
      if (lang.code === 'nl') return 'Opnemen...';
      if (lang.code === 'ar') return 'تسجيل...';
      if (lang.code === 'tr') return 'Kaydediliyor...';
      if (lang.code === 'fa') return 'ضبط...';
      if (lang.code === 'so') return 'Duubayo...';
      return 'Recording...';
    }
    if (lang.code === 'nl') return 'Houd ingedrukt om te spreken';
    if (lang.code === 'ar') return 'اضغط مع الاستمرار للتحدث';
    if (lang.code === 'tr') return 'Konuşmak için basılı tutun';
    if (lang.code === 'fa') return 'برای صحبت نگه دارید';
    if (lang.code === 'so') return 'Ku hay si aad u hadashid';
    return 'Hold to speak';
  };

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={titleDotStyle} />
        <span style={titleStyle}>
          {lang.nativeName}
        </span>
      </div>

      <div style={messagesStyle} ref={scrollRef}>
        {messages.length === 0 ? (
          <div style={emptyStyle}>
            <div style={instructionCardStyle}>
              <div style={instructionTitleStyle}>
                {getInstructionTitle()}
              </div>
              <div style={instructionTextStyle}>
                {lang.code === 'nl' ? (
                  <>
                    Houd toets <span style={kbdInlineStyle}>{keyHint}</span> ingedrukt
                    of druk op de knop hieronder om te spreken.
                    <br /><br />
                    Uw spraak wordt vertaald naar het {otherLang.name}.
                  </>
                ) : lang.code === 'ar' ? (
                  <>
                    اضغط مع الاستمرار على مفتاح <span style={kbdInlineStyle}>{keyHint}</span> أو اضغط على الزر أدناه للتحدث.
                    <br /><br />
                    سيتم ترجمة كلامك إلى {otherLang.nativeName}.
                  </>
                ) : lang.code === 'tr' ? (
                  <>
                    Konuşmak için <span style={kbdInlineStyle}>{keyHint}</span> tuşunu basılı tutun
                    veya aşağıdaki düğmeye basın.
                    <br /><br />
                    Konuşmanız {otherLang.nativeName} diline çevrilecektir.
                  </>
                ) : (
                  <>
                    Hold key <span style={kbdInlineStyle}>{keyHint}</span> or press the
                    button below to speak.
                    <br /><br />
                    Your speech will be translated to {otherLang.nativeName}.
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <SpeakerMessage
              key={msg.id}
              message={msg}
              perspectiveLang={lang.code}
              perspectiveRtl={lang.rtl}
              isLatest={idx === messages.length - 1}
            />
          ))
        )}
      </div>

      <div style={footerStyle}>
        <button
          style={buttonStyle}
          disabled={disabled}
          onPointerDown={disabled ? undefined : handlers.onPointerDown}
          onPointerUp={disabled ? undefined : handlers.onPointerUp}
          onPointerLeave={disabled ? undefined : handlers.onPointerLeave}
          aria-label={`Push to talk ${lang.name}`}
        >
          <span style={kbdStyle}>{keyHint}</span>
          {isProcessing ? (
            <span style={dotsStyle}>
              <span style={{ ...dotBase, animation: 'dotPulse 1.2s ease-out infinite' }} />
              <span style={{ ...dotBase, animation: 'dotPulse 1.2s ease-out 0.2s infinite' }} />
              <span style={{ ...dotBase, animation: 'dotPulse 1.2s ease-out 0.4s infinite' }} />
            </span>
          ) : (
            <span style={{
              fontFamily: lang.rtl
                ? "'Noto Sans Arabic', 'DM Sans', sans-serif"
                : "'DM Sans', sans-serif"
            }}>
              {getButtonLabel()}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

/** Neumorphic message card — latest message is larger for readability */
function SpeakerMessage({
  message,
  perspectiveLang,
  perspectiveRtl,
  isLatest,
}: {
  message: ConversationMessage;
  perspectiveLang: string;
  perspectiveRtl: boolean;
  isLatest: boolean;
}) {
  const isOwn = message.source_lang === perspectiveLang;
  const accent = isOwn ? 'var(--accent)' : 'var(--teal)';

  let primaryText: string;
  let secondaryText: string | undefined;

  if (isOwn) {
    primaryText = message.original_text;
    secondaryText = message.translated_text;
  } else {
    primaryText = message.translated_text || '...';
    secondaryText = message.original_text;
  }

  const containerStyle: CSSProperties = {
    marginBottom: isLatest ? '20px' : '12px',
    padding: isLatest ? '24px 24px' : '14px 18px',
    backgroundColor: 'var(--bg)',
    borderRadius: isLatest ? '24px' : '18px',
    boxShadow: isLatest ? 'var(--shadow-extruded)' : 'var(--shadow-extruded-sm)',
    opacity: message.is_interim ? 0.6 : 1,
    transition: 'all 0.3s ease-out',
    position: 'relative',
  };

  const accentDotStyle: CSSProperties = {
    position: 'absolute',
    top: isLatest ? '24px' : '14px',
    [perspectiveRtl ? 'right' : 'left']: '0px',
    width: isLatest ? '5px' : '4px',
    height: isLatest ? '32px' : '20px',
    borderRadius: perspectiveRtl ? '4px 0 0 4px' : '0 4px 4px 0',
    backgroundColor: accent,
  };

  const primaryStyle: CSSProperties = {
    fontSize: isLatest ? '22px' : '13px',
    lineHeight: isLatest ? 1.6 : 1.6,
    fontWeight: isLatest ? 600 : 500,
    color: 'var(--fg)',
    direction: perspectiveRtl ? 'rtl' : 'ltr',
    textAlign: perspectiveRtl ? 'right' : 'left',
    fontFamily: perspectiveRtl
      ? "'Noto Sans Arabic', 'DM Sans', sans-serif"
      : "'DM Sans', sans-serif",
  };

  const secondaryStyle: CSSProperties = {
    fontSize: isLatest ? '15px' : '11px',
    lineHeight: 1.6,
    fontWeight: 400,
    color: 'var(--muted)',
    marginTop: isLatest ? '12px' : '8px',
    paddingTop: isLatest ? '12px' : '8px',
    boxShadow: 'inset 0 1px 0 rgb(163,177,198,0.3), inset 0 -0px 0 rgba(255,255,255,0.5)',
    direction: perspectiveRtl ? 'ltr' : 'rtl',
    textAlign: perspectiveRtl ? 'left' : 'right',
    fontFamily: perspectiveRtl
      ? "'DM Sans', sans-serif"
      : "'Noto Sans Arabic', 'DM Sans', sans-serif",
  };

  const metaStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '8px',
    fontSize: '11px',
    fontWeight: 500,
    color: 'rgb(163, 177, 198)',
  };

  const formatTime = (date: Date): string =>
    date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={containerStyle}>
      <div style={accentDotStyle} />
      <div style={primaryStyle}>{primaryText}</div>
      {message.translated_text && secondaryText && (
        <div style={secondaryStyle}>{secondaryText}</div>
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
