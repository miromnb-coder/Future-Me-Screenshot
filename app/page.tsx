"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";

// --- Tyypit & Konfiguraatio ---
type Role = "me" | "future me";
type Mood = "calm" | "honest" | "direct" | "wise";
type Message = { id: string; role: Role; text: string; time: string };
type Usage = { date: string; count: number };
type PersistedState = { messages: Message[]; input: string; mood: Mood; isPro: boolean; usage: Usage };

const STORAGE_KEY = "future-me-v3";
const FREE_LIMIT = 5;
const MAX_MESSAGES = 50;

const moodIcons: Record<Mood, string> = { calm: "☾", honest: "☺", direct: "⚡", wise: "◉" };
const moodLabels: Record<Mood, string> = { calm: "Calm", honest: "Honest", direct: "Direct", wise: "Wise" };
const moodHints: Record<Mood, string> = { calm: "slow down", honest: "be real", direct: "no fluff", wise: "big picture" };
const accentMap: Record<Mood, string> = { calm: "#60a5fa", honest: "#fb923c", direct: "#34d399", wise: "#a78bfa" };

// Supabase (Fallbackina null jos ei konffattu)
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  : null;

// --- Apu-komponentit animaatioihin ---

/**
 * InteractiveGlassCard: Kortti, jossa on parallax-heijastus ja hiiren seuranta
 */
const InteractiveGlassCard = ({ children, style = {}, className = "", intensity = 15 }: { children: React.ReactNode, style?: any, className?: string, intensity?: number }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-300, 300], [intensity, -intensity]), { stiffness: 150, damping: 20 });
  const rotateY = useSpring(useTransform(mouseX, [-300, 300], [-intensity, intensity]), { stiffness: 150, damping: 20 });
  
  // Heijastuksen liike (kiille)
  const shineX = useSpring(useTransform(mouseX, [-300, 300], [100, -100]), { stiffness: 150, damping: 20 });
  const shineY = useSpring(useTransform(mouseY, [-300, 300], [100, -100]), { stiffness: 150, damping: 20 });

  function onMouseMove(e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    mouseX.set(x);
    mouseY.set(y);
  }

  function onMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  return (
    <motion.div
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        ...style
      }}
      className={`relative overflow-hidden ${className}`}
    >
      {/* Dynaaminen heijastuskerros (Shine) */}
      <motion.div 
        style={{ 
          x: shineX, 
          y: shineY,
          background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)",
          position: "absolute",
          inset: "-50%",
          zIndex: 1,
          pointerEvents: "none"
        }} 
      />
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </motion.div>
  );
};

// --- Pääsovellus ---

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([{ id: "w", role: "future me", text: "I'm listening. What's on your mind?", time: "now" }]);
  const [input, setInput] = useState("");
  const [mood, setMood] = useState<Mood>("honest");
  const [loading, setLoading] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [usage, setUsage] = useState<Usage>({ date: new Date().toISOString().split('T')[0], count: 0 });
  const [user, setUser] = useState<User | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const accent = accentMap[mood];

  // Mouse Glow -seuranta koko taustalle
  const bgX = useSpring(useMotionValue(0));
  const bgY = useSpring(useMotionValue(0));

  useEffect(() => {
    const handleGlobalMouse = (e: MouseEvent) => {
      bgX.set(e.clientX);
      bgY.set(e.clientY);
    };
    window.addEventListener("mousemove", handleGlobalMouse);
    return () => window.removeEventListener("mousemove", handleGlobalMouse);
  }, [bgX, bgY]);

  // Automaattinen rullaus viesteihin
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading]);

  // Tallennus ja lataus
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as PersistedState;
      setMessages(parsed.messages);
      setMood(parsed.mood);
      setIsPro(parsed.isPro);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, input, mood, isPro, usage }));
  }, [messages, input, mood, isPro, usage]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const newMessage: Message = { id: Date.now().toString(), role: "me", text: input, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, newMessage]);
    setInput("");
    setLoading(true);

    // Simuloidaan AI-vastaus (tässä kohtaa kutsuisit APIasi)
    setTimeout(() => {
      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: "future me", 
        text: "Thinking about that... It seems you're prioritizing long-term growth over immediate comfort. That's a wise trade-off.", 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      };
      setMessages(prev => [...prev, aiMsg]);
      setLoading(false);
    }, 1500);
  };

  return (
    <main className="min-h-screen bg-[#050508] text-white selection:bg-white/20 overflow-hidden relative font-sans">
      
      {/* --- ELÄVÄ TAUSTA --- */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          style={{ x: useTransform(bgX, [0, 2000], [-50, 50]), y: useTransform(bgY, [0, 2000], [-50, 50]) }}
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px]" 
        />
        <motion.div 
          style={{ x: useTransform(bgX, [0, 2000], [50, -50]), y: useTransform(bgY, [0, 2000], [50, -50]) }}
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[100px]" 
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8 pb-32 relative z-10">
        
        {/* --- YLÄPALKKI --- */}
        <header className="flex items-center justify-between mb-12">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-2xl font-black tracking-tighter italic">FUTURE ME</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Pulse: Online & Remembering</p>
          </motion.div>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-xl text-xs font-bold flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]" />
            {isPro ? "PRO ACCOUNT" : "GUEST MODE"}
          </motion.div>
        </header>

        {/* --- HERO / MUISTI --- */}
        <InteractiveGlassCard 
          intensity={8}
          className="mb-8 p-6 rounded-[32px] bg-white/[0.03] border border-white/10 backdrop-blur-3xl shadow-2xl"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl shadow-lg">🧠</div>
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider">Memory Snapshot</h3>
                <p className="text-xs text-white/40">Last synced: Just now</p>
              </div>
            </div>
          </div>
          <p className="text-white/80 leading-relaxed italic text-sm border-l-2 border-white/10 pl-4 py-1">
            "You've been reflecting on the balance between speed and quality. Your future self suggests that the 'delay' you're feeling is actually incubation."
          </p>
        </InteractiveGlassCard>

        {/* --- MIELIALLAN VALINTA --- */}
        <section className="mb-12">
          <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
            {(Object.keys(moodLabels) as Mood[]).map((m) => {
              const active = mood === m;
              return (
                <motion.button
                  key={m}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setMood(m)}
                  className={`relative flex-shrink-0 px-6 py-4 rounded-2xl border transition-all duration-500 flex flex-col items-center gap-1 min-w-[100px] ${
                    active 
                    ? "bg-white/10 border-white/20 shadow-[0_0_30px_-10px_rgba(255,255,255,0.3)]" 
                    : "bg-transparent border-white/5 opacity-40 hover:opacity-100"
                  }`}
                >
                  <span className="text-2xl" style={{ color: active ? accentMap[m] : "white" }}>{moodIcons[m]}</span>
                  <span className="text-xs font-black uppercase tracking-tighter">{moodLabels[m]}</span>
                  {active && (
                    <motion.div 
                      layoutId="moodUnderline"
                      className="absolute -bottom-1 w-1 h-1 rounded-full"
                      style={{ backgroundColor: accentMap[m], boxShadow: `0 0 10px ${accentMap[m]}` }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* --- CHAT NÄKYMÄ --- */}
        <div 
          ref={scrollRef}
          className="space-y-6 mb-12 min-h-[400px] flex flex-col no-scrollbar"
        >
          <AnimatePresence mode="popLayout">
            {messages.map((m, idx) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className={`flex ${m.role === "me" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[85%] group`}>
                   <div className={`
                    p-4 rounded-[24px] text-sm leading-relaxed relative overflow-hidden
                    ${m.role === "me" 
                      ? "bg-white text-black font-medium rounded-tr-none" 
                      : "bg-white/5 border border-white/10 backdrop-blur-md rounded-tl-none"}
                  `}>
                    {m.text}
                    {m.role === "future me" && (
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] to-transparent pointer-events-none" />
                    )}
                  </div>
                  <p className={`text-[9px] mt-2 font-bold uppercase tracking-widest opacity-0 group-hover:opacity-40 transition-opacity ${m.role === "me" ? "text-right" : "text-left"}`}>
                    {m.role} • {m.time}
                  </p>
                </div>
              </motion.div>
            ))}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-none">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <motion.div 
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                        className="w-1.5 h-1.5 rounded-full bg-white/40"
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* --- INPUT AREA --- */}
        <footer className="fixed bottom-0 left-0 right-0 p-6 z-50">
          <div className="max-w-2xl mx-auto relative">
            <InteractiveGlassCard 
              intensity={4}
              className="p-2 rounded-[32px] bg-black/40 border border-white/10 backdrop-blur-3xl shadow-2xl flex items-end gap-2"
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={`Speak in ${mood} tone...`}
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-4 px-4 resize-none no-scrollbar placeholder:text-white/20"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={sendMessage}
                style={{ backgroundColor: accent, boxShadow: `0 0 20px ${accent}40` }}
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white flex-shrink-0 mb-1 mr-1 transition-colors duration-500"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14m-7-7 7 7-7 7"/>
                </svg>
              </motion.button>
            </InteractiveGlassCard>
            
            <div className="flex justify-center gap-6 mt-4">
               <p className="text-[10px] font-black uppercase tracking-widest text-white/20">
                Shift + Enter for new line
              </p>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/20">
                {isPro ? "Unlimited Access" : `${FREE_LIMIT - usage.count} free messages left`}
              </p>
            </div>
          </div>
        </footer>

      </div>

      {/* Custom Styles for hidden scrollbars */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        textarea:focus { box-shadow: none !important; }
      `}</style>
    </main>
  );
}
