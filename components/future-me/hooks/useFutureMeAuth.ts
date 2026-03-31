"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  type Message,
  type ProfileRow,
  type Usage,
  defaultUsage,
  normalizeUsage,
  normalizeMessageRows,
  buildMemorySummary,
  profileToMemoryKey,
  MAX_MESSAGES,
  MEMORY_SUMMARY_KEY,
  STORAGE_KEY,
  loadDraft,
  EMAIL_COOLDOWN_KEY,
  EMAIL_COOLDOWN_MS,
  WELCOME_MESSAGE,
  type Mood,
} from "@/lib/futureMe";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type MessageRow = {
  id: string;
  role: "me" | "future me";
  text: string;
  created_at: string;
};

async function loadCloudState(userId: string) {
  if (!supabase) return { profile: null as ProfileRow | null, messages: [] as Message[] };

  try {
    const [profileRes, messagesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id,email,memory_summary,last_seen_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id,role,text,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(120),
    ]);

    return {
      profile: (profileRes.data ?? null) as ProfileRow | null,
      messages: normalizeMessageRows((messagesRes.data ?? []) as MessageRow[]),
    };
  } catch {
    return { profile: null, messages: [] };
  }
}

function loadEmailCooldownUntil() {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(EMAIL_COOLDOWN_KEY) || "0");
}

function writeEmailCooldownUntil(ts: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EMAIL_COOLDOWN_KEY, String(ts));
}

interface UseFutureMeAuthOptions {
  onMessagesLoaded?: (messages: Message[]) => void;
  onMemoryLoaded?: (memory: string) => void;
  onInputLoaded?: (input: string) => void;
  onMoodLoaded?: (mood: Mood) => void;
  onIsProLoaded?: (isPro: boolean) => void;
  onUsageLoaded?: (usage: Usage) => void;
}

interface UseFutureMeAuthReturn {
  user: User | null;
  profile: ProfileRow | null;
  isPro: boolean;
  setIsPro: (isPro: boolean) => void;
  usage: Usage;
  setUsage: React.Dispatch<React.SetStateAction<Usage>>;
  emailInput: string;
  setEmailInput: (email: string) => void;
  loginStatus: string;
  setLoginStatus: (status: string) => void;
  sendingEmail: boolean;
  emailCooldownUntil: number;
  signInWithEmail: () => Promise<void>;
  signOut: () => Promise<void>;
  supabase: SupabaseClient | null;
  syncSession: (nextUser: User | null, currentMessages: Message[]) => Promise<void>;
}

export function useFutureMeAuth(options: UseFutureMeAuthOptions = {}): UseFutureMeAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [usage, setUsage] = useState<Usage>(defaultUsage());
  const [emailInput, setEmailInput] = useState("");
  const [loginStatus, setLoginStatus] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailCooldownUntil, setEmailCooldownUntilState] = useState(0);

  useEffect(() => {
    const initialCooldown = loadEmailCooldownUntil();
    setEmailCooldownUntilState(initialCooldown);
    const timer = window.setInterval(() => {
      setEmailCooldownUntilState(loadEmailCooldownUntil());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const syncSession = useCallback(
    async (nextUser: User | null, currentMessages: Message[]) => {
      setUser(nextUser);

      if (!nextUser) {
        const guestDraft = loadDraft(STORAGE_KEY);
        if (guestDraft) {
          if (Array.isArray(guestDraft.messages) && guestDraft.messages.length > 0) {
            options.onMessagesLoaded?.(guestDraft.messages.slice(-MAX_MESSAGES));
          } else {
            options.onMessagesLoaded?.([WELCOME_MESSAGE]);
          }
          if (typeof guestDraft.input === "string") options.onInputLoaded?.(guestDraft.input);
          if (guestDraft.mood && ["calm", "honest", "direct", "wise"].includes(guestDraft.mood)) {
            options.onMoodLoaded?.(guestDraft.mood as Mood);
          }
          if (typeof guestDraft.isPro === "boolean") {
            setIsPro(guestDraft.isPro);
            options.onIsProLoaded?.(guestDraft.isPro);
          }
          if (guestDraft.usage) {
            const normalizedUsage = normalizeUsage(guestDraft.usage);
            setUsage(normalizedUsage);
            options.onUsageLoaded?.(normalizedUsage);
          }
        }
        const savedMemory = window.localStorage.getItem(MEMORY_SUMMARY_KEY) || "";
        options.onMemoryLoaded?.(savedMemory);
        setEmailInput("");
        setProfile(null);
        return;
      }

      setEmailInput(nextUser.email ?? "");

      const { profile: cloudProfile, messages: cloudMessages } = await loadCloudState(nextUser.id);
      setProfile(cloudProfile);

      if (cloudMessages.length > 0) {
        options.onMessagesLoaded?.(cloudMessages.slice(-MAX_MESSAGES));
      }

      const cloudMemory =
        cloudProfile?.memory_summary?.trim() ||
        buildMemorySummary(cloudMessages.length > 0 ? cloudMessages : currentMessages);

      if (cloudMemory) {
        options.onMemoryLoaded?.(cloudMemory);
        window.localStorage.setItem(profileToMemoryKey(nextUser.email), cloudMemory);
      }
    },
    [options]
  );

  useEffect(() => {
    if (!supabase) return;

    const hydrate = async () => {
      const { data } = await supabase.auth.getSession();
      await syncSession(data.session?.user ?? null, []);
    };

    void hydrate();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        void syncSession(null, []);
        return;
      }

      setTimeout(() => {
        void syncSession(session?.user ?? null, []);
      }, 0);
    });

    return () => authListener.subscription.unsubscribe();
  }, [syncSession]);

  const signInWithEmail = useCallback(async () => {
    if (!supabase) {
      setLoginStatus("Supabase env vars are missing.");
      return;
    }

    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    const cooldownUntil = loadEmailCooldownUntil();
    if (Date.now() < cooldownUntil) {
      setLoginStatus(`Wait ${Math.ceil((cooldownUntil - Date.now()) / 1000)}s and try again.`);
      return;
    }

    setSendingEmail(true);
    setLoginStatus("Sending magic link...");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });

    if (error) {
      setLoginStatus(error.message);
      setSendingEmail(false);
      return;
    }

    const until = Date.now() + EMAIL_COOLDOWN_MS;
    writeEmailCooldownUntil(until);
    setEmailCooldownUntilState(until);
    setLoginStatus("Check your email for the sign-in link.");
    setSendingEmail(false);
  }, [emailInput]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setEmailInput("");
  }, []);

  return {
    user,
    profile,
    isPro,
    setIsPro,
    usage,
    setUsage,
    emailInput,
    setEmailInput,
    loginStatus,
    setLoginStatus,
    sendingEmail,
    emailCooldownUntil,
    signInWithEmail,
    signOut,
    supabase,
    syncSession,
  };
}

export async function saveCloudTurn(
  user: User,
  userText: string,
  assistantText: string,
  memorySummary: string
) {
  if (!supabase) return;

  const now = new Date().toISOString();

  try {
    const insertRes = await supabase.from("messages").insert([
      { user_id: user.id, role: "me", text: userText, created_at: now },
      { user_id: user.id, role: "future me", text: assistantText, created_at: now },
    ]);
    if (insertRes.error) console.error(insertRes.error);

    const profileRes = await supabase.from("profiles").upsert({
      user_id: user.id,
      email: user.email ?? null,
      memory_summary: memorySummary,
      last_seen_at: now,
    });
    if (profileRes.error) console.error(profileRes.error);
  } catch (error) {
    console.error("Failed to save cloud turn", error);
  }
}

export async function callMemorySearch(query: string, userId: string, email?: string | null) {
  try {
    const res = await fetch("/api/memory/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        userId,
        email,
        limit: 6,
      }),
    });

    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    const memories = Array.isArray(data?.memories) ? data.memories : [];
    return memories
      .map((item: unknown) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          return String(obj.text ?? obj.summary ?? obj.content ?? "");
        }
        return "";
      })
      .filter(Boolean)
      .slice(0, 6);
  } catch {
    return [];
  }
}

export async function ingestMemory(
  user: User,
  text: string,
  kind: "user" | "assistant" | "summary"
) {
  try {
    await fetch("/api/memory/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        email: user.email ?? null,
        kind,
        text,
      }),
    });
  } catch {
    // optional backend
  }
}
