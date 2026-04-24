import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioMeta, ServerMessage } from '../types/messages';

interface ModelDetails {
  stt?: string;
  translation?: string;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  modelsReady: boolean;
  sttEngine: string;
  sttModel: string;
  modelDetails: ModelDetails;
  sendAudio: (blob: Blob, sourceLang: string, targetLang: string, chunkId: string, isFinal: boolean, sessionId: string) => void;
  onMessage: (handler: (message: ServerMessage) => void) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [sttEngine, setSttEngine] = useState('');
  const [sttModel, setSttModel] = useState('');
  const [modelDetails, setModelDetails] = useState<ModelDetails>({});

  const wsRef = useRef<WebSocket | null>(null);
  const messageHandlerRef = useRef<((message: ServerMessage) => void) | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const isProduction = window.location.protocol === 'file:' || !window.location.host;
    const wsUrl = isProduction
      ? 'ws://127.0.0.1:8001/ws/translate'
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/translate`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (!mountedRef.current) {
        ws.close();
        return;
      }
      setIsConnected(true);
      reconnectDelayRef.current = 1000;
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      setModelsReady(false);
      scheduleReconnect();
    };

    ws.onerror = () => {};

    ws.onmessage = (event: MessageEvent) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        switch (message.type) {
          case 'session_init':
            setModelsReady(message.models_ready);
            setSttEngine(message.stt_engine);
            if (message.stt_model) setSttModel(message.stt_model);
            break;
          case 'models_status':
            setModelsReady(message.all_ready);
            setModelDetails(message.details || {});
            break;
          case 'error':
            console.error('[WebSocket] Server error:', message.message);
            break;
        }
        messageHandlerRef.current?.(message);
      } catch (err) {
        console.error('[WebSocket] Failed to parse message:', err);
      }
    };

    wsRef.current = ws;
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    const delay = reconnectDelayRef.current;
    reconnectDelayRef.current = Math.min(delay * 2, 10000);
    reconnectTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) connect();
    }, delay);
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendAudio = useCallback(
    async (blob: Blob, sourceLang: string, targetLang: string, chunkId: string, isFinal: boolean, sessionId: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const meta: AudioMeta = {
        type: 'audio_meta',
        chunk_id: chunkId,
        source_lang: sourceLang,
        target_lang: targetLang,
        format: 'webm_opus',
        is_final: isFinal,
        session_id: sessionId,
      };

      const buffer = await blob.arrayBuffer();
      ws.send(JSON.stringify(meta));
      ws.send(buffer);
    },
    []
  );

  const onMessage = useCallback(
    (handler: (message: ServerMessage) => void) => {
      messageHandlerRef.current = handler;
    },
    []
  );

  return { isConnected, modelsReady, sttEngine, sttModel, modelDetails, sendAudio, onMessage };
}
