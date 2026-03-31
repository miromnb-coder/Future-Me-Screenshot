"use client";

import { motion } from "framer-motion";
import type { Mood, ViewTab } from "@/lib/futureMe";

export function TopBar({
  activeTab,
  onTabChange,
  onMenuOpen,
  userLabel,
  isPro,
}: {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  onMenuOpen: () => void;
  userLabel: string;
  isPro: boolean;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 10px",
        background: "linear-gradient(145deg, rgba(24, 26, 38, 0.72), rgba(255,255,255,0.05))",
        borderRadius: 24,
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.34)",
        backdropFilter: "blur(30px) saturate(160%)",
      }}
    >
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        style={iconStyle}
        aria-label="Menu"
        onClick={onMenuOpen}
      >
        ≡
      </motion.button>

      <div style={centerWrap}>
        <div style={brand}>Future Me</div>
        <div style={sub}>{userLabel}</div>

        <div style={tabs}>
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            style={activeTab === "chat" ? tabActive : tab}
            onClick={() => onTabChange("chat")}
          >
            Chat
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            style={activeTab === "insights" ? tabActive : tab}
            onClick={() => onTabChange("insights")}
          >
            Insights
          </motion.button>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        style={iconStyle}
        aria-label="More"
        onClick={onMenuOpen}
      >
        ⋯
      </motion.button>
    </header>
  );
}

const iconStyle = {
  width: 46,
  height: 46,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  color: "#ffffff",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  boxShadow: "0 8px 16px rgba(0,0,0,0.22)",
  fontSize: 18,
  fontWeight: 900,
};

const centerWrap = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  gap: 2,
  textAlign: "center" as const,
  flex: 1,
  minWidth: 0,
};

const brand = {
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: "-0.04em",
  lineHeight: 1.05,
  color: "#ffffff",
};

const sub = {
  fontSize: 12,
  color: "rgba(59, 198, 161, 0.95)",
  maxWidth: 260,
  whiteSpace: "nowrap" as const,
  overflow: "hidden",
  textOverflow: "ellipsis",
  fontWeight: 700,
};

const tabs = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap" as const,
  padding: 4,
  borderRadius: 999,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  marginTop: 6,
};

const tab = {
  border: 0,
  borderRadius: 999,
  padding: "10px 14px",
  background: "transparent",
  color: "rgba(255,255,255,0.62)",
  fontWeight: 800,
  fontSize: 12,
};

const tabActive = {
  border: 0,
  borderRadius: 999,
  padding: "10px 14px",
  background: "rgba(255,255,255,0.12)",
  color: "#ffffff",
  fontWeight: 900,
  fontSize: 12,
  boxShadow: "0 0 0 1px rgba(96, 165, 250, 0.12) inset",
};
