import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioRecorder } from './useAudioRecorder';

interface PushToTalkHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
}

interface UsePushToTalkReturn {
  isRecording: boolean;
  isProcessing: boolean;
  handlers: PushToTalkHandlers;
  clearProcessing: () => void;
}

const MIN_HOLD_MS = 150;

export function usePushToTalk(
  sourceLang: string,
  targetLang: string,
  keyCode: string,
  onChunk: (blob: Blob, sourceLang: string, targetLang: string, isFinal: boolean, sessionId: string) => void,
  enabled: boolean = true
): UsePushToTalkReturn {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [isProcessing, setIsProcessing] = useState(false);
  const isPressedRef = useRef(false);
  const isActiveRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef('');

  const beginRecording = useCallback(async () => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;
    sessionIdRef.current = crypto.randomUUID();

    try {
      await startRecording((interimBlob: Blob) => {
        if (isActiveRef.current) {
          onChunk(interimBlob, sourceLang, targetLang, false, sessionIdRef.current);
        }
      });
    } catch (err) {
      console.error('Failed to start recording:', err);
      isActiveRef.current = false;
    }
  }, [startRecording, onChunk, sourceLang, targetLang]);

  const endRecording = useCallback(async () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (!isActiveRef.current) return;
    isActiveRef.current = false;

    try {
      const blob = await stopRecording();
      if (blob.size > 0) {
        setIsProcessing(true);
        onChunk(blob, sourceLang, targetLang, true, sessionIdRef.current);
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
    }
  }, [stopRecording, onChunk, sourceLang, targetLang]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      isPressedRef.current = true;

      holdTimerRef.current = setTimeout(() => {
        if (isPressedRef.current) beginRecording();
      }, MIN_HOLD_MS);
    },
    [beginRecording]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      isPressedRef.current = false;
      endRecording();
    },
    [endRecording]
  );

  const onPointerLeave = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      if (isPressedRef.current) {
        isPressedRef.current = false;
        endRecording();
      }
    },
    [endRecording]
  );

  // Reset recording state when disabled (e.g. going back to setup)
  useEffect(() => {
    if (!enabled) {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      isPressedRef.current = false;
      if (isActiveRef.current) {
        isActiveRef.current = false;
        stopRecording().catch(() => {});
      }
      setIsProcessing(false);
    }
  }, [enabled, stopRecording]);

  // Keyboard support — key code is passed in dynamically
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === keyCode && !e.repeat && !isPressedRef.current) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        isPressedRef.current = true;
        holdTimerRef.current = setTimeout(() => {
          if (isPressedRef.current) beginRecording();
        }, MIN_HOLD_MS);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === keyCode) {
        e.preventDefault();
        isPressedRef.current = false;
        endRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [keyCode, beginRecording, endRecording, enabled]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const clearProcessing = useCallback(() => {
    setIsProcessing(false);
  }, []);

  return {
    isRecording,
    isProcessing,
    handlers: { onPointerDown, onPointerUp, onPointerLeave },
    clearProcessing,
  };
}
