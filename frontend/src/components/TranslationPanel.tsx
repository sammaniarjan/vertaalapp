import { useCallback, useState, type CSSProperties } from 'react';
import type { ConversationMessage } from '../types/messages';
import type { LangInfo } from './SpeakerPanel';
import { AboutModal } from './AboutModal';
import { SpeakerPanel } from './SpeakerPanel';
import { StatusIndicator } from './StatusIndicator';

interface TranslationPanelProps {
  messages: ConversationMessage[];
  isConnected: boolean;
  modelsReady: boolean;
  sttEngine: string;
  sttModel?: string;
  modelDetails?: { stt?: string; translation?: string };
  sourceLang: LangInfo;
  targetLang: LangInfo;
  nlRecording: boolean;
  nlProcessing: boolean;
  nlHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerLeave: (e: React.PointerEvent) => void;
  };
  arRecording: boolean;
  arProcessing: boolean;
  arHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerLeave: (e: React.PointerEvent) => void;
  };
  onChangeLangs: () => void;
}

export function TranslationPanel({
  messages,
  isConnected,
  modelsReady,
  sttEngine,
  sttModel,
  modelDetails,
  sourceLang,
  targetLang,
  nlRecording,
  nlProcessing,
  nlHandlers,
  arRecording,
  arProcessing,
  arHandlers,
  onChangeLangs,
}: TranslationPanelProps) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const buttonsDisabled = !isConnected || !modelsReady;

  const handleExport = useCallback(() => {
    if (messages.length === 0) return;
    const lines: string[] = [
      `Vertaalapp — Gespreksverslag`,
      `${sourceLang.nativeName} ↔ ${targetLang.nativeName}`,
      `Datum: ${new Date().toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      `Tijd: ${new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`,
      '',
      '─'.repeat(50),
      '',
    ];
    for (const msg of messages) {
      if (msg.is_interim) continue;
      const time = msg.timestamp.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
      const srcName = msg.source_lang === sourceLang.code ? sourceLang.nativeName : targetLang.nativeName;
      lines.push(`[${time}] ${srcName}:`);
      lines.push(`  ${msg.original_text}`);
      if (msg.translated_text) {
        lines.push(`  → ${msg.translated_text}`);
      }
      lines.push('');
    }
    lines.push('─'.repeat(50));
    lines.push('Gegenereerd door Vertaalapp — Manava (www.manava.nl)');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vertaalapp-gesprek-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, sourceLang, targetLang]);

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: 'var(--bg)',
  };

  const splitStyle: CSSProperties = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    gap: '2px',
  };

  return (
    <div style={containerStyle}>
      <StatusIndicator
        isConnected={isConnected}
        modelsReady={modelsReady}
        sttEngine={sttEngine}
        sttModel={sttModel}
        modelDetails={modelDetails}
        onAboutClick={() => setAboutOpen(true)}
        onChangeLangs={onChangeLangs}
        onExport={messages.length > 0 ? handleExport : undefined}
      />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <div style={splitStyle}>
        <SpeakerPanel
          side="left"
          lang={sourceLang}
          otherLang={targetLang}
          keyHint="A"
          messages={messages}
          isRecording={nlRecording}
          isProcessing={nlProcessing}
          disabled={buttonsDisabled}
          handlers={nlHandlers}
        />
        <SpeakerPanel
          side="right"
          lang={targetLang}
          otherLang={sourceLang}
          keyHint="L"
          messages={messages}
          isRecording={arRecording}
          isProcessing={arProcessing}
          disabled={buttonsDisabled}
          handlers={arHandlers}
        />
      </div>
    </div>
  );
}
