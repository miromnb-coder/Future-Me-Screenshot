"use client";

import { motion } from "framer-motion";
import type { FutureMeStyles } from "./types";

interface TypingIndicatorProps {
  styles: FutureMeStyles;
}

export function TypingIndicator({ styles }: TypingIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      style={styles.typingRow}
    >
      <div style={styles.typingBubble}>
        <span style={styles.typingDots}>
          <span style={styles.typingDot} />
          <span style={{ ...styles.typingDot, animationDelay: "120ms" }} />
          <span style={{ ...styles.typingDot, animationDelay: "240ms" }} />
        </span>{" "}
        typing...
      </div>
    </motion.div>
  );
}
