"use client";

import { useState, useCallback } from "react";
import { looksFinnish, type Message } from "@/lib/futureMe";

interface UseSpeechReturn {
  speakingId: string | null;
  speak: (message: Message) => void;
  stop: () => void;
  isSpeaking: (id: string) => boolean;
}

export function useSpeech(): UseSpeechReturn {
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (message: Message) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      const synth = window.speechSynthesis;

      if (speakingId === message.id) {
        synth.cancel();
        setSpeakingId(null);
        return;
      }

      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(message.text);
      utterance.rate = 0.96;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.lang = looksFinnish(message.text) ? "fi-FI" : "en-US";

      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);

      setSpeakingId(message.id);
      synth.speak(utterance);
    },
    [speakingId]
  );

  const isSpeaking = useCallback((id: string) => speakingId === id, [speakingId]);

  return {
    speakingId,
    speak,
    stop,
    isSpeaking,
  };
}
