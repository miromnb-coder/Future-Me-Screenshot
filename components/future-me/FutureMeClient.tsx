"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ChangeEvent,
  KeyboardEvent,
  UIEvent,
} from "react";

import {
  buildInsights,
  buildMemoryPrompt,
  buildMemorySummary,
  buildTimeContext,
  defaultUsage,
  fallbackReply,
  formatClock,
  FREE_LIMIT,
  loadDraft,
  MAX_MESSAGES,
  MEMORY_SUMMARY_KEY,
  MIN_REPLY_DELAY_MS,
  normalizeUsage,
  profileToDraftKey,
  profileToMemoryKey,
  saveDraft,
  STORAGE_KEY,
  todayKey,
  uid,
  vibrate,
  WELCOME_MESSAGE,
  type Message,
  type Mood,
  type Role,
  type Usage,
  type ViewTab,
} from "@/lib/futureMe";

// Components
import { TopBar } from "./TopBar";
import { QuickActionsMenu, type QuickActionItem } from "./QuickActionsMenu";
import { HeroSection } from "./HeroSection";
import { StatusRow } from "./StatusRow";
import { MemoryCard } from "./MemoryCard";
import { MoodSelector } from "./MoodSelector";
import { AiStatusPanel } from "./AiStatusPanel";
import { ChatThread } from "./ChatThread";
import { ComposerBox } from "./ComposerBox";
import { InsightsView } from "./InsightsView";
import { SaveSheet, PaywallSheet, FocusMode } from "./Sheets";

// Hooks
import {
  useMobile,
  useVoiceInput,
  useSpeech,
  useFutureMeAuth,
  saveCloudTurn,
  callMemorySearch,
  ingestMemory,
} from "./hooks";

// Styles
import { createStyles, searchThemes } from "./styles";

const accentMap: Record<Mood, string> = {
  calm: "#60a5fa",
  honest: "#fb923c",
  direct: "#34d399",
  wise: "#a78bfa",
};

export default function FutureMeClient() {
  // Viewport & Mobile detection
  const { mobile, width: viewportWidth, height: viewportHeight } = useMobile();

  // Core state
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [mood, setMood] = useState<Mood>("honest");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [memorySummary, setMemorySummary] = useState("");
  const [retrievedMemories, setRetrievedMemories] = useState<string[]>([]);

  // UI state
  const [menuOpen, setMenuOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>("chat");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [memoryPulse, setMemoryPulse] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    messageId: string;
    text: string;
    role: Role;
    x: number;
    y: number;
  } | null>(null);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auth hook
  const auth = useFutureMeAuth({
    onMessagesLoaded: setMessages,
    onMemoryLoaded: setMemorySummary,
    onInputLoaded: setInput,
    onMoodLoaded: setMood,
  });

  // Voice input hook
  const voice = useVoiceInput({
    onTranscript: (transcript) => {
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    },
    onError: auth.setLoginStatus,
  });

  // Speech hook
  const speech = useSpeech();

  // Derived values
  const accent = accentMap[mood];
  const remainingToday = auth.usage.date === todayKey() 
    ? Math.max(0, FREE_LIMIT - auth.usage.count) 
    : FREE_LIMIT;
  const draftKey = useMemo(() => profileToDraftKey(auth.user?.email), [auth.user?.email]);
  const memoryKey = useMemo(() => profileToMemoryKey(auth.user?.email), [auth.user?.email]);
  const hasConversationStarted = messages.some((m) => m.id !== "welcome");
  const visibleMessageCount = Math.max(0, messages.filter((m) => m.id !== "welcome").length);
  const liveLabel = loading ? "responding..." : hasConversationStarted ? "online" : "ready";
  const memoryBadge = memoryPulse ? "memory updated" : auth.user ? "cloud sync on" : "private draft";
  const insights = useMemo(() => buildInsights(messages), [messages]);

  const contextMenuPosition = useMemo(() => {
    if (!contextMenu) return null;
    const width = viewportWidth || 390;
    const height = viewportHeight || 844;
    const left = Math.max(12, Math.min(contextMenu.x, width - 240));
    const top = Math.max(12, Math.min(contextMenu.y, height - 240));
    return { left, top };
  }, [contextMenu, viewportWidth, viewportHeight]);

  // Styles
  const styles = useMemo(
    () => createStyles(mobile, auth.isPro, hasConversationStarted, loading, mood, accent, activeTab),
    [mobile, auth.isPro, hasConversationStarted, loading, mood, accent, activeTab]
  );

  // Effects
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    try {
      const draft = loadDraft(STORAGE_KEY);
      if (draft) {
        if (Array.isArray(draft.messages) && draft.messages.length > 0) {
          setMessages(draft.messages.slice(-MAX_MESSAGES));
        }
        if (typeof draft.input === "string") setInput(draft.input);
        if (draft.mood && ["calm", "honest", "direct", "wise"].includes(draft.mood)) {
          setMood(draft.mood as Mood);
        }
        if (typeof draft.isPro === "boolean") auth.setIsPro(draft.isPro);
        if (draft.usage) auth.setUsage(normalizeUsage(draft.usage));
      }

      const savedMemory = window.localStorage.getItem(memoryKey) || "";
      if (savedMemory) setMemorySummary(savedMemory);

      const params = new URLSearchParams(window.location.search);
      if (params.get("pro") === "1" || params.get("pro") === "true") {
        auth.setIsPro(true);
        params.delete("pro");
        const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
        window.history.replaceState({}, "", nextUrl);
      }
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoryKey]);

  useEffect(() => {
    if (!hydrated) return;

    const timeoutId = window.setTimeout(() => {
      saveDraft(draftKey, {
        messages: messages.slice(-MAX_MESSAGES),
        input,
        mood,
        isPro: auth.isPro,
        usage: auth.usage,
      });
      window.localStorage.setItem(memoryKey, memorySummary);
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [draftKey, hydrated, input, auth.isPro, messages, mood, memoryKey, memorySummary, auth.usage]);

  useEffect(() => {
    const derived = buildMemorySummary(messages);
    setMemorySummary(derived);
    if (auth.user?.email) {
      window.localStorage.setItem(memoryKey, derived);
    }
  }, [messages, memoryKey, auth.user?.email]);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    document.body.style.overflow = menuOpen || paywallOpen || showSaveSheet || contextMenu || isFocusMode ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [menuOpen, paywallOpen, showSaveSheet, contextMenu, isFocusMode]);

  // Handlers
  const incrementUsage = useCallback(() => {
    auth.setUsage((prevUsage: Usage) => {
      const today = todayKey();
      return prevUsage.date === today
        ? { date: today, count: prevUsage.count + 1 }
        : { date: today, count: 1 };
    });
  }, [auth]);

  const continueFromYesterday = useCallback(() => {
    if (!memorySummary) return;
    setInput((prev) => prev || `Continuing from yesterday: ${memorySummary}. `);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [memorySummary]);

  const copyMessage = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1200);
      setContextMenu(null);
    } catch {
      // ignore
    }
  }, []);

  const shareMessage = useCallback(async (text: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setContextMenu(null);
    } catch {
      // ignore
    }
  }, []);

  const deleteMessage = useCallback((id: string) => {
    if (id === "welcome") return;
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== id);
      return next.length > 0 ? next : [WELCOME_MESSAGE];
    });
    setContextMenu(null);
  }, []);

  const deepenThought = useCallback((text: string) => {
    setInput(`Deepen this thought: "${text}"\n\n`);
    setContextMenu(null);
    setIsFocusMode(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const searchLongTerm = useCallback(async (query: string) => {
    if (!auth.user) return [];
    const localFallback = retrievedMemories.length > 0 ? retrievedMemories : [];
    const fromServer = await callMemorySearch(query, auth.user.id, auth.user.email);
    return fromServer.length > 0 ? fromServer : localFallback;
  }, [auth.user, retrievedMemories]);

  const ingestLongTerm = useCallback(async (text: string, kind: "user" | "assistant" | "summary") => {
    if (!auth.user) return;
    await ingestMemory(auth.user, text, kind);
  }, [auth.user]);

  const sendMessage = useCallback(async () => {
    if (loading) return;

    const trimmed = input.trim();
    if (!trimmed) return;

    if (!auth.isPro && remainingToday <= 0) {
      setPaywallOpen(true);
      return;
    }

    vibrate([12, 20, 12]);
    setIsFocusMode(false);

    const now = new Date().toISOString();
    const userMessage: Message = {
      id: uid(),
      role: "me",
      text: trimmed,
      time: formatClock(),
      createdAt: now,
    };

    const nextMessages = [...messages, userMessage].slice(-MAX_MESSAGES);
    const nextMemorySummary = buildMemorySummary(nextMessages);

    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    if (!auth.isPro) incrementUsage();

    const startedAt = Date.now();
    const timeContext = buildTimeContext(new Date());
    const memoryPrompt = buildMemoryPrompt(nextMessages, mood, nextMemorySummary, new Date());
    const longTermMemories = await searchLongTerm(trimmed);
    setRetrievedMemories(longTermMemories);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          mood,
          isPro: auth.isPro,
          memorySummary: nextMemorySummary,
          memory: memoryPrompt,
          timeContext,
          ragContext: longTermMemories.join("\n"),
          longTermMemories,
        }),
      });

      const data = await response.json().catch(() => ({}));
      const lastAssistant =
        [...messages].reverse().find((m) => m.role === "future me")?.text ?? "";

      const replyText =
        typeof data?.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : fallbackReply(trimmed, mood, auth.isPro, lastAssistant);

      const remaining = Math.max(0, MIN_REPLY_DELAY_MS - (Date.now() - startedAt));
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      const assistantMessage: Message = {
        id: uid(),
        role: "future me",
        text: replyText,
        time: formatClock(),
        createdAt: new Date().toISOString(),
      };

      const finalMessages = [...nextMessages, assistantMessage].slice(-MAX_MESSAGES);
      setMessages(finalMessages);
      setMemorySummary(buildMemorySummary(finalMessages));
      setMemoryPulse(true);
      window.setTimeout(() => setMemoryPulse(false), 1400);

      if (auth.user) {
        await saveCloudTurn(auth.user, trimmed, replyText, nextMemorySummary);
        await ingestLongTerm(trimmed, "user");
        await ingestLongTerm(replyText, "assistant");
        await ingestLongTerm(nextMemorySummary, "summary");
      }
    } catch {
      const remaining = Math.max(0, MIN_REPLY_DELAY_MS - (Date.now() - startedAt));
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      const replyText = fallbackReply(trimmed, mood, auth.isPro);
      const assistantMessage: Message = {
        id: uid(),
        role: "future me",
        text: replyText,
        time: formatClock(),
        createdAt: new Date().toISOString(),
      };

      const finalMessages = [...nextMessages, assistantMessage].slice(-MAX_MESSAGES);
      setMessages(finalMessages);
      setMemorySummary(buildMemorySummary(finalMessages));
      setMemoryPulse(true);
      window.setTimeout(() => setMemoryPulse(false), 1400);

      if (auth.user) {
        await saveCloudTurn(auth.user, trimmed, replyText, nextMemorySummary);
      }
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [loading, input, auth.isPro, auth.user, remainingToday, messages, mood, incrementUsage, searchLongTerm, ingestLongTerm]);

  const startOver = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(MEMORY_SUMMARY_KEY);
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setMood("honest");
    setLoading(false);
    setMenuOpen(false);
    setPaywallOpen(false);
    setShowSaveSheet(false);
    auth.setIsPro(false);
    auth.setUsage(defaultUsage());
    setMemorySummary("");
    setRetrievedMemories([]);
    setActiveTab("chat");
    setContextMenu(null);
    setIsFocusMode(false);
    textareaRef.current?.focus();
  }, [auth]);

  const shareConversation = useCallback(async () => {
    const transcript = messages
      .map((m) => `${m.role === "me" ? "You" : "Future Me"}: ${m.text}`)
      .join("\n\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Future Me",
          text: transcript,
        });
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(transcript);
      }
    } catch {
      // ignore
    }
  }, [messages]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }, [sendMessage]);

  const handleTextareaChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }, []);

  const openMessageMenu = useCallback((message: Message, x: number, y: number) => {
    setContextMenu({
      messageId: message.id,
      text: message.text,
      role: message.role,
      x,
      y,
    });
  }, []);

  const handleLongPressStart = useCallback((message: Message) => (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse") return;
    longPressTimerRef.current = setTimeout(() => {
      vibrate(15);
      openMessageMenu(message, e.clientX, e.clientY);
    }, 450);
  }, [openMessageMenu]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleThreadScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceToBottom > 120);
  }, []);

  const handleScrollToBottom = useCallback(() => {
    setShowScrollBottom(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  // Menu items
  const topMenuItems: QuickActionItem[] = [
    { label: "Start over", onClick: startOver },
    { label: "Share conversation", onClick: () => void shareConversation() },
    { label: "Upgrade to Pro", onClick: () => { setMenuOpen(false); setPaywallOpen(true); } },
    ...(auth.user ? [{ label: "Sign out", onClick: () => void auth.signOut().then(() => setMenuOpen(false)) }] : []),
    { label: "Close", onClick: () => setMenuOpen(false) },
  ];

  const messageMenuItems: QuickActionItem[] = contextMenu
    ? [
        { label: "Copy text", onClick: () => void copyMessage(contextMenu.text, contextMenu.messageId) },
        { label: "Share", onClick: () => void shareMessage(contextMenu.text) },
        { label: "Deepen this thought", onClick: () => deepenThought(contextMenu.text) },
        ...(contextMenu.role === "me"
          ? [{ label: "Delete", onClick: () => deleteMessage(contextMenu.messageId), tone: "danger" as const }]
          : []),
      ]
    : [];

  return (
    <main style={styles.page}>
      <style jsx global>{`
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          width: 100%;
          min-height: 100%;
          height: auto;
          background-color: #09090d;
          color: #ffffff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          overflow-x: hidden;
          overflow-y: auto;
        }
        button, textarea { font: inherit; }
        button { cursor: pointer; -webkit-tap-highlight-color: transparent; }
        textarea { outline: none; }
        ::selection { background: rgba(255, 255, 255, 0.18); color: #ffffff; }
        ::-webkit-scrollbar { width: 0; height: 0; }
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(10px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      `}</style>

      <div style={styles.noiseOverlay} />
      <div style={styles.glowA} />
      <div style={styles.glowB} />

      {/* Backdrops */}
      {showSaveSheet && <div style={styles.sheetBackdrop} onClick={() => setShowSaveSheet(false)} />}
      {menuOpen && <div style={styles.sheetBackdrop} onClick={() => setMenuOpen(false)} />}
      {paywallOpen && <div style={styles.paywallBackdrop} onClick={() => setPaywallOpen(false)} />}
      {contextMenu && (
        <div
          style={{ ...styles.sheetBackdrop, background: "transparent", zIndex: 90 }}
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
        />
      )}

      {/* Menus */}
      <QuickActionsMenu
        open={menuOpen}
        mode="sheet"
        title="Future Me"
        subtitle="Quick actions"
        items={topMenuItems}
        onClose={() => setMenuOpen(false)}
      />

      <QuickActionsMenu
        open={Boolean(contextMenu && contextMenuPosition)}
        mode="context"
        title="Message"
        subtitle="Actions"
        items={messageMenuItems}
        onClose={() => setContextMenu(null)}
        position={contextMenuPosition ?? { left: 16, top: 16 }}
      />

      {/* Sheets */}
      {showSaveSheet && (
        <SaveSheet
          styles={styles}
          emailInput={auth.emailInput}
          onEmailChange={auth.setEmailInput}
          emailCooldownUntil={auth.emailCooldownUntil}
          sendingEmail={auth.sendingEmail}
          loginStatus={auth.loginStatus}
          onSignIn={() => void auth.signInWithEmail()}
          onClose={() => setShowSaveSheet(false)}
        />
      )}

      {paywallOpen && (
        <PaywallSheet
          styles={styles}
          isPro={auth.isPro}
          remainingToday={remainingToday}
          onUnlockPro={() => auth.setIsPro(true)}
          onShare={() => void shareConversation()}
          onClose={() => setPaywallOpen(false)}
        />
      )}

      {isFocusMode && (
        <FocusMode
          styles={styles}
          input={input}
          loading={loading}
          onInputChange={setInput}
          onKeyDown={handleKeyDown}
          onSend={() => void sendMessage()}
          onClose={() => setIsFocusMode(false)}
        />
      )}

      {/* Main content */}
      <div style={styles.shell}>
        <TopBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onMenuOpen={() => setMenuOpen(true)}
          userLabel={auth.user ? "synced cloud memory" : "guest mode - local memory"}
          isPro={auth.isPro}
        />

        <AnimatePresence mode="wait" initial={false}>
          {activeTab === "chat" ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
              style={{ display: "grid", gap: 14 }}
            >
              <HeroSection
                styles={styles}
                accent={accent}
                isPro={auth.isPro}
                hasConversationStarted={hasConversationStarted}
                remainingToday={remainingToday}
                memorySummary={memorySummary}
                memoryBadge={memoryBadge}
                textareaRef={textareaRef}
                onContinueFromYesterday={continueFromYesterday}
                onOpenMenu={() => setMenuOpen(true)}
              />

              <StatusRow
                styles={styles}
                isPro={auth.isPro}
                remainingToday={remainingToday}
                user={auth.user}
                visibleMessageCount={visibleMessageCount}
                onShowSaveSheet={() => setShowSaveSheet(true)}
                onOpenMenu={() => setMenuOpen(true)}
              />

              <MemoryCard
                styles={styles}
                accent={accent}
                memorySummary={memorySummary}
                retrievedMemories={retrievedMemories}
              />

              <MoodSelector
                styles={styles}
                accent={accent}
                mood={mood}
                onMoodChange={setMood}
              />

              <AiStatusPanel
                styles={styles}
                accent={accent}
                hasConversationStarted={hasConversationStarted}
                loading={loading}
                memorySummary={memorySummary}
                user={auth.user}
                isPro={auth.isPro}
              />

              <ChatThread
                styles={styles}
                accent={accent}
                isPro={auth.isPro}
                loading={loading}
                messages={messages}
                copiedId={copiedId}
                speakingId={speech.speakingId}
                bottomRef={bottomRef}
                showScrollBottom={showScrollBottom}
                onScroll={handleThreadScroll}
                onCopy={copyMessage}
                onSpeak={speech.speak}
                onOpenMenu={openMessageMenu}
                onLongPressStart={handleLongPressStart}
                onLongPressEnd={handleLongPressEnd}
                onScrollToBottom={handleScrollToBottom}
              />

              <ComposerBox
                styles={styles}
                accent={accent}
                mood={mood}
                input={input}
                loading={loading}
                isPro={auth.isPro}
                remainingToday={remainingToday}
                memoryBadge={memoryBadge}
                voiceListening={voice.isListening}
                textareaRef={textareaRef}
                onInputChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                onSend={() => void sendMessage()}
                onVoiceToggle={voice.toggleVoice}
              />
            </motion.div>
          ) : (
            <InsightsView
              styles={styles}
              accent={accent}
              mood={mood}
              insights={insights}
              retrievedMemories={retrievedMemories}
            />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
