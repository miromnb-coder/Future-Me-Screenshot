"use client";

import { motion } from "framer-motion";
import type { FutureMeStyles } from "./types";

interface SaveSheetProps {
  styles: FutureMeStyles;
  emailInput: string;
  onEmailChange: (email: string) => void;
  emailCooldownUntil: number;
  sendingEmail: boolean;
  loginStatus: string;
  onSignIn: () => void;
  onClose: () => void;
}

export function SaveSheet({
  styles,
  emailInput,
  onEmailChange,
  emailCooldownUntil,
  sendingEmail,
  loginStatus,
  onSignIn,
  onClose,
}: SaveSheetProps) {
  const isOnCooldown = emailCooldownUntil > Date.now();

  return (
    <aside style={styles.sheet}>
      <div>
        <div style={styles.sheetTitle}>Save with email</div>
        <div style={styles.sheetSub}>
          Enter your email to send yourself a magic link and save this conversation.
        </div>
      </div>

      <input
        style={styles.sheetInput}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@email.com"
        value={emailInput}
        onChange={(e) => onEmailChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSignIn();
          }
        }}
      />

      <button
        style={{
          ...styles.sheetPrimary,
          opacity: isOnCooldown || sendingEmail ? 0.6 : 1,
        }}
        onClick={onSignIn}
        disabled={sendingEmail || isOnCooldown}
      >
        {sendingEmail
          ? "Sending..."
          : isOnCooldown
            ? `Wait ${Math.ceil((emailCooldownUntil - Date.now()) / 1000)}s`
            : "Send magic link"}
      </button>

      <button style={styles.sheetSecondary} onClick={onClose}>
        Close
      </button>

      {loginStatus ? <div style={styles.sheetHint}>{loginStatus}</div> : null}
    </aside>
  );
}

interface PaywallSheetProps {
  styles: FutureMeStyles;
  isPro: boolean;
  remainingToday: number;
  onUnlockPro: () => void;
  onShare: () => void;
  onClose: () => void;
}

export function PaywallSheet({
  styles,
  isPro,
  remainingToday,
  onUnlockPro,
  onShare,
  onClose,
}: PaywallSheetProps) {
  return (
    <aside style={styles.paywall}>
      <div style={styles.paywallHeader}>
        <div style={styles.paywallTitle}>Future Me Pro</div>
        <div style={styles.paywallSub}>
          More memory. Deeper replies. Longer conversations. The app starts to feel like it actually knows your
          story.
        </div>
      </div>

      <div style={styles.freeTag}>
        {isPro ? "Pro active" : `Free: ${remainingToday} left today`}
      </div>

      <div style={styles.featureCard}>
        <div style={styles.paywallSub}>What changes in Pro</div>
        <div style={styles.featureList}>
          <div style={styles.featureItem}>
            <span style={styles.featureDot} />
            Longer memory and fewer generic replies.
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureDot} />
            Mood modes that actually change the tone.
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureDot} />
            Unlimited messages and longer conversations.
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureDot} />
            Better sharing and a more personal feel.
          </div>
        </div>
      </div>

      <div style={styles.paywallButtons}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          style={styles.proButton}
          onClick={onUnlockPro}
        >
          Unlock demo Pro
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          style={styles.ghostButton}
          onClick={onShare}
        >
          Share conversation
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          style={styles.ghostButton}
          onClick={onClose}
        >
          Not now
        </motion.button>
      </div>

      <div style={styles.hintLine}>
        After you add real checkout, redirect back with <code>?pro=1</code> and the app will unlock automatically.
      </div>
    </aside>
  );
}

interface FocusModeProps {
  styles: FutureMeStyles;
  input: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onClose: () => void;
}

export function FocusMode({
  styles,
  input,
  loading,
  onInputChange,
  onKeyDown,
  onSend,
  onClose,
}: FocusModeProps) {
  return (
    <div style={styles.focusModeOverlay}>
      <div style={styles.focusModeHeader}>
        <span style={styles.focusModeTitle}>Focus Mode</span>
        <button style={styles.focusModeClose} onClick={onClose}>
          X
        </button>
      </div>

      <textarea
        autoFocus
        style={styles.focusModeTextarea}
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Keep writing. No distractions."
      />

      <div style={styles.focusModeFooter}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          style={{ ...styles.sendButton, minWidth: 150 }}
          onClick={onSend}
          disabled={loading}
        >
          {loading ? "Thinking..." : "Send"}
        </motion.button>
      </div>
    </div>
  );
}
