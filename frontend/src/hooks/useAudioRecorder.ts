import { useCallback, useRef, useState, useEffect } from 'react';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  startRecording: (onChunk: (blob: Blob) => void) => Promise<void>;
  stopRecording: () => Promise<Blob>;
}

function getSupportedMimeType(): string {
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus';
  }
  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm';
  }
  return '';
}

const CHUNK_INTERVAL_MS = 2000;

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const allChunksRef = useRef<Blob[]>([]);
  const resolveStopRef = useRef<((blob: Blob) => void) | null>(null);
  const onChunkRef = useRef<((blob: Blob) => void) | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
    };
  }, []);

  const startRecording = useCallback(async (onChunk: (blob: Blob) => void) => {
    allChunksRef.current = [];
    onChunkRef.current = onChunk;

    if (!streamRef.current) {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
    }

    const mimeType = getSupportedMimeType();
    const options: MediaRecorderOptions = {};
    if (mimeType) {
      options.mimeType = mimeType;
    }

    const recorder = new MediaRecorder(streamRef.current, options);

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        allChunksRef.current.push(event.data);
        // Send cumulative blob as interim chunk for live transcription
        if (recorder.state === 'recording' && onChunkRef.current) {
          const mType = recorder.mimeType || 'audio/webm';
          const cumulativeBlob = new Blob([...allChunksRef.current], { type: mType });
          onChunkRef.current(cumulativeBlob);
        }
      }
    };

    recorder.onstop = () => {
      const mType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(allChunksRef.current, { type: mType });
      allChunksRef.current = [];
      onChunkRef.current = null;

      // Release microphone — stop all tracks so the mic indicator disappears
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      resolveStopRef.current?.(blob);
      resolveStopRef.current = null;
    };

    mediaRecorderRef.current = recorder;
    // Use timeslice to get chunks every CHUNK_INTERVAL_MS
    recorder.start(CHUNK_INTERVAL_MS);
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise<Blob>((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        reject(new Error('No active recording'));
        return;
      }

      resolveStopRef.current = resolve;
      recorder.stop();
      setIsRecording(false);
    });
  }, []);

  return { isRecording, startRecording, stopRecording };
}
