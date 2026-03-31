"use client";

import { useState, useRef, useCallback } from "react";
import { createSpeechRecognition, vibrate } from "@/lib/futureMe";

interface UseVoiceInputOptions {
  onTranscript: (transcript: string) => void;
  onError?: (message: string) => void;
  lang?: string;
}

interface UseVoiceInputReturn {
  isListening: boolean;
  startVoice: () => void;
  stopVoice: () => void;
  toggleVoice: () => void;
}

export function useVoiceInput({
  onTranscript,
  onError,
  lang = "en-US",
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);

  const stopVoice = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop?.();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startVoice = useCallback(() => {
    if (isListening) {
      stopVoice();
      return;
    }

    const recognition = createSpeechRecognition();
    if (!recognition) {
      onError?.("Voice input is not supported in this browser.");
      return;
    }

    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join("")
        .trim();

      if (transcript) {
        onTranscript(transcript);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
      onError?.("Voice input stopped.");
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    vibrate(10);
    recognition.start();
  }, [isListening, lang, onTranscript, onError, stopVoice]);

  const toggleVoice = useCallback(() => {
    if (isListening) {
      stopVoice();
    } else {
      startVoice();
    }
  }, [isListening, startVoice, stopVoice]);

  return {
    isListening,
    startVoice,
    stopVoice,
    toggleVoice,
  };
}
