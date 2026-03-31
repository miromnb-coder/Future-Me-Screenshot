"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

export type QuickActionItem = {
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
  icon?: ReactNode;
};

export function QuickActionsMenu({
  open,
  mode,
  title,
  subtitle,
  items,
  onClose,
  position,
}: {
  open: boolean;
  mode: "sheet" | "context";
  title: string;
  subtitle?: string;
  items: QuickActionItem[];
  onClose: () => void;
  position?: { left: number; top: number };
}) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={backdrop}
            onClick={onClose}
          />
          {mode === "sheet" ? (
            <motion.aside
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={sheet}
            >
              <div>
                <div style={titleStyle}>{title}</div>
                {subtitle ? <div style={subtitleStyle}>{subtitle}</div> : null}
              </div>

              <div style={group}>
                {items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    style={{
                      ...button,
                      ...(item.tone === "danger" ? danger : null),
                    }}
                  >
                    {item.icon ? <span style={iconWrap}>{item.icon}</span> : null}
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.aside>
          ) : (
            <motion.aside
              initial={{ scale: 0.98, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 8 }}
              transition={{ duration: 0.14 }}
              style={{
                ...contextMenu,
                left: position?.left ?? 16,
                top: position?.top ?? 16,
              }}
            >
              <div style={contextHeader}>
                <div style={titleStyle}>{title}</div>
                {subtitle ? <div style={subtitleStyle}>{subtitle}</div> : null}
              </div>

              <div style={contextGroup}>
                {items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    style={{
                      ...contextButton,
                      ...(item.tone === "danger" ? contextDanger : null),
                    }}
                  >
                    {item.icon ? <span style={iconWrap}>{item.icon}</span> : null}
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.aside>
          )}
        </>
      ) : null}
    </AnimatePresence>
  );
}

const backdrop = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(0,0,0,0.62)",
  backdropFilter: "blur(8px)",
  zIndex: 40,
};

const sheet = {
  position: "fixed" as const,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 50,
  background: "rgba(18,20,30,0.96)",
  borderTopLeftRadius: 32,
  borderTopRightRadius: 32,
  borderTop: "1px solid rgba(255,255,255,0.10)",
  padding: 24,
  boxShadow: "0 -24px 80px rgba(0,0,0,0.5)",
  display: "grid",
  gap: 16,
  backdropFilter: "blur(40px) saturate(150%)",
  color: "#ffffff",
};

const titleStyle = {
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: "-0.03em",
};

const subtitleStyle = {
  marginTop: 4,
  fontSize: 14,
  color: "rgba(255,255,255,0.62)",
  lineHeight: 1.5,
};

const group = {
  display: "grid",
  gap: 10,
};

const button = {
  width: "100%",
  textAlign: "left" as const,
  borderRadius: 16,
  padding: "16px",
  border: "1px solid rgba(255,255,255,0.05)",
  background: "rgba(255,255,255,0.03)",
  color: "#ffffff",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const danger = {
  color: "#fb7185",
};

const iconWrap = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
};

const contextMenu = {
  position: "fixed" as const,
  zIndex: 100,
  background: "rgba(24, 26, 38, 0.95)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 16,
  padding: 8,
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
  boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
  minWidth: 220,
};

const contextHeader = {
  padding: "2px 6px 8px",
};

const contextGroup = {
  display: "grid",
  gap: 4,
};

const contextButton = {
  background: "transparent",
  border: "none",
  color: "#ffffff",
  textAlign: "left" as const,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 600,
  borderRadius: 10,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const contextDanger = {
  color: "#fb7185",
};
