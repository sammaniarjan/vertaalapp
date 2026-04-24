// Client -> Server
export interface AudioMeta {
  type: 'audio_meta';
  chunk_id: string;
  source_lang: string;
  target_lang: string;
  format: 'webm_opus';
  is_final: boolean;
  session_id: string;
}

// Server -> Client
export interface SessionInit {
  type: 'session_init';
  models_ready: boolean;
  stt_engine: string;
  stt_model?: string;
}

export interface TranscriptionResult {
  type: 'transcription';
  chunk_id: string;
  source_lang: string;
  original_text: string;
  is_final: boolean;
  session_id: string;
}

export interface TranslationResult {
  type: 'translation';
  chunk_id: string;
  original_text: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
  processing_time_ms: number;
  session_id: string;
}

export interface ModelsStatus {
  type: 'models_status';
  all_ready: boolean;
  details: Record<string, string>;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ServerMessage =
  | SessionInit
  | TranscriptionResult
  | TranslationResult
  | ModelsStatus
  | ErrorMessage;

export interface ConversationMessage {
  id: string;
  source_lang: string;
  original_text: string;
  translated_text?: string;
  timestamp: Date;
  processing_time_ms?: number;
  is_interim?: boolean;
}

// Language system
export interface LanguageInfo {
  code: string;
  name: string;
  native_name: string;
  flag: string;
  rtl: boolean;
  engine: 'marianmt' | 'nllb';
  quality: 'high' | 'good' | 'basic';
  installed: boolean;
  downloading: boolean;
  progress: number;
  error?: string;
}
