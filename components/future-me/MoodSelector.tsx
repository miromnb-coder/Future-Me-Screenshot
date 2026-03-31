"use client";

import { motion } from "framer-motion";
import { moodLabels, moodIcons, moodHints, vibrate, type Mood } from "@/lib/futureMe";
import type { FutureMeStyles } from "./types";

interface MoodSelectorProps {
  styles: FutureMeStyles;
  accent: string;
  mood: Mood;
  onMoodChange: (mood: Mood) => void;
}

export function MoodSelector({ styles, accent, mood, onMoodChange }: MoodSelectorProps) {
  return (
    <section>
      <div style={styles.moodSection}>
        <div>
          <div style={styles.moodHeading}>Choose Mood</div>
          <div style={styles.moodSub}>AI adapts tone to your current mindset</div>
        </div>

        <div style={styles.moodRow}>
          {(Object.keys(moodLabels) as Mood[]).map((item) => {
            const active = item === mood;
            return (
              <motion.button
                key={item}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => {
                  onMoodChange(item);
                  vibrate(8);
                }}
                style={active ? styles.moodButtonActive : styles.moodButton}
              >
                <div style={{ ...styles.moodGlow, opacity: active ? 1 : 0 }} />
                <div style={{ ...styles.moodIcon, color: active ? accent : "rgba(255,255,255,0.58)" }}>
                  {moodIcons[item]}
                </div>
                <div style={styles.moodLabel}>{moodLabels[item]}</div>
                <div style={styles.moodLabelSub}>{active ? moodHints[item] : " "}</div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
