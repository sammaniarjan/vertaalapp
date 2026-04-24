import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { usePushToTalk } from './hooks/usePushToTalk';
import { TranslationPanel } from './components/TranslationPanel';
import { LanguageSetup } from './components/LanguageSetup';
import type { LangInfo } from './components/SpeakerPanel';
import type { ConversationMessage, ServerMessage } from './types/messages';

// Language info lookup (matches backend SUPPORTED_LANGUAGES)
const LANG_INFO: Record<string, LangInfo> = {
  nl: { code: 'nl', name: 'Nederlands', nativeName: 'Nederlands', rtl: false },
  ar: { code: 'ar', name: 'Arabisch', nativeName: 'العربية', rtl: true },
  tr: { code: 'tr', name: 'Turks', nativeName: 'Türkçe', rtl: false },
  fr: { code: 'fr', name: 'Frans', nativeName: 'Français', rtl: false },
  de: { code: 'de', name: 'Duits', nativeName: 'Deutsch', rtl: false },
  es: { code: 'es', name: 'Spaans', nativeName: 'Español', rtl: false },
  pl: { code: 'pl', name: 'Pools', nativeName: 'Polski', rtl: false },
  ru: { code: 'ru', name: 'Russisch', nativeName: 'Русский', rtl: false },
  uk: { code: 'uk', name: 'Oekraïens', nativeName: 'Українська', rtl: false },
  zh: { code: 'zh', name: 'Chinees', nativeName: '中文', rtl: false },
  it: { code: 'it', name: 'Italiaans', nativeName: 'Italiano', rtl: false },
  pt: { code: 'pt', name: 'Portugees', nativeName: 'Português', rtl: false },
  fa: { code: 'fa', name: 'Farsi', nativeName: 'فارسی', rtl: true },
  so: { code: 'so', name: 'Somalisch', nativeName: 'Soomaali', rtl: false },
  ti: { code: 'ti', name: 'Tigrinya', nativeName: 'ትግርኛ', rtl: false },
};

const DEFAULT_LANG: LangInfo = { code: 'en', name: 'English', nativeName: 'English', rtl: false };

function getLangInfo(code: string): LangInfo {
  return LANG_INFO[code] || { ...DEFAULT_LANG, code };
}

function App() {
  const { isConnected, modelsReady, sttEngine, sttModel, modelDetails, sendAudio, onMessage } =
    useWebSocket();

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [sourceLang, setSourceLang] = useState<string>('');
  const [targetLang, setTargetLang] = useState<string>('');
  const [showSetup, setShowSetup] = useState(true);

  const sessionToMessageIdRef = useRef<Map<string, string>>(new Map());
  const activeSessionsRef = useRef<Set<string>>(new Set());
  const chunkCounterRef = useRef(0);

  // Pre-select saved language pair on the setup screen (but always show setup first)
  useEffect(() => {
    fetch('http://127.0.0.1:8001/api/languages')
      .then((r) => r.json())
      .then((data) => {
        if (data.active_pair) {
          setSourceLang(data.active_pair[0]);
          setTargetLang(data.active_pair[1]);
        }
      })
      .catch(() => {});
  }, []);

  const handleLanguagesReady = useCallback((src: string, tgt: string) => {
    setSourceLang(src);
    setTargetLang(tgt);
    setMessages([]);
    setShowSetup(false);
  }, []);

  const handleChunk = useCallback(
    (blob: Blob, srcLang: string, tgtLang: string, isFinal: boolean, sessionId: string) => {
      const chunkId = `${sessionId}-${chunkCounterRef.current++}`;

      if (!sessionToMessageIdRef.current.has(sessionId)) {
        const messageId = crypto.randomUUID();
        sessionToMessageIdRef.current.set(sessionId, messageId);
        activeSessionsRef.current.add(sessionId);

        const newMessage: ConversationMessage = {
          id: messageId,
          source_lang: srcLang,
          original_text: '...',
          timestamp: new Date(),
          is_interim: true,
        };
        setMessages((prev) => [...prev, newMessage]);
      }

      if (isFinal) {
        activeSessionsRef.current.delete(sessionId);
      }

      sendAudio(blob, srcLang, tgtLang, chunkId, isFinal, sessionId);
    },
    [sendAudio]
  );

  // Left side speaker (source language, key A) — only active when not on setup screen
  const leftPtt = usePushToTalk(sourceLang, targetLang, 'KeyA', handleChunk, !showSetup);
  // Right side speaker (target language, key L)
  const rightPtt = usePushToTalk(targetLang, sourceLang, 'KeyL', handleChunk, !showSetup);

  const leftClearRef = useRef(leftPtt.clearProcessing);
  const rightClearRef = useRef(rightPtt.clearProcessing);
  leftClearRef.current = leftPtt.clearProcessing;
  rightClearRef.current = rightPtt.clearProcessing;

  useEffect(() => {
    onMessage((message: ServerMessage) => {
      switch (message.type) {
        case 'transcription': {
          const msg = message as ServerMessage & { session_id?: string; is_final?: boolean };
          const sessionId = msg.session_id;
          if (!sessionId) return;

          const messageId = sessionToMessageIdRef.current.get(sessionId);
          if (!messageId) return;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    original_text: message.original_text || '...',
                    is_interim: !msg.is_final,
                  }
                : m
            )
          );
          break;
        }

        case 'translation': {
          const msg = message as ServerMessage & { session_id?: string };
          const sessionId = msg.session_id;
          if (!sessionId) return;

          const messageId = sessionToMessageIdRef.current.get(sessionId);
          if (!messageId) return;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    original_text: message.original_text,
                    translated_text: message.translated_text,
                    processing_time_ms: message.processing_time_ms,
                    is_interim: false,
                  }
                : m
            )
          );

          // Clear processing state for the correct side
          if (message.source_lang === sourceLang) {
            leftClearRef.current();
          } else {
            rightClearRef.current();
          }

          sessionToMessageIdRef.current.delete(sessionId);
          break;
        }

        case 'error': {
          console.error('[App] Server error:', message.message);
          const errMsg = message as ServerMessage & { chunk_id?: string };
          if (errMsg.chunk_id) {
            const dashIdx = errMsg.chunk_id.lastIndexOf('-');
            if (dashIdx > 0) {
              const sid = errMsg.chunk_id.substring(0, dashIdx);

              // Don't clean up sessions that are still recording —
              // interim chunk errors are normal, just ignore them.
              if (!activeSessionsRef.current.has(sid)) {
                const msgId = sessionToMessageIdRef.current.get(sid);
                if (msgId) {
                  setMessages((prev) => prev.filter((m) => {
                    if (m.id === msgId && m.original_text === '...') return false;
                    return true;
                  }));
                  sessionToMessageIdRef.current.delete(sid);
                }
                leftClearRef.current();
                rightClearRef.current();
              }
            }
          }
          break;
        }
      }
    });
  }, [onMessage, sourceLang]);

  if (showSetup) {
    return <LanguageSetup onReady={handleLanguagesReady} />;
  }

  return (
    <TranslationPanel
      messages={messages}
      isConnected={isConnected}
      modelsReady={modelsReady}
      sttEngine={sttEngine}
      sttModel={sttModel}
      modelDetails={modelDetails}
      sourceLang={getLangInfo(sourceLang)}
      targetLang={getLangInfo(targetLang)}
      nlRecording={leftPtt.isRecording}
      nlProcessing={leftPtt.isProcessing}
      nlHandlers={leftPtt.handlers}
      arRecording={rightPtt.isRecording}
      arProcessing={rightPtt.isProcessing}
      arHandlers={rightPtt.handlers}
      onChangeLangs={() => setShowSetup(true)}
    />
  );
}

export default App;
