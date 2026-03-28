"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

type Role = "me" | "future me";

type Message = {
  id: string;
  role: Role;
  text: string;
  time: string;
};

type PersistedState = {
  messages: Message[];
  input: string;
};

const STORAGE_KEY = "future-me-free-chat-v2";
const MAX_MESSAGES = 50;

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "future me",
  text: "Write one thought. I will keep the conversation going.",
  time: "now"
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatClock() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function looksFinnish(text: string) {
  const t = text.toLowerCase();
  return (
    /[äöå]/.test(t) ||
    /(suomeksi|voisitko|voinko|mikä|mitä|tämä|tätä|olen|ehkä|miksi|nyt|kyllä|ei|siksi|koska)/i.test(t)
  );
}

function fallbackReply(latestUserText: string) {
  if (looksFinnish(latestUserText)) {
    return "Et taida hakea vain vastausta. Haluat että päätös tuntuisi vähemmän raskaalta. Se on se kohta, jota kannattaa katsoa.";
  }

  return "You are not really asking for information. You are asking for permission. That is usually the useful part to notice.";
}

function createStyles(mobile: boolean): Record<string, CSSProperties> {
  return {
    page: {
      minHeight: "100vh",
      padding: mobile ? 12 : 18,
      background: "linear-gradient(180deg, #f5efe6 0%, #eee6da 100%)",
      color: "#101826",
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflowX: "hidden"
    },
    shell: {
      maxWidth: 820,
      margin: "0 auto",
      display: "grid",
      gap: 14,
      paddingBottom: 8
    },
    topBar: {
      position: "sticky",
      top: 0,
      zIndex: 20,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "8px 2px 12px",
      backdropFilter: "blur(10px)",
      background: "linear-gradient(180deg, rgba(245,239,230,0.96), rgba(245,239,230,0.82))"
    },
    topTitle: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      textAlign: "center",
      flex: 1
    },
    brand: {
      fontSize: 18,
      fontWeight: 800,
      letterSpacing: "-0.03em"
    },
    brandSub: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)"
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.78)",
      color: "#101826",
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
      boxShadow: "0 12px 26px rgba(16,24,38,0.05)"
    },
    eyebrow: {
      display: "inline-flex",
      width: "fit-content",
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(16,24,38,0.05)",
      border: "1px solid rgba(16,24,38,0.06)",
      fontSize: 13,
      color: "rgba(16,24,38,0.72)"
    },
    chatCard: {
      borderRadius: 28,
      background: "rgba(255,255,255,0.68)",
      border: "1px solid rgba(16,24,38,0.07)",
      boxShadow: "0 18px 50px rgba(16,24,38,0.08)",
      overflow: "hidden"
    },
    chatHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: mobile ? 14 : 16,
      borderBottom: "1px solid rgba(16,24,38,0.06)",
      background: "rgba(255,255,255,0.38)",
      backdropFilter: "blur(10px)"
    },
    chatHeaderLeft: {
      display: "flex",
      alignItems: "center",
      gap: 10
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 999,
      background: "#101826",
      color: "#f5efe6",
      display: "grid",
      placeItems: "center",
      fontSize: 14,
      fontWeight: 800
    },
    chatNameWrap: {
      display: "flex",
      flexDirection: "column",
      gap: 2
    },
    chatName: {
      fontWeight: 800,
      fontSize: 16,
      letterSpacing: "-0.02em"
    },
    chatHint: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)"
    },
    chatHeaderRight: {
      display: "flex",
      alignItems: "center",
      gap: 8
    },
    statusChip: {
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(16,24,38,0.05)",
      border: "1px solid rgba(16,24,38,0.06)",
      fontSize: 12,
      color: "rgba(16,24,38,0.68)",
      whiteSpace: "nowrap"
    },
    chatBody: {
      padding: mobile ? 14 : 16,
      minHeight: mobile ? 520 : 620,
      display: "flex",
      flexDirection: "column",
      gap: 12
    },
    messages: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      flex: 1
    },
    row: {
      display: "flex"
    },
    bubble: {
      maxWidth: mobile ? "84%" : "72%",
      padding: "12px 14px",
      borderRadius: 18,
      fontSize: 14,
      lineHeight: 1.5,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word"
    },
    bubbleMe: {
      background: "#101826",
      color: "#f5efe6",
      borderTopRightRadius: 8,
      marginLeft: "auto"
    },
    bubbleFuture: {
      background: "rgba(16,24,38,0.06)",
      color: "#101826",
      borderTopLeftRadius: 8,
      marginRight: "auto"
    },
    time: {
      marginTop: 6,
      fontSize: 11,
      color: "rgba(16,24,38,0.5)"
    },
    typingRow: {
      display: "flex",
      justifyContent: "flex-start"
    },
    typingBubble: {
      maxWidth: mobile ? "84%" : "72%",
      padding: "12px 14px",
      borderRadius: 18,
      fontSize: 14,
      lineHeight: 1.5,
      background: "rgba(16,24,38,0.05)",
      color: "rgba(16,24,38,0.62)",
      borderTopLeftRadius: 8
    },
    composerCard: {
      borderRadius: 28,
      background: "rgba(255,255,255,0.72)",
      border: "1px solid rgba(16,24,38,0.07)",
      boxShadow: "0 18px 50px rgba(16,24,38,0.06)",
      overflow: "hidden",
      backdropFilter: "blur(10px)"
    },
    composerInner: {
      padding: mobile ? 14 : 16,
      display: "flex",
      gap: 10,
      alignItems: "flex-end",
      flexDirection: mobile ? "column" : "row"
    },
    textarea: {
      width: "100%",
      minHeight: 58,
      maxHeight: 180,
      resize: "vertical",
      borderRadius: 18,
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.92)",
      color: "#101826",
      padding: "14px 14px",
      outline: "none",
      lineHeight: 1.5,
      fontSize: 15,
      flex: 1
    },
    sendButton: {
      minWidth: mobile ? "100%" : 100,
      border: "0",
      borderRadius: 16,
      padding: "13px 16px",
      background: "#101826",
      color: "#f5efe6",
      fontWeight: 700,
      cursor: "pointer"
    },
    hint: {
      padding: "0 16px 16px",
      fontSize: 12,
      color: "rgba(16,24,38,0.54)",
      lineHeight: 1.5
    },
    overlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 38, 0.24)",
      backdropFilter: "blur(4px)",
      zIndex: 40
    },
    sheet: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 50,
      background: "rgba(255,255,255,0.96)",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTop: "1px solid rgba(16,24,38,0.08)",
      padding: 16,
      boxShadow: "0 -18px 50px rgba(16,24,38,0.16)",
      display: "grid",
      gap: 12
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: 800,
      letterSpacing: "-0.03em"
    },
    sheetSub: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)"
    },
    sheetSection: {
      display: "grid",
      gap: 8
    },
    sheetButton: {
      width: "100%",
      textAlign: "left",
      borderRadius: 16,
      padding: "12px 14px",
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.88)",
      color: "#101826",
      fontWeight: 600
    },
    proCard: {
      borderRadius: 22,
      padding: 16,
      background: "linear-gradient(180deg, rgba(16,24,38,0.96), rgba(27,37,54,0.96))",
      color: "#f5efe6",
      display: "grid",
      gap: 10
    },
    proTitle: {
      fontSize: 18,
      fontWeight: 800
    },
    proText: {
      color: "rgba(245,239,230,0.74)",
      lineHeight: 1.5,
      fontSize: 14
    },
    proActions: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap"
    },
    proButton: {
      border: "0",
      borderRadius: 16,
      padding: "12px 16px",
      background: "#f5efe6",
      color: "#101826",
      fontWeight: 800,
      cursor: "pointer"
    },
    proSecondary: {
      border: "1px solid rgba(245,239,230,0.16)",
      borderRadius: 16,
      padding: "12px 16px",
      background: "transparent",
      color: "#f5efe6",
      fontWeight: 700,
      cursor: "pointer"
    }
  };
}

export default function Page() {
  const [mobile, setMobile] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const upgradeUrl = process.env.NEXT_PUBLIC_PRO_UPGRADE_URL || "";

  useEffect(() => {
    const update = () => setMobile(window.innerWidth < 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages.slice(-MAX_MESSAGES));
        }
        if (typeof parsed.input === "string") {
          setInput(parsed.input);
        }
      }
    } catch {
      // ignore broken storage
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        messages: messages.slice(-MAX_MESSAGES),
        input
      })
    );
  }, [messages, input, hydrated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const styles = useMemo(() => createStyles(mobile), [mobile]);

  async function sendMessage() {
    if (loading) return;

    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage: Message = {
      id: uid(),
      role: "me",
      text: trimmed,
      time: formatClock()
    };

    const nextMessages = [...messages, userMessage].slice(-MAX_MESSAGES);
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: nextMessages
        })
      });

      const data = await response.json().catch(() => ({}));
      const replyText =
        typeof data?.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : fallbackReply(trimmed);

      const assistantMessage: Message = {
        id: uid(),
        role: "future me",
        text: replyText,
        time: formatClock()
      };

      setMessages((prev) => [...prev, assistantMessage].slice(-MAX_MESSAGES));
    } catch {
      const assistantMessage: Message = {
        id: uid(),
        role: "future me",
        text: fallbackReply(trimmed),
        time: formatClock()
      };

      setMessages((prev) => [...prev, assistantMessage].slice(-MAX_MESSAGES));
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }

  function startOver() {
    window.localStorage.removeItem(STORAGE_KEY);
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setLoading(false);
    setMenuOpen(false);
    setProOpen(false);
    textareaRef.current?.focus();
  }

  async function saveScreenshot() {
    if (!previewRef.current) return;

    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(previewRef.current, {
      backgroundColor: null,
      scale: 2
    });

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });

    if (!blob) return;

    const file = new File([blob], `future-me-${Date.now()}.png`, { type: "image/png" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Future Me Screenshot"
      });
      return;
    }

    const link = document.createElement("a");
    link.download = file.name;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  const openUpgrade = () => {
    setProOpen(true);
    setMenuOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const goPro = () => {
    if (upgradeUrl) {
      window.open(upgradeUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <main style={styles.page}>
      {menuOpen && <div style={styles.overlay} onClick={() => setMenuOpen(false)} />}
      {proOpen && <div style={styles.overlay} onClick={() => setProOpen(false)} />}

      {menuOpen && (
        <div style={styles.sheet}>
          <div>
            <div style={styles.sheetTitle}>Future Me</div>
            <div style={styles.sheetSub}>Quick actions</div>
          </div>

          <div style={styles.sheetSection}>
            <button style={styles.sheetButton} onClick={startOver}>
              Start over
            </button>
            <button
              style={styles.sheetButton}
              onClick={() => {
                void saveScreenshot();
                setMenuOpen(false);
              }}
            >
              Save screenshot
            </button>
            <button style={styles.sheetButton} onClick={openUpgrade}>
              Upgrade to Pro
            </button>
            <button style={styles.sheetButton} onClick={() => setMenuOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {proOpen && (
        <div style={styles.sheet}>
          <div>
            <div style={styles.sheetTitle}>Go Pro</div>
            <div style={styles.sheetSub}>Unlock more generations and cleaner exports</div>
          </div>

          <div style={styles.proCard}>
            <div style={styles.proTitle}>Pro features</div>
            <div style={styles.proText}>
              More generations, saved history, and a smoother export flow.
            </div>
            <div style={styles.proActions}>
              <button style={styles.proButton} onClick={goPro} disabled={!upgradeUrl}>
                {upgradeUrl ? "Upgrade now" : "Add upgrade link"}
              </button>
              <button style={styles.proSecondary} onClick={() => setProOpen(false)}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.shell}>
        <header style={styles.topBar}>
          <button style={styles.iconButton} aria-label="Menu" onClick={() => setMenuOpen(true)}>
            ≡
          </button>

          <div style={styles.topTitle}>
            <div style={styles.brand}>Future Me</div>
            <div style={styles.brandSub}>free-form chat · persistent context</div>
          </div>

          <button style={styles.iconButton} aria-label="Upgrade" onClick={openUpgrade}>
            ⋯
          </button>
        </header>

        <div style={styles.eyebrow}>Continue the conversation</div>

        <section ref={previewRef} style={styles.chatCard}>
          <div style={styles.chatHeader}>
            <div style={styles.chatHeaderLeft}>
              <div style={styles.avatar}>FM</div>
              <div style={styles.chatNameWrap}>
                <div style={styles.chatName}>Future Me</div>
                <div style={styles.chatHint}>private chat · remembers context</div>
              </div>
            </div>

            <div style={styles.chatHeaderRight}>
              <div style={styles.statusChip}>{loading ? "typing..." : "online"}</div>
            </div>
          </div>

          <div style={styles.chatBody}>
            <div style={styles.messages}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    ...styles.row,
                    justifyContent: message.role === "me" ? "flex-end" : "flex-start"
                  }}
                >
                  <div
                    style={{
                      ...styles.bubble,
                      ...(message.role === "me" ? styles.bubbleMe : styles.bubbleFuture)
                    }}
                  >
                    {message.text}
                    <div style={styles.time}>{message.time}</div>
                  </div>
                </div>
              ))}

              {loading && (
                <div style={styles.typingRow}>
                  <div style={styles.typingBubble}>typing…</div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>
        </section>

        <section style={styles.composerCard}>
          <div style={styles.composerInner}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write anything..."
              style={styles.textarea}
            />

            <button style={styles.sendButton} onClick={sendMessage} disabled={loading}>
              {loading ? "Sending..." : "Send"}
            </button>
          </div>

          <div style={styles.hint}>Press Enter to send · Shift+Enter for a new line</div>
        </section>
      </div>
    </main>
  );
}
