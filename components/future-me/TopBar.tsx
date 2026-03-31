"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import type { User } from "@supabase/supabase-js";
import type { ViewTab } from "@/lib/futureMe";

export function TopBar({
  styles,
  activeTab,
  setActiveTab,
  user,
  onOpenMenu,
}: {
  styles: Record<string, CSSProperties>;
  activeTab: ViewTab;
  setActiveTab: (tab: ViewTab) => void;
  user: User | null;
  onOpenMenu: () => void;
}) {
  return (
    <header style={styles.topBar}>
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        style={styles.iconButton}
        aria-label="Menu"
        onClick={onOpenMenu}
      >
        ≡
      </motion.button>

      <div style={styles.topTitle}>
        <div style={styles.brand}>Future Me</div>
        <div style={styles.brandSub}>{user ? "synced cloud memory" : "guest mode · local memory"}</div>
        <div style={styles.tabSwitcher}>
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            style={activeTab === "chat" ? styles.tabButtonActive : styles.tabButton}
            onClick={() => setActiveTab("chat")}
          >
            Chat
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            style={activeTab === "insights" ? styles.tabButtonActive : styles.tabButton}
            onClick={() => setActiveTab("insights")}
          >
            Insights
          </motion.button>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        style={styles.iconButton}
        aria-label="More"
        onClick={onOpenMenu}
      >
        ⋯
      </motion.button>
    </header>
  );
}
