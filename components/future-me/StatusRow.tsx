"use client";

import { motion } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import type { FutureMeStyles } from "./types";

interface StatusRowProps {
  styles: FutureMeStyles;
  isPro: boolean;
  remainingToday: number;
  user: User | null;
  visibleMessageCount: number;
  onShowSaveSheet: () => void;
  onOpenMenu: () => void;
}

export function StatusRow({
  styles,
  isPro,
  remainingToday,
  user,
  visibleMessageCount,
  onShowSaveSheet,
  onOpenMenu,
}: StatusRowProps) {
  return (
    <div style={styles.statusRow}>
      <span style={styles.pill}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: isPro ? "#4caf7a" : "#ff9e5e",
            boxShadow: `0 0 8px ${isPro ? "#4caf7a" : "#ff9e5e"}`,
          }}
        />
        {isPro ? "Pro active" : `Free: ${remainingToday} left today`}
      </span>
      <span style={styles.pill}>{user ? "synced to cloud" : "guest mode"}</span>
      <span style={styles.pill}>{visibleMessageCount} messages</span>
      {!user ? (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          style={styles.pillAction}
          type="button"
          onClick={onShowSaveSheet}
        >
          Save with email
        </motion.button>
      ) : (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          style={styles.pillAction}
          type="button"
          onClick={onOpenMenu}
        >
          Account
        </motion.button>
      )}
    </div>
  );
}
