"use client";

import type { CSSProperties } from "react";

export function QuickActionsMenu({
  styles,
  position,
  onCopy,
  onShare,
  onDeepen,
  onDelete,
  canDelete,
}: {
  styles: Record<string, CSSProperties>;
  position: { left: number; top: number } | null;
  onCopy: () => void;
  onShare: () => void;
  onDeepen: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  if (!position) return null;

  return (
    <div
      style={{
        ...styles.contextMenu,
        left: position.left,
        top: position.top,
      }}
    >
      <button style={styles.contextMenuBtn} onClick={onCopy}>
        Copy text
      </button>
      <button style={styles.contextMenuBtn} onClick={onShare}>
        Share
      </button>
      <button style={styles.contextMenuBtn} onClick={onDeepen}>
        Deepen this thought
      </button>
      {canDelete ? (
        <button style={{ ...styles.contextMenuBtn, ...styles.contextMenuBtnDanger }} onClick={onDelete}>
          Delete
        </button>
      ) : null}
    </div>
  );
}
