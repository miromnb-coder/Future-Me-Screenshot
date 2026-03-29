"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { createClient } from "@supabase/supabase-js";

type Role = "me" | "future me";
type Mood = "calm" | "honest" | "direct" | "wise";

type Message = {
  id: string;
  role: Role;
  text: string;
  time: string;
};

type PersistedConversation = {
  messages: Message[];
  input: string;
  mood: Mood;
};

type AuthUser = {
  id: string;
  email?: string | null;
};

type MessageRow = {
  id: string;
  role: Role;
  text: string;
  created_at: string;
};

const moodLabels: Record<Mood, string> = {
  calm: "Calm",
  honest: "Honest",
  direct: "Direct",
  wise: "Wise"
};

const welcomeMessage: Message = {
  id: "welcome",
  role: "future me",
  text: "Write one thought. I’ll keep the conversation going.",
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

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
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

function buildMemory(messages: Message[], mood: Mood) {
  const recentUserMessages = messages
    .filter((m) => m.role === "me")
    .slice(-4)
    .map((m) => m.text)
    .join(" | ");

  return `Mood: ${mood}. Recent user messages: ${recentUserMessages}`.slice(0, 240);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Page() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [emailInput, setEmailInput] = useState("");
  const [loginStatus, setLoginStatus] = useState("");

  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [mood, setMood] = useState<Mood>("honest");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const draftKey = useMemo(() => {
    const email = normalizeEmail(user?.email ?? emailInput);
    return `future-me:${email || "guest"}`;
  }, [user?.email, emailInput]);

  useEffect(() => {
    const savedEmail = window.localStorage.getItem("future-me-email") || "";
    if (savedEmail) {
      setEmailInput(savedEmail);

      const savedRaw = window.localStorage.getItem(`future-me:${normalizeEmail(savedEmail)}`);
      if (savedRaw) {
        try {
          const parsed = JSON.parse(savedRaw) as PersistedConversation;
          if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
            setMessages(parsed.messages);
          }
          if (typeof parsed.input === "string") {
            setInput(parsed.input);
          }
          if (parsed.mood && ["calm", "honest", "direct", "wise"].includes(parsed.mood)) {
            setMood(parsed.mood);
          }
        } catch {
          setMessages([welcomeMessage]);
        }
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user;
      if (sessionUser) {
        setUser({ id: sessionUser.id, email: sessionUser.email });
      }
      setReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user;
      if (sessionUser) {
        setUser({ id: sessionUser.id, email: sessionUser.email });
      } else {
        setUser(null);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const payload: PersistedConversation = {
      messages,
      input,
      mood
    };

    window.localStorage.setItem(draftKey, JSON.stringify(payload));
    window.localStorage.setItem("future-me-email", user.email ?? "");
  }, [messages, input, mood, user, draftKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, loading]);

  async function loadMessagesForUser(userId: string) {
    const { data, error } = await supabase
      .from("messages")
      .select("id, role, text, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    const loaded = (data ?? []).map((m: MessageRow) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      time: new Date(m.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })
    }));

    setMessages(loaded.length > 0 ? loaded : [welcomeMessage]);
  }

  useEffect(() => {
    if (!user) return;
    void loadMessagesForUser(user.id);
  }, [user]);

  async function signIn() {
    const email = normalizeEmail(emailInput);
    if (!email) return;

    setLoginStatus("Sending magic link...");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/`
      }
    });

    if (error) {
      setLoginStatus(error.message);
      return;
    }

    setLoginStatus("Check your email for the sign-in link.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setMessages([welcomeMessage]);
    setInput("");
    setMood("honest");
    setLoginStatus("");
    window.localStorage.removeItem("future-me-email");
  }

  async function insertMessage(userId: string, role: Role, text: string) {
    const { error } = await supabase.from("messages").insert({
      user_id: userId,
      role,
      text
    });

    if (error) {
      console.error(error);
    }
  }

  async function sendMessage() {
    if (!user || loading) return;

    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage: Message = {
      id: uid(),
      role: "me",
      text: trimmed,
      time: formatClock()
    };

    const nextMessages = [...messages, userMessage].slice(-50);
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    const startedAt = Date.now();
    const memory = buildMemory(nextMessages, mood);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          mood,
          isPro: false,
          memory
        })
      });

      const data = await response.json().catch(() => ({}));
      const lastAssistant = [...messages].reverse().find((m) => m.role === "future me")?.text ?? "";
      const replyText =
        typeof data?.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : fallbackReply(trimmed, mood, lastAssistant);

      const remaining = Math.max(0, 850 - (Date.now() - startedAt));
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      const assistantMessage: Message = {
        id: uid(),
        role: "future me",
        text: replyText,
        time: formatClock()
      };

      setMessages((prev) => [...prev, assistantMessage].slice(-50));

      await insertMessage(user.id, "me", trimmed);
      await insertMessage(user.id, "future me", replyText);
    } catch {
      const remaining = Math.max(0, 850 - (Date.now() - startedAt));
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      const replyText = fallbackReply(trimmed, mood);
      const assistantMessage: Message = {
        id: uid(),
        role: "future me",
        text: replyText,
        time: formatClock()
      };

      setMessages((prev) => [...prev, assistantMessage].slice(-50));

      await insertMessage(user.id, "me", trimmed);
      await insertMessage(user.id, "future me", replyText);
    } finally {
      setLoading(false);
      setTimeout(() => {
        const ta = document.querySelector("textarea");
        ta?.focus();
      }, 0);
    }
  }

  async function shareConversation() {
    const text = messages
      .map((m) => `${m.role === "me" ? "You" : "Future Me"}: ${m.text}`)
      .join("\n\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Future Me",
          text
        });
        return;
      }

      await navigator.clipboard.writeText(text);
      alert("Conversation copied.");
    } catch {
      alert("Could not share.");
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  if (!ready) {
    return (
      <main style={loginPage}>
        <section style={loginCard}>
          <div style={loginTitle}>Future Me</div>
          <div style={loginSub}>Loading...</div>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={loginPage}>
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
            width: 100%;
            height: 100%;
            background: linear-gradient(180deg, #f4efe7 0%, #ebe4d8 100%);
            color: #101826;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          body {
            overflow: hidden;
          }

          button,
          textarea,
          input {
            font: inherit;
          }

          button {
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
          }

          input {
            outline: none;
          }
        `}</style>

        <section style={loginCard}>
          <div style={loginTitle}>Future Me</div>
          <div style={loginSub}>Enter your email to get a magic link.</div>

          <input
            style={loginInput}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void signIn();
              }
            }}
          />

          <button style={loginButton} onClick={() => void signIn()}>
            Send magic link
          </button>

          {loginStatus ? <div style={loginHint}>{loginStatus}</div> : null}
        </section>
      </main>
    );
  }

  return (
    <main style={page}>
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
          width: 100%;
          height: 100%;
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
          overflow: hidden;
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
      `}</style>

      <div style={shell}>
        <header style={header}>
          <div style={brandBlock}>
            <div style={brand}>Future Me</div>
            <div style={subtitle}>signed in as {user.email}</div>
          </div>

          <div style={headerActions}>
            <button style={secondaryButton} onClick={() => void shareConversation()}>
              Share
            </button>
            <button style={secondaryButton} onClick={() => void signOut()}>
              Log out
            </button>
          </div>
        </header>

        <div style={moodRow}>
          {(Object.keys(moodLabels) as Mood[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMood(item)}
              style={item === mood ? moodActive : moodButton}
            >
              {moodLabels[item]}
            </button>
          ))}
        </div>

        <section style={threadCard}>
          <div style={threadHeader}>
            <div style={threadLeft}>
              <div style={avatar}>FM</div>
              <div>
                <div style={threadName}>Future Me</div>
                <div style={threadMeta}>private chat · persistent memory</div>
              </div>
            </div>

            <div style={liveChip}>
              <span style={liveDot} />
              {loading ? "typing..." : "ready"}
            </div>
          </div>

          <div ref={threadRef} style={threadBody}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  justifyContent: message.role === "me" ? "flex-end" : "flex-start",
                  width: "100%",
                  animation: "floatIn 220ms ease both"
                }}
              >
                <div
                  style={
                    message.role === "me"
                      ? {
                          ...myBubble,
                          maxWidth: "82%"
                        }
                      : {
                          ...aiBubble,
                          maxWidth: "82%"
                        }
                  }
                >
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{message.text}</div>
                  <div style={timeStyle}>{message.time}</div>
                </div>
              </div>
            ))}

            {loading ? <div style={typing}>typing…</div> : null}
            <div ref={bottomRef} />
          </div>
        </section>

        <section style={composer}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write anything..."
            rows={1}
            style={composerInput}
          />

          <button style={sendButton} onClick={() => void sendMessage()} disabled={loading}>
            {loading ? "Sending..." : "Send"}
          </button>
        </section>
      </div>
    </main>
  );
}

const loginPage: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 16,
  background: "linear-gradient(180deg, #f4efe7 0%, #ebe4d8 100%)",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
};

const loginCard: CSSProperties = {
  width: "min(520px, 100%)",
  padding: 22,
  borderRadius: 26,
  background: "rgba(255,255,255,0.78)",
  border: "1px solid rgba(16,24,38,0.08)",
  boxShadow: "0 22px 60px rgba(16,24,38,0.08)",
  display: "grid",
  gap: 12
};

const loginTitle: CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  letterSpacing: "-0.04em"
};

const loginSub: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
  color: "rgba(16,24,38,0.58)"
};

const loginInput: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(16,24,38,0.08)",
  padding: "14px 14px",
  background: "rgba(255,255,255,0.92)",
  fontSize: 15
};

const loginButton: CSSProperties = {
  border: 0,
  borderRadius: 18,
  padding: "14px 16px",
  background: "#101826",
  color: "#f5efe6",
  fontWeight: 800
};

const loginHint: CSSProperties = {
  fontSize: 12,
  color: "rgba(16,24,38,0.52)"
};

const page: CSSProperties = {
  minHeight: "100vh",
  padding: 16,
  background:
    "radial-gradient(circle at top left, rgba(255,255,255,0.70), transparent 24%), radial-gradient(circle at top right, rgba(255,255,255,0.28), transparent 20%), linear-gradient(180deg, #f4efe7 0%, #ebe4d8 100%)",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  display: "grid",
  gap: 12
};

const shell: CSSProperties = {
  maxWidth: 860,
  margin: "0 auto",
  width: "100%",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  gap: 12
};

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12
};

const brandBlock: CSSProperties = {
  display: "grid",
  gap: 2
};

const brand: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: "-0.04em"
};

const subtitle: CSSProperties = {
  fontSize: 12,
  color: "rgba(16,24,38,0.56)"
};

const headerActions: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap"
};

const secondaryButton: CSSProperties = {
  border: "1px solid rgba(16,24,38,0.08)",
  borderRadius: 16,
  padding: "12px 14px",
  background: "rgba(255,255,255,0.78)"
};

const moodRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8
};

const moodButton: CSSProperties = {
  border: "1px solid rgba(16,24,38,0.08)",
  borderRadius: 999,
  padding: "9px 13px",
  background: "rgba(255,255,255,0.72)"
};

const moodActive: CSSProperties = {
  ...moodButton,
  background: "#101826",
  color: "#f5efe6",
  borderColor: "#101826"
};

const threadCard: CSSProperties = {
  flex: 1,
  minHeight: 0,
  borderRadius: 28,
  background: "rgba(255,255,255,0.65)",
  border: "1px solid rgba(16,24,38,0.08)",
  boxShadow: "0 22px 60px rgba(16,24,38,0.08)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column"
};

const threadBody: CSSProperties = {
  flex: 1,
  minHeight: 0,
  padding: 16,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  display: "flex",
  flexDirection: "column",
  gap: 10
};

const threadHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: 16,
  borderBottom: "1px solid rgba(16,24,38,0.06)",
  background: "rgba(255,255,255,0.34)"
};

const threadLeft: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12
};

const avatar: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 999,
  background: "linear-gradient(135deg, #101826, #1f2b3d)",
  color: "#f5efe6",
  display: "grid",
  placeItems: "center",
  fontSize: 14,
  fontWeight: 800
};

const threadName: CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: "-0.03em"
};

const threadMeta: CSSProperties = {
  fontSize: 12,
  color: "rgba(16,24,38,0.56)"
};

const liveChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(16,24,38,0.05)",
  border: "1px solid rgba(16,24,38,0.06)",
  fontSize: 12,
  color: "rgba(16,24,38,0.7)"
};

const liveDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "#4caf7a",
  boxShadow: "0 0 0 5px rgba(76,175,122,0.16)"
};

const myBubble: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 26,
  background: "linear-gradient(180deg, #101826, #141f2f)",
  color: "#f5efe6",
  boxShadow: "0 12px 24px rgba(16,24,38,0.12)"
};

const aiBubble: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 26,
  background: "rgba(16,24,38,0.06)",
  color: "#101826"
};

const timeStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  opacity: 0.55
};

const typing: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 20,
  background: "rgba(16,24,38,0.05)",
  width: "fit-content"
};

const composer: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-end",
  padding: 14,
  borderRadius: 24,
  background: "rgba(255,255,255,0.72)",
  border: "1px solid rgba(16,24,38,0.08)",
  boxShadow: "0 12px 30px rgba(16,24,38,0.06)"
};

const composerInput: CSSProperties = {
  flex: 1,
  minHeight: 58,
  maxHeight: 160,
  resize: "none",
  borderRadius: 20,
  border: "1px solid rgba(16,24,38,0.08)",
  padding: "14px 14px",
  background: "rgba(255,255,255,0.88)",
  fontSize: 15
};

const sendButton: CSSProperties = {
  border: 0,
  borderRadius: 20,
  padding: "14px 16px",
  background: "#101826",
  color: "#f5efe6",
  fontWeight: 800,
  minWidth: 96
};
