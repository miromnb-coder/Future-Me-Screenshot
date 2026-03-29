"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import {
  createClient,
  type SupabaseClient,
  type User
} from "@supabase/supabase-js";

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

const GUEST_KEY = "future-me:guest";
const LAST_EMAIL_KEY = "future-me-email";

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

function draftKey(email?: string | null) {
  return email ? `future-me:${normalizeEmail(email)}` : GUEST_KEY;
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

const hasSupabaseEnv =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

const supabase: SupabaseClient | null = hasSupabaseEnv
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  : null;

function readDraft(key: string): PersistedConversation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedConversation;
    if (!parsed || !Array.isArray(parsed.messages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft(key: string, value: PersistedConversation) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

async function loadDbMessages(client: SupabaseClient, userId: string): Promise<Message[] | null> {
  const { data, error } = await client
    .from("messages")
    .select("id, role, text, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return null;
  }

  const rows = (data ?? []) as MessageRow[];
  return rows.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    time: new Date(m.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    })
  }));
}

export default function Page() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [loginStatus, setLoginStatus] = useState("");

  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [mood, setMood] = useState<Mood>("honest");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const activeDraftKey = useMemo(() => draftKey(user?.email ?? null), [user?.email]);

  useEffect(() => {
    const lastEmail = typeof window !== "undefined" ? window.localStorage.getItem(LAST_EMAIL_KEY) : "";
    if (lastEmail) setEmailInput(lastEmail);

    const guestDraft = readDraft(GUEST_KEY);
    if (guestDraft) {
      if (Array.isArray(guestDraft.messages) && guestDraft.messages.length > 0) setMessages(guestDraft.messages);
      if (typeof guestDraft.input === "string") setInput(guestDraft.input);
      if (guestDraft.mood && ["calm", "honest", "direct", "wise"].includes(guestDraft.mood)) {
        setMood(guestDraft.mood);
      }
    }

    if (!supabase) {
      setReady(true);
      return;
    }

    const hydrate = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);

      if (sessionUser?.email) {
        setEmailInput(sessionUser.email);
        window.localStorage.setItem(LAST_EMAIL_KEY, sessionUser.email);

        const emailDraft = readDraft(draftKey(sessionUser.email));
        if (emailDraft) {
          if (Array.isArray(emailDraft.messages) && emailDraft.messages.length > 0) setMessages(emailDraft.messages);
          if (typeof emailDraft.input === "string") setInput(emailDraft.input);
          if (emailDraft.mood && ["calm", "honest", "direct", "wise"].includes(emailDraft.mood)) {
            setMood(emailDraft.mood);
          }
        }

        const dbMessages = await loadDbMessages(supabase, sessionUser.id);
        if (dbMessages && dbMessages.length > 0) {
          setMessages(dbMessages);
        }
      }

      setReady(true);
    };

    void hydrate();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      if (!sessionUser?.email) {
        const guest = readDraft(GUEST_KEY);
        if (guest?.messages?.length) setMessages(guest.messages);
        if (typeof guest?.input === "string") setInput(guest.input);
        if (guest?.mood && ["calm", "honest", "direct", "wise"].includes(guest.mood)) setMood(guest.mood);
        return;
      }

      window.localStorage.setItem(LAST_EMAIL_KEY, sessionUser.email);
      setEmailInput(sessionUser.email);

      const emailDraft = readDraft(draftKey(sessionUser.email));
      if (emailDraft?.messages?.length) {
        setMessages(emailDraft.messages);
      }

      const dbMessages = await loadDbMessages(supabase, sessionUser.id);
      if (dbMessages && dbMessages.length > 0) {
        setMessages(dbMessages);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const payload: PersistedConversation = {
      messages,
      input,
      mood
    };
    writeDraft(activeDraftKey, payload);

    if (user?.email) {
      window.localStorage.setItem(LAST_EMAIL_KEY, user.email);
    }
  }, [messages, input, mood, user, activeDraftKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, loading]);

  async function signInWithEmail() {
    if (!supabase) {
      setLoginStatus("Supabase env vars are missing.");
      return;
    }

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
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setMessages(readDraft(GUEST_KEY)?.messages?.length ? readDraft(GUEST_KEY)!.messages : [welcomeMessage]);
    setInput(readDraft(GUEST_KEY)?.input ?? "");
    setMood(readDraft(GUEST_KEY)?.mood ?? "honest");
    setShowSaveSheet(false);
    setLoginStatus("");
  }

  async function insertMessage(userId: string, role: Role, text: string) {
    if (!supabase) return;
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
    if (loading) return;

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

      if (user?.id) {
        await insertMessage(user.id, "me", trimmed);
        await insertMessage(user.id, "future me", replyText);
      }
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

      if (user?.id) {
        await insertMessage(user.id, "me", trimmed);
        await insertMessage(user.id, "future me", replyText);
      }
    } finally {
      setLoading(false);
      setTimeout(() => {
        const ta = document.querySelector("textarea");
        ta?.focus();
      }, 0);
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

      {showSaveSheet && <div style={sheetBackdrop} onClick={() => setShowSaveSheet(false)} />}

      {showSaveSheet && (
        <aside style={sheet}>
          <div style={sheetTitle}>Save with email</div>
          <div style={sheetSub}>
            Keep using guest mode if you want. Enter email here to save this chat to your account.
          </div>

          <input
            style={sheetInput}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void signInWithEmail();
              }
            }}
          />

          <button style={sheetPrimary} onClick={() => void signInWithEmail()}>
            Send magic link
          </button>

          <button style={sheetSecondary} onClick={() => setShowSaveSheet(false)}>
            Close
          </button>

          {loginStatus ? <div style={sheetHint}>{loginStatus}</div> : null}
        </aside>
      )}

      <div style={shell}>
        <header style={header}>
          <div style={brandBlock}>
            <div style={brand}>Future Me</div>
            <div style={subtitle}>
              {user?.email ? `saved as ${user.email}` : "guest mode · save with email from inside"}
            </div>
          </div>

          <div style={headerActions}>
            {!user ? (
              <button style={secondaryButton} onClick={() => setShowSaveSheet(true)}>
                Save with email
              </button>
            ) : (
              <button style={secondaryButton} onClick={() => void signOut()}>
                Log out
              </button>
            )}
          </div>
        </header>

        {!user ? (
          <div style={guestBanner}>
            Guest mode is on. You can chat now, and save this conversation later with email.
          </div>
        ) : null}

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
                  style={{
                    ...(message.role === "me" ? myBubble : aiBubble),
                    maxWidth: "82%"
                  }}
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

const guestBanner: CSSProperties = {
  borderRadius: 18,
  padding: "12px 14px",
  background: "rgba(255,255,255,0.62)",
  border: "1px solid rgba(16,24,38,0.08)",
  color: "rgba(16,24,38,0.72)",
  fontSize: 13,
  lineHeight: 1.5
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

const sheetBackdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,38,0.28)",
  backdropFilter: "blur(8px)",
  zIndex: 60
};

const sheet: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 70,
  background: "rgba(255,255,255,0.98)",
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  borderTop: "1px solid rgba(16,24,38,0.08)",
  padding: 16,
  boxShadow: "0 -18px 60px rgba(16,24,38,0.18)",
  display: "grid",
  gap: 12
};

const sheetTitle: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: "-0.04em"
};

const sheetSub: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  color: "rgba(16,24,38,0.62)"
};

const sheetInput: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(16,24,38,0.08)",
  padding: "12px 14px",
  background: "rgba(255,255,255,0.92)",
  fontSize: 15
};

const sheetPrimary: CSSProperties = {
  border: 0,
  borderRadius: 16,
  padding: "12px 16px",
  background: "#101826",
  color: "#f5efe6",
  fontWeight: 800
};

const sheetSecondary: CSSProperties = {
  border: "1px solid rgba(16,24,38,0.08)",
  borderRadius: 16,
  padding: "12px 16px",
  background: "rgba(255,255,255,0.88)",
  color: "#101826",
  fontWeight: 700
};

const sheetHint: CSSProperties = {
  fontSize: 12,
  color: "rgba(16,24,38,0.56)",
  lineHeight: 1.5
};
