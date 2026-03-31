
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { type User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import {
  WELCOME_MESSAGE,
  MAX_MESSAGES,
  FREE_LIMIT,
  todayKey,
  defaultUsage,
  normalizeUsage,
  loadDraft,
  saveDraft,
  profileToDraftKey,
  profileToMemoryKey,
  buildMemorySummary,
  formatClock,
  uid,
  fallbackReply,
  MIN_REPLY_DELAY_MS,
  buildTimeContext,
  buildMemoryPrompt,
  looksFinnish,
  vibrate,
  createSpeechRecognition,
} from '@/lib/futureMe';
import { type Message, type Mood, type Usage, type ViewTab, type ProfileRow } from '@/lib/futureMe';

async function loadCloudState(userId: string) {
  if (!supabase) return { profile: null, messages: [] };

  try {
    const [profileRes, messagesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('user_id,email,memory_summary,last_seen_at')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('messages')
        .select('id,role,text,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(120),
    ]);

    return {
      profile: (profileRes.data ?? null) as ProfileRow | null,
      messages: (messagesRes.data ?? []) as Message[],
    };
  } catch {
    return { profile: null, messages: [] };
  }
}

async function callMemorySearch(query: string, userId: string, email?: string | null) {
  // ... (implementation from FutureMeClient)
}

export function useFutureMe() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [mood, setMood] = useState<Mood>('honest');
  const [loading, setLoading] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [usage, setUsage] = useState<Usage>(defaultUsage());
  const [user, setUser] = useState<User | null>(null);
  const [memorySummary, setMemorySummary] = useState('');
  const [activeTab, setActiveTab] = useState<ViewTab>('chat');

  const draftKey = useMemo(() => profileToDraftKey(user?.email), [user?.email]);
  const memoryKey = useMemo(() => profileToMemoryKey(user?.email), [user?.email]);

  useEffect(() => {
    // Load local state
    const draft = loadDraft(draftKey);
    if (draft) {
      setMessages(draft.messages);
      setInput(draft.input);
      setMood(draft.mood);
      setIsPro(draft.isPro);
      setUsage(normalizeUsage(draft.usage));
    }

    const savedMemory = window.localStorage.getItem(memoryKey) || '';
    if (savedMemory) setMemorySummary(savedMemory);
  }, [draftKey, memoryKey]);

  useEffect(() => {
    // Save local state
    saveDraft(draftKey, { messages, input, mood, isPro, usage });
    window.localStorage.setItem(memoryKey, memorySummary);
  }, [messages, input, mood, isPro, usage, draftKey, memoryKey, memorySummary]);

  const syncSession = useCallback(async (nextUser: User | null) => {
    setUser(nextUser);
    if (nextUser) {
      const { profile, messages: cloudMessages } = await loadCloudState(nextUser.id);
      if (cloudMessages.length > 0) setMessages(cloudMessages);
      const cloudMemory = profile?.memory_summary?.trim() || buildMemorySummary(cloudMessages);
      setMemorySummary(cloudMemory);
    } else {
      // Load guest data
      const guestDraft = loadDraft();
      if(guestDraft) {
        setMessages(guestDraft.messages);
        setInput(guestDraft.input);
        setMood(guestDraft.mood);
        setIsPro(guestDraft.isPro);
        setUsage(normalizeUsage(guestDraft.usage));
      }
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session?.user ?? null);
    });

    return () => authListener.subscription.unsubscribe();
  }, [syncSession]);

  const remainingToday = usage.date === todayKey() ? Math.max(0, FREE_LIMIT - usage.count) : FREE_LIMIT;

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (loading || !trimmed) return;
    if (!isPro && remainingToday <= 0) return;

    setLoading(true);
    setInput('');

    const userMessage: Message = {
      id: uid(),
      role: 'me',
      text: trimmed,
      time: formatClock(),
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMessage].slice(-MAX_MESSAGES);
    setMessages(nextMessages);

    // ... (rest of the send message logic)

    setLoading(false);
  };

  return {
    messages,
    input,
    mood,
    loading,
    isPro,
    usage,
    user,
    memorySummary,
    activeTab,
    remainingToday,
    setInput,
    setMood,
    sendMessage,
    setActiveTab,
  };
}
