"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

type Role = "me" | "future me";
type Mood = "calm" | "honest" | "direct" | "wise";

type Message = {
  id: string;
  role: Role;
  text: string;
  time: string;
};

type PersistedState = {
  messages: Message[];
  input: string;
  mood: Mood;
};

const STORAGE_KEY = "future-me-ui-v4";
const MAX_MESSAGES = 50;

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "future me",
  text: "Write one thought. I’ll keep the conversation going.",
  time: "now"
};

const moodLabels: Record<Mood, string> = {
  calm: "Calm",
  honest: "Honest",
  direct: "Direct",
  wise: "Wise"
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

function fallbackReply(latestUserText: string, mood: Mood, lastAssistantText = "") {
  const seed = `${latestUserText}|${lastAssistantText}|${mood}`;
  const isFinnish = looksFinnish(seed);

  const sets: Record<Mood, { en: string[]; fi: string[] }> = {
    calm: {
      en: [
        "Pause first. You do not need to solve it in one move.",
        "The answer is usually quieter than the fear around it.",
        "You are closer to clarity than it feels."
      ],
      fi: [
        "Pysähdy ensin. Tätä ei tarvitse ratkaista yhdellä liikkeellä.",
        "Vastaus on yleensä hiljaisempi kuin sen ympärillä oleva pelko.",
        "Olet lähempänä selkeyttä kuin miltä tuntuu."
      ]
    },
    honest: {
      en: [
        "You are not really asking for information. You are asking for permission.",
        "The cost matters more than the option itself.",
        "You already know the direction. You are checking whether it is allowed."
      ],
      fi: [
        "Et taida hakea pelkkää vastausta. Haluat että päätös tuntuisi vähemmän raskaalta.",
        "Hinta taitaa olla tärkeämpi kuin itse vaihtoehto.",
        "Suunta on sinulla jo. Tarkistat vain, onko se muka sallittu."
      ]
    },
    direct: {
      en: [
        "This is simpler than it feels. Decide, then move.",
        "The hesitation is the real problem, not the choice.",
        "You already have enough information."
      ],
      fi: [
        "Tämä on yksinkertaisempi kuin miltä tuntuu. Päätä ja liiku.",
        "Epäröinti on varsinainen ongelma, ei valinta.",
        "Sinulla on jo riittävästi tietoa."
      ]
    },
    wise: {
      en: [
        "The real question is what this changes, not whether it works.",
        "You are trying to protect the future version of yourself from a consequence.",
        "The hidden cost is usually the part worth paying attention to."
      ],
      fi: [
        "Oikea kysymys ei ehkä ole onnistuuko tämä, vaan mitä tämä muuttaa.",
        "Yrität suojella tulevaa itseäsi seuraukselta.",
        "Piilohinta on yleensä se kohta, johon kannattaa kiinnittää huomiota."
      ]
    }
  };

  const source = isFinnish ? sets[mood].fi : sets[mood].en;
  const score = [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return source[Math.abs(score) % source.length];
}

function roleClass(role: Role) {
  return role === "me" ? "me" : "future-me";
}

function createStyles(mobile: boolean): Record<string, CSSProperties> {
  return {
    page: {
      minHeight: "100vh",
      padding: mobile ? 10 : 16,
      background:
        "radial-gradient(circle at top left, rgba(255,255,255,0.70), transparent 24%), radial-gradient(circle at top right, rgba(255,255,255,0.28), transparent 20%), linear-gradient(180deg, #f4efe7 0%, #ebe4d8 100%)",
      color: "#101826",
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflowX: "hidden"
    },
    shell: {
      maxWidth: 860,
      margin: "0 auto",
      display: "grid",
      gap: 12,
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
      backdropFilter: "blur(16px)",
      background: "linear-gradient(180deg, rgba(244,239,231,0.96), rgba(244,239,231,0.80))"
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
      letterSpacing: "-0.035em"
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
    statusRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      alignItems: "center"
    },
    pill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid rgba(16,24,38,0.06)",
      background: "rgba(255,255,255,0.52)",
      color: "rgba(16,24,38,0.72)",
      fontSize: 12,
      letterSpacing: "0.01em",
      backdropFilter: "blur(12px)"
    },
    pillAction: {
      border: "1px solid rgba(16,24,38,0.06)",
      background: "rgba(255,255,255,0.66)",
      color: "#101826",
      padding: "8px 12px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600
    },
    moodRow: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    },
    moodButton: {
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.68)",
      color: "#101826",
      padding: "9px 13px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600
    },
    moodButtonActive: {
      border: "1px solid rgba(16,24,38,0.10)",
      background: "#101826",
      color: "#f5efe6",
      padding: "9px 13px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700
    },
    threadCard: {
      borderRadius: 30,
      background: "rgba(255,255,255,0.62)",
      border: "1px solid rgba(16,24,38,0.07)",
      boxShadow: "0 22px 60px rgba(16,24,38,0.08)",
      overflow: "hidden",
      backdropFilter: "blur(18px)"
    },
    threadHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: 16,
      borderBottom: "1px solid rgba(16,24,38,0.06)",
      background: "rgba(255,255,255,0.34)",
      backdropFilter: "blur(10px)"
    },
    threadLeft: {
      display: "flex",
      alignItems: "center",
      gap: 12
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 999,
      background: "linear-gradient(135deg, #101826, #1f2b3d)",
      color: "#f5efe6",
      display: "grid",
      placeItems: "center",
      fontSize: 14,
      fontWeight: 800,
      boxShadow: "0 10px 18px rgba(16,24,38,0.14)"
    },
    threadText: {
      display: "flex",
      flexDirection: "column",
      gap: 2
    },
    threadName: {
      fontSize: 16,
      fontWeight: 800,
      letterSpacing: "-0.03em"
    },
    threadMeta: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)"
    },
    liveChip: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(16,24,38,0.05)",
      border: "1px solid rgba(16,24,38,0.06)",
      fontSize: 12,
      color: "rgba(16,24,38,0.7)"
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: "#4caf7a",
      boxShadow: "0 0 0 5px rgba(76,175,122,0.16)"
    },
    threadBody: {
      padding: 16,
      minHeight: mobile ? 520 : 640,
      display: "flex",
      flexDirection: "column",
      gap: 10
    },
    stream: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      flex: 1
    },
    messageRow: {
      display: "flex",
      animation: "floatIn 220ms ease both"
    },
    meRow: {
      justifyContent: "flex-end"
    },
    futureMeRow: {
      justifyContent: "flex-start"
    },
    messageBubble: {
      maxWidth: mobile ? "86%" : "72%",
      padding: "14px 16px",
      borderRadius: 26,
      fontSize: 14,
      lineHeight: 1.6,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      letterSpacing: "-0.005em",
      position: "relative",
      width: "fit-content",
      overflowWrap: "break-word"
    },
    meBubble: {
      background: "linear-gradient(180deg, #101826, #141f2f)",
      color: "#f5efe6",
      boxShadow: "0 12px 24px rgba(16,24,38,0.12)",
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderBottomLeftRadius: 26,
      borderBottomRightRadius: 16
    },
    futureMeBubble: {
      background: "rgba(16,24,38,0.06)",
      color: "#101826",
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 26
    },
    timestamp: {
      marginTop: 6,
      fontSize: 11,
      color: "rgba(16,24,38,0.52)"
    },
    typingRow: {
      display: "flex",
      justifyContent: "flex-start",
      animation: "floatIn 180ms ease both"
    },
    typingBubble: {
      padding: "12px 14px",
      borderRadius: 26,
      background: "rgba(16,24,38,0.05)",
      color: "rgba(16,24,38,0.58)",
      fontSize: 14,
      letterSpacing: "0.02em",
      animation: "pulse 1.3s ease-in-out infinite"
    },
    composerShell: {
      position: "sticky",
      bottom: 14,
      zIndex: 10,
      borderRadius: 28,
      background: "rgba(255,255,255,0.72)",
      border: "1px solid rgba(16,24,38,0.07)",
      boxShadow: "0 20px 54px rgba(16,24,38,0.08)",
      backdropFilter: "blur(18px)",
      overflow: "hidden"
    },
    composerRow: {
      display: "flex",
      gap: 10,
      alignItems: "flex-end",
      padding: 14,
      flexDirection: mobile ? "column" : "row"
    },
    composerTextarea: {
      flex: 1,
      width: "100%",
      minHeight: 58,
      maxHeight: 180,
      resize: "none",
      borderRadius: 26,
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.88)",
      color: "#101826",
      padding: "15px 14px",
      lineHeight: 1.55,
      fontSize: 15,
      outline: "none",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.72)",
      transition: "border-color 160ms ease, box-shadow 160ms ease"
    },
    sendButton: {
      minWidth: mobile ? "100%" : 104,
      border: 0,
      borderRadius: 26,
      padding: "14px 16px",
      background: "linear-gradient(180deg, #101826, #1b2636)",
      color: "#f5efe6",
      fontWeight: 700,
      boxShadow: "0 12px 22px rgba(16,24,38,0.16)"
    },
    helper: {
      padding: "0 16px 16px",
      fontSize: 12,
      color: "rgba(16,24,38,0.54)",
      lineHeight: 1.5
    },
    sheetBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,38,0.24)",
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
      marginTop: 3,
      fontSize: 12,
      color: "rgba(16,24,38,0.56)"
    },
    sheetGroup: {
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
    }
  };
}

export default function Page() {
  const [mobile, setMobile] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [mood, setMood] = useState<Mood>("honest");
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

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
        if (parsed.mood && ["calm", "honest", "direct", "wise"].includes(parsed.mood)) {
          setMood(parsed.mood as Mood);
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
        input,
        mood
      } satisfies PersistedState)
    );
  }, [messages, input, mood, hydrated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
  }, [input]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, mood })
      });

      const data = await response.json().catch(() => ({}));
      const lastAssistant = [...messages].reverse().find((m) => m.role === "future me")?.text ?? "";
      const replyText =
        typeof data?.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : fallbackReply(trimmed, mood, lastAssistant);

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
        text: fallbackReply(trimmed, mood),
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
    setMood("honest");
    setLoading(false);
    setMenuOpen(false);
    setFocusMode(false);
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

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <main className={`fmApp ${focusMode ? "focusMode" : ""}`}>
      <style jsx global>{`
        :root {
          color-scheme: light;
        }

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          min-height: 100%;
          background:
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.70), transparent 24%),
            radial-gradient(circle at top right, rgba(255, 255, 255, 0.28), transparent 20%),
            linear-gradient(180deg, #f4efe7 0%, #ebe4d8 100%);
          color: #101826;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        body {
          overflow-x: hidden;
        }

        button,
        textarea {
          font: inherit;
        }

        button {
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        textarea {
          outline: none;
        }

        ::selection {
          background: rgba(16, 24, 38, 0.14);
          color: #101826;
        }

        .fmApp {
          position: relative;
          min-height: 100vh;
          padding: 14px 14px 18px;
          overflow: hidden;
        }

        .scene {
          position: fixed;
          pointer-events: none;
          z-index: 0;
          filter: blur(60px);
          opacity: 0.5;
        }

        .sceneOne {
          width: 360px;
          height: 360px;
          left: -120px;
          top: -120px;
          background: rgba(255, 255, 255, 0.55);
        }

        .sceneTwo {
          width: 460px;
          height: 460px;
          right: -180px;
          top: 120px;
          background: rgba(191, 161, 118, 0.23);
        }

        .sceneThree {
          width: 400px;
          height: 400px;
          left: 25%;
          bottom: -220px;
          background: rgba(134, 163, 174, 0.16);
        }

        .frame {
          position: relative;
          z-index: 1;
          max-width: 860px;
          margin: 0 auto;
          display: grid;
          gap: 12px;
          padding-bottom: 18px;
        }

        .topBar {
          position: sticky;
          top: 0;
          z-index: 12;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 2px 12px;
          backdrop-filter: blur(16px);
          background: linear-gradient(180deg, rgba(244, 239, 231, 0.96), rgba(244, 239, 231, 0.80));
        }

        .actionButton {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          border: 1px solid rgba(16, 24, 38, 0.08);
          background: rgba(255, 255, 255, 0.78);
          color: #101826;
          display: grid;
          place-items: center;
          cursor: pointer;
          box-shadow: 0 12px 26px rgba(16, 24, 38, 0.05);
          transition:
            transform 180ms ease,
            background 180ms ease,
            box-shadow 180ms ease;
        }

        .actionButton:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.88);
          box-shadow: 0 16px 30px rgba(16, 24, 38, 0.08);
        }

        .brandBlock {
          flex: 1;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 2px;
          align-items: center;
        }

        .brandTitle {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.035em;
        }

        .brandSub {
          font-size: 12px;
          color: rgba(16, 24, 38, 0.56);
          transition: opacity 180ms ease, transform 180ms ease;
        }

        .statusRow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(16, 24, 38, 0.06);
          background: rgba(255, 255, 255, 0.52);
          color: rgba(16, 24, 38, 0.72);
          font-size: 12px;
          letter-spacing: 0.01em;
          backdrop-filter: blur(12px);
        }

        .pillAction {
          border: 1px solid rgba(16, 24, 38, 0.06);
          background: rgba(255, 255, 255, 0.66);
          color: #101826;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }

        .moodRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .moodButton {
          border: 1px solid rgba(16, 24, 38, 0.08);
          background: rgba(255, 255, 255, 0.68);
          color: #101826;
          padding: 9px 13px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }

        .moodButtonActive {
          border: 1px solid rgba(16, 24, 38, 0.10);
          background: #101826;
          color: #f5efe6;
          padding: 9px 13px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
        }

        .threadCard {
          border-radius: 30px;
          background: rgba(255, 255, 255, 0.62);
          border: 1px solid rgba(16, 24, 38, 0.07);
          box-shadow: 0 22px 60px rgba(16, 24, 38, 0.08);
          overflow: hidden;
          backdrop-filter: blur(18px);
        }

        .threadHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid rgba(16, 24, 38, 0.06);
          background: rgba(255, 255, 255, 0.34);
          backdrop-filter: blur(10px);
        }

        .threadLeft {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          background: linear-gradient(135deg, #101826, #1f2b3d);
          color: #f5efe6;
          display: grid;
          place-items: center;
          font-size: 14px;
          font-weight: 800;
          box-shadow: 0 10px 18px rgba(16, 24, 38, 0.14);
        }

        .threadText {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .threadName {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .threadMeta {
          font-size: 12px;
          color: rgba(16, 24, 38, 0.56);
        }

        .liveChip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(16, 24, 38, 0.05);
          border: 1px solid rgba(16, 24, 38, 0.06);
          font-size: 12px;
          color: rgba(16, 24, 38, 0.7);
        }

        .liveDot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #4caf7a;
          box-shadow: 0 0 0 5px rgba(76, 175, 122, 0.16);
        }

        .threadBody {
          padding: 16px;
          min-height: clamp(540px, 64vh, 760px);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .stream {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
        }

        .messageRow {
          display: flex;
          animation: floatIn 220ms ease both;
        }

        .messageRow.me {
          justify-content: flex-end;
        }

        .messageRow.future-me {
          justify-content: flex-start;
        }

        .messageBubble {
          max-width: min(82%, 560px);
          padding: 14px 16px;
          border-radius: 26px;
          font-size: 14px;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
          letter-spacing: -0.005em;
          position: relative;
          width: fit-content;
          overflow-wrap: break-word;
        }

        .messageBubble.me {
          background: linear-gradient(180deg, #101826, #141f2f);
          color: #f5efe6;
          box-shadow: 0 12px 24px rgba(16, 24, 38, 0.12);
          border-top-left-radius: 26px;
          border-top-right-radius: 26px;
          border-bottom-left-radius: 26px;
          border-bottom-right-radius: 16px;
        }

        .messageBubble.future-me {
          background: rgba(16, 24, 38, 0.06);
          color: #101826;
          border-top-left-radius: 26px;
          border-top-right-radius: 26px;
          border-bottom-left-radius: 16px;
          border-bottom-right-radius: 26px;
        }

        .timestamp {
          margin-top: 6px;
          font-size: 11px;
          color: rgba(16, 24, 38, 0.52);
        }

        .typingRow {
          display: flex;
          justify-content: flex-start;
          animation: floatIn 180ms ease both;
        }

        .typingBubble {
          padding: 12px 14px;
          border-radius: 26px;
          background: rgba(16, 24, 38, 0.05);
          color: rgba(16, 24, 38, 0.58);
          font-size: 14px;
          letter-spacing: 0.02em;
          animation: pulse 1.3s ease-in-out infinite;
        }

        .composerShell {
          position: sticky;
          bottom: 14px;
          z-index: 10;
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(16, 24, 38, 0.07);
          box-shadow: 0 20px 54px rgba(16, 24, 38, 0.08);
          backdrop-filter: blur(18px);
          overflow: hidden;
        }

        .composerRow {
          display: flex;
          gap: 10px;
          align-items: flex-end;
          padding: 14px;
          flex-direction: row;
        }

        .composerTextarea {
          flex: 1;
          min-height: 58px;
          max-height: 180px;
          resize: none;
          border-radius: 26px;
          border: 1px solid rgba(16, 24, 38, 0.08);
          background: rgba(255, 255, 255, 0.88);
          color: #101826;
          padding: 15px 14px;
          line-height: 1.55;
          font-size: 15px;
          outline: none;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }

        .composerTextarea:focus {
          border-color: rgba(16, 24, 38, 0.16);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.72),
            0 0 0 4px rgba(16, 24, 38, 0.06);
        }

        .sendButton {
          min-width: 104px;
          border: 0;
          border-radius: 26px;
          padding: 14px 16px;
          background: linear-gradient(180deg, #101826, #1b2636);
          color: #f5efe6;
          font-weight: 700;
          box-shadow: 0 12px 22px rgba(16, 24, 38, 0.16);
        }

        .helper {
          padding: 0 16px 16px;
          font-size: 12px;
          color: rgba(16, 24, 38, 0.54);
          line-height: 1.5;
        }

        .sheetBackdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 38, 0.24);
          backdrop-filter: blur(4px);
          z-index: 40;
        }

        .sheet {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 50;
          background: rgba(255, 255, 255, 0.96);
          border-top-left-radius: 24px;
          border-top-right-radius: 24px;
          border-top: 1px solid rgba(16, 24, 38, 0.08);
          padding: 16px;
          box-shadow: 0 -18px 50px rgba(16, 24, 38, 0.16);
          display: grid;
          gap: 12px;
        }

        .sheetTitle {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .sheetSub {
          margin-top: 3px;
          font-size: 12px;
          color: rgba(16, 24, 38, 0.56);
        }

        .sheetGroup {
          display: grid;
          gap: 8px;
        }

        .sheetButton {
          width: 100%;
          text-align: left;
          border-radius: 16px;
          padding: 12px 14px;
          border: 1px solid rgba(16, 24, 38, 0.08);
          background: rgba(255, 255, 255, 0.88);
          color: #101826;
          font-weight: 600;
        }

        .focusMode .brandSub {
          opacity: 0.3;
        }

        .focusMode .threadCard {
          box-shadow: 0 18px 46px rgba(16, 24, 38, 0.06);
        }

        .focusMode .composerShell {
          background: rgba(255, 255, 255, 0.8);
        }

        @keyframes floatIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.99);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 0.45;
          }
          50% {
            opacity: 1;
          }
        }

        @media (max-width: 900px) {
          .fmApp {
            padding: 10px 10px 14px;
          }

          .frame {
            gap: 12px;
          }

          .brandTitle {
            font-size: 17px;
          }

          .threadBody {
            min-height: 520px;
          }

          .composerRow {
            flex-direction: column;
            align-items: stretch;
          }

          .sendButton {
            width: 100%;
            min-width: 0;
          }

          .messageBubble {
            max-width: 88%;
          }
        }
      `}</style>

      {menuOpen && <div className="sheetBackdrop" onClick={() => setMenuOpen(false)} />}

      {menuOpen && (
        <aside className="sheet">
          <div>
            <div className="sheetTitle">Future Me</div>
            <div className="sheetSub">Quick actions</div>
          </div>

          <div className="sheetGroup">
            <button className="sheetButton" onClick={startOver}>
              Start over
            </button>
            <button
              className="sheetButton"
              onClick={() => {
                void saveScreenshot();
                setMenuOpen(false);
              }}
            >
              Save screenshot
            </button>
            <button className="sheetButton" onClick={() => setFocusMode((v) => !v)}>
              {focusMode ? "Exit focus mode" : "Focus mode"}
            </button>
            <button className="sheetButton" onClick={() => setMenuOpen(false)}>
              Close
            </button>
          </div>
        </aside>
      )}

      <div className="frame">
        <header className="topBar">
          <button className="actionButton" aria-label="Menu" onClick={() => setMenuOpen(true)}>
            ≡
          </button>

          <div className="brandBlock">
            <div className="brandTitle">Future Me</div>
            <div className="brandSub">free-form chat · persistent context</div>
          </div>

          <button className="actionButton" aria-label="Menu" onClick={() => setMenuOpen(true)}>
            ⋯
          </button>
        </header>

        <div className="statusRow">
          <span className="pill">
            <span
              className="liveDot"
              style={{ width: 7, height: 7, boxShadow: "none", background: "#4caf7a" }}
            />
            online
          </span>
          <span className="pill">remembers context</span>
          <button className="pillAction" type="button" onClick={() => setFocusMode((v) => !v)}>
            {focusMode ? "Exit focus mode" : "Focus mode"}
          </button>
        </div>

        <div className="moodRow">
          {(Object.keys(moodLabels) as Mood[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMood(item)}
              className={item === mood ? "moodButtonActive" : "moodButton"}
            >
              {moodLabels[item]}
            </button>
          ))}
        </div>

        <section ref={previewRef} className="threadCard">
          <div className="threadHeader">
            <div className="threadLeft">
              <div className="avatar">FM</div>
              <div className="threadText">
                <div className="threadName">Future Me</div>
                <div className="threadMeta">private chat · feels continuous</div>
              </div>
            </div>

            <div className="liveChip">
              <span className="liveDot" />
              {loading ? "typing..." : "ready"}
            </div>
          </div>

          <div className="threadBody">
            <div className="stream">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`messageRow ${message.role === "me" ? "me" : "future-me"}`}
                >
                  <div className={`messageBubble ${message.role === "me" ? "me" : "future-me"}`}>
                    {message.text}
                    <div className="timestamp">{message.time}</div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="typingRow">
                  <div className="typingBubble">typing…</div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>
        </section>

        <section className="composerShell">
          <div className="composerRow">
            <textarea
              ref={textareaRef}
              className="composerTextarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write anything..."
              rows={1}
            />

            <button className="sendButton" onClick={() => void sendMessage()} disabled={loading}>
              {loading ? "Sending..." : "Send"}
            </button>
          </div>

          <div className="helper">Press Enter to send · Shift+Enter for a new line</div>
        </section>
      </div>
    </main>
  );
}
