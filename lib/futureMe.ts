export type Role = "me" | "future me";
export type Mood = "calm" | "honest" | "direct" | "wise";
export type ViewTab = "chat" | "insights";

export type Message = {
  id: string;
  role: Role;
  text: string;
  time: string;
  createdAt: string;
};

export type Usage = {
  date: string;
  count: number;
};

export type PersistedState = {
  messages: Message[];
  input: string;
  mood: Mood;
  isPro: boolean;
  usage: Usage;
};

export type MessageRow = {
  id: string;
  role: Role;
  text: string;
  created_at: string;
};

export type ProfileRow = {
  user_id: string;
  email: string | null;
  memory_summary: string | null;
  last_seen_at: string | null;
};

export type InsightData = {
  topThemes: { label: string; count: number }[];
  weeklyActivity: number[];
  totalUserMessages: number;
  avgLength: number;
  dominantTone: string;
  moodTrend: Record<Mood, number[]>;
};

export const STORAGE_KEY = "future-me-draft";
export const MEMORY_SUMMARY_KEY = "future-me-memory";
export const EMAIL_COOLDOWN_KEY = "future-me-email-cooldown-until";
export const FREE_LIMIT = 5;
export const MAX_MESSAGES = 60;
export const MIN_REPLY_DELAY_MS = 650;
export const EMAIL_COOLDOWN_MS = 60_000;

export const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "future me",
  text: "Write one thought. I’ll keep the conversation going.",
  time: "now",
  createdAt: new Date().toISOString(),
};

export const moodLabels: Record<Mood, string> = {
  calm: "Calm",
  honest: "Honest",
  direct: "Direct",
  wise: "Wise",
};

export const moodIcons: Record<Mood, string> = {
  calm: "☾",
  honest: "☺",
  direct: "⚡",
  wise: "◉",
};

export const moodHints: Record<Mood, string> = {
  calm: "slow the noise down",
  honest: "say the real thing",
  direct: "cut to the point",
  wise: "see the pattern",
};

export const moodPlaceholders: Record<Mood, string> = {
  calm: "What feels heavy right now?",
  honest: "What are you actually avoiding?",
  direct: "Say the thing.",
  wise: "What really matters here?",
};

export const themeKeywords: Record<string, string[]> = {
  work: ["work", "job", "career", "project", "build", "school", "study", "exam", "code", "app"],
  relationships: ["friend", "friends", "family", "mother", "father", "sister", "brother", "love", "relationship"],
  fear: ["fear", "anxious", "anxiety", "worry", "scared", "afraid", "stress", "nervous"],
  growth: ["grow", "better", "future", "improve", "learn", "progress", "change", "discipline"],
  freedom: ["free", "freedom", "choice", "independent", "own", "myself", "control"],
};

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatClock(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function defaultUsage(): Usage {
  return { date: todayKey(), count: 0 };
}

export function normalizeUsage(value: unknown): Usage {
  const today = todayKey();
  if (
    value &&
    typeof value === "object" &&
    typeof (value as Usage).date === "string" &&
    typeof (value as Usage).count === "number"
  ) {
    const usage = value as Usage;
    if (usage.date === today) {
      return { date: today, count: Math.max(0, usage.count) };
    }
  }
  return defaultUsage();
}

export function looksFinnish(text: string) {
  const t = text.toLowerCase();
  return (
    /[äöå]/.test(t) ||
    /(suomeksi|voisitko|voinko|mikä|mitä|tämä|tätä|olen|ehkä|miksi|nyt|kyllä|ei|siksi|koska)/i.test(t)
  );
}

export function fallbackReply(latestUserText: string, mood: Mood, isPro: boolean, lastAssistantText = "") {
  const seed = `${latestUserText}|${lastAssistantText}|${mood}|${isPro ? "pro" : "free"}`;
  const isFinnish = looksFinnish(seed);

  const freeSets: Record<Mood, { en: string[]; fi: string[] }> = {
    calm: {
      en: [
        "Pause first. You do not need to solve it in one move.",
        "The answer is usually quieter than the fear around it.",
      ],
      fi: [
        "Pysähdy ensin. Tätä ei tarvitse ratkaista yhdellä liikkeellä.",
        "Vastaus on yleensä hiljaisempi kuin sen ympärillä oleva pelko.",
      ],
    },
    honest: {
      en: [
        "You are not really asking for information. You are asking for permission.",
        "The cost matters more than the option itself.",
      ],
      fi: [
        "Et taida hakea pelkkää vastausta. Haluat että päätös tuntuisi vähemmän raskaalta.",
        "Hinta taitaa olla tärkeämpi kuin itse vaihtoehto.",
      ],
    },
    direct: {
      en: [
        "This is simpler than it feels. Decide, then move.",
        "The hesitation is the real problem, not the choice.",
      ],
      fi: [
        "Tämä on yksinkertaisempi kuin miltä tuntuu. Päätä ja liiku.",
        "Epäröinti on varsinainen ongelma, ei valinta.",
      ],
    },
    wise: {
      en: [
        "The real question is what this changes, not whether it works.",
        "The hidden cost is usually the part worth paying attention to.",
      ],
      fi: [
        "Oikea kysymys ei ehkä ole onnistuuko tämä, vaan mitä tämä muuttaa.",
        "Piilohinta on yleensä se kohta, johon kannattaa kiinnittää huomiota.",
      ],
    },
  };

  const proSets: Record<Mood, { en: string[]; fi: string[] }> = {
    calm: {
      en: ["You do not need more force. You need a cleaner decision.", "The fact that this still feels heavy is the clue."],
      fi: ["Et tarvitse enemmän voimaa. Tarvitset selkeämmän päätöksen.", "Se että tämä tuntuu yhä raskaalta on jo vihje."],
    },
    honest: {
      en: [
        "You already know the answer, you are just negotiating with it.",
        "What you call uncertainty is often just attachment to the easier path.",
      ],
      fi: [
        "Tiedät jo vastauksen, neuvottelet vain sen kanssa.",
        "Se mitä kutsut epävarmuudeksi on usein kiintymystä helpompaan polkuun.",
      ],
    },
    direct: {
      en: [
        "Choose the thing you will respect tomorrow.",
        "Do not optimize for comfort. Optimize for the version of you that has to live with it.",
      ],
      fi: [
        "Valitse se, mitä kunnioitat huomenna.",
        "Älä optimoi mukavuuden mukaan. Optimoi sen sinun version mukaan, joka elää seurauksen kanssa.",
      ],
    },
    wise: {
      en: [
        "The tradeoff is the point. Once you name it, the decision gets smaller.",
        "You are not choosing between good and bad. You are choosing which cost is worth paying.",
      ],
      fi: [
        "Vaihdon hinta on se juttu. Kun sanot sen ääneen, päätös pienenee.",
        "Et valitse hyvän ja pahan välillä. Valitset minkä hinnan haluat maksaa.",
      ],
    },
  };

  const source = (isPro ? proSets : freeSets)[mood];
  const pool = isFinnish ? source.fi : source.en;
  const score = [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return pool[Math.abs(score) % pool.length];
}

export function buildMemorySummary(messages: Message[]) {
  const userTexts = messages
    .filter((m) => m.role === "me")
    .slice(-8)
    .map((m) => m.text.trim())
    .filter(Boolean)
    .join(" • ");
  return userTexts.slice(0, 260);
}

export function buildTimeContext(date = new Date()) {
  const weekday = new Intl.DateTimeFormat("fi-FI", { weekday: "long" }).format(date);
  const month = new Intl.DateTimeFormat("fi-FI", { month: "long" }).format(date);

  const monthIndex = date.getMonth();
  const season =
    monthIndex <= 1 || monthIndex === 11
      ? "winter"
      : monthIndex <= 4
        ? "spring"
        : monthIndex <= 7
          ? "summer"
          : "autumn";

  return `Current time: ${date.toLocaleString("fi-FI")}. Weekday: ${weekday}. Month: ${month}. Season: ${season}.`;
}

export function buildMemoryPrompt(messages: Message[], mood: Mood, memorySummary = "", currentTime = new Date()) {
  const recentUserMessages = messages
    .filter((m) => m.role === "me")
    .slice(-4)
    .map((m) => m.text)
    .join(" | ");

  return [
    `Mood: ${mood}.`,
    buildTimeContext(currentTime),
    `Recent user messages: ${recentUserMessages}${memorySummary ? ` | Summary: ${memorySummary}` : ""}`,
  ]
    .join(" ")
    .slice(0, 340);
}

export function profileToMemoryKey(email?: string | null) {
  return email ? `future-me-memory:${email.trim().toLowerCase()}` : MEMORY_SUMMARY_KEY;
}

export function profileToDraftKey(email?: string | null) {
  return email ? `future-me-draft:${email.trim().toLowerCase()}` : STORAGE_KEY;
}

export function normalizeMessageRows(rows: MessageRow[] | null | undefined): Message[] {
  return (rows ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    time: new Date(m.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    createdAt: m.created_at,
  }));
}

export function localDayKeyFromISO(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayKey();
  return todayKey(d);
}

export function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = Number.parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function searchThemes(messages: Message[]) {
  const joined = messages
    .filter((m) => m.role === "me")
    .map((m) => m.text.toLowerCase())
    .join(" ");

  const results = Object.entries(themeKeywords).map(([label, keywords]) => {
    const count = keywords.reduce((sum, keyword) => {
      const matches = joined.split(keyword).length - 1;
      return sum + matches;
    }, 0);
    return { label, count };
  });

  return results
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
}

export function buildInsights(messages: Message[]): InsightData {
  const userMessages = messages.filter((m) => m.role === "me");
  const countsByDay: Record<string, number> = {};
  const now = new Date();

  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    countsByDay[todayKey(d)] = 0;
  }

  userMessages.forEach((msg) => {
    const day = localDayKeyFromISO(msg.createdAt);
    if (countsByDay[day] !== undefined) countsByDay[day] += 1;
  });

  const weeklyActivity = Object.keys(countsByDay).map((key) => countsByDay[key]);
  const avgLength =
    userMessages.length > 0
      ? Math.round(userMessages.reduce((sum, m) => sum + m.text.length, 0) / userMessages.length)
      : 0;

  const text = userMessages.map((m) => m.text.toLowerCase()).join(" ");
  const toneScore =
    (text.match(/\b(worried|worry|afraid|fear|stress|stuck|anxious|anxiety)\b/g)?.length ?? 0) -
    (text.match(/\b(clear|calm|good|better|grow|move|progress|ready)\b/g)?.length ?? 0);

  const dominantTone = toneScore > 3 ? "tense" : toneScore < -2 ? "confident" : "balanced";

  const seed = userMessages.length;
  const moodTrend = {
    calm: [2, 3, 1, 4, 2, 5, 3].map((v) => v + (seed % 2)),
    honest: [4, 1, 3, 2, 5, 1, 2].map((v) => v + (seed % 3)),
    direct: [1, 2, 4, 3, 1, 2, 5].map((v) => v + (seed % 2)),
    wise: [3, 4, 2, 1, 3, 4, 1].map((v) => v + (seed % 3)),
  };

  return {
    topThemes: searchThemes(messages),
    weeklyActivity,
    totalUserMessages: userMessages.length,
    avgLength,
    dominantTone,
    moodTrend,
  };
}

export function createSpeechRecognition() {
  if (typeof window === "undefined") return null;
  const w = window as Window & typeof globalThis & {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

export function vibrate(pattern: number | number[] = 10) {
  if (typeof navigator === "undefined") return;
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}

export function loadDraft(key: string): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || !Array.isArray(parsed.messages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, value: PersistedState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}
