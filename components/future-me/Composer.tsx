
"use client";

import { motion } from "framer-motion";
import { type Mood, moodLabels } from "@/lib/futureMe";

interface ComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  mood: Mood;
  loading: boolean;
}

export function Composer({
  input,
  onInputChange,
  onSendMessage,
  mood,
  loading,
}: ComposerProps) {
  return (
    <div className="rounded-[26px] bg-glass border border-white/10 shadow-lg backdrop-blur-xl overflow-hidden relative transition-all">
      <div className="flex justify-between gap-2.5 flex-wrap p-3.5 pb-0">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/20 text-white/60 border border-white/5 text-xs font-bold">
          {moodLabels[mood]} mode
        </span>
        {/* TODO: Add memory badge */}
      </div>

      <div className="flex gap-2.5 items-end p-3.5 flex-col md:flex-row">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSendMessage();
            }
          }}
          placeholder="Ask your future self..."
          rows={1}
          className="flex-1 w-full min-h-[52px] max-h-40 resize-none rounded-2xl border border-white/10 bg-black/20 text-white p-3.5 text-base outline-none shadow-inner transition-all"
        />
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          className="w-full md:w-auto border-0 rounded-2xl px-5 py-3.5 bg-accent text-white font-bold text-base shadow-lg cursor-pointer transition-all"
          onClick={() => onSendMessage()}
          disabled={loading}
        >
          {loading ? "Thinking..." : "Send"}
        </motion.button>
      </div>

      <div className="px-4 pb-4 text-xs text-white/60 text-center">
        Press Enter to send · Shift+Enter for a new line
      </div>
    </div>
  );
}
