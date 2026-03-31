import type { CSSProperties } from "react";
import type { Message, Mood, Usage, ViewTab, ProfileRow } from "@/lib/futureMe";
import type { User } from "@supabase/supabase-js";

export type MessageRow = {
  id: string;
  role: "me" | "future me";
  text: string;
  created_at: string;
};

export interface FutureMeStyles {
  page: CSSProperties;
  shell: CSSProperties;
  glowA: CSSProperties;
  glowB: CSSProperties;
  noiseOverlay: CSSProperties;
  topBar: CSSProperties;
  hero: CSSProperties;
  heroShine: CSSProperties;
  heroTop: CSSProperties;
  badge: CSSProperties;
  badgeAccent: CSSProperties;
  heroTitle: CSSProperties;
  heroSub: CSSProperties;
  heroMetrics: CSSProperties;
  metricCard: CSSProperties;
  metricValue: CSSProperties;
  metricLabel: CSSProperties;
  compactHero: CSSProperties;
  compactTitle: CSSProperties;
  compactSub: CSSProperties;
  compactActionRow: CSSProperties;
  compactButton: CSSProperties;
  compactGhost: CSSProperties;
  statusRow: CSSProperties;
  pill: CSSProperties;
  pillAction: CSSProperties;
  memoryCard: CSSProperties;
  memoryHeader: CSSProperties;
  memoryTitleWrap: CSSProperties;
  memoryIcon: CSSProperties;
  memoryTitle: CSSProperties;
  memoryMeta: CSSProperties;
  memoryUpdated: CSSProperties;
  memoryQuote: CSSProperties;
  memoryGlow: CSSProperties;
  moodSection: CSSProperties;
  moodHeading: CSSProperties;
  moodSub: CSSProperties;
  moodRow: CSSProperties;
  moodButton: CSSProperties;
  moodButtonActive: CSSProperties;
  moodIcon: CSSProperties;
  moodLabel: CSSProperties;
  moodLabelSub: CSSProperties;
  moodGlow: CSSProperties;
  aiPanel: CSSProperties;
  aiHeader: CSSProperties;
  aiHeaderLeft: CSSProperties;
  aiDot: CSSProperties;
  aiTitle: CSSProperties;
  aiSub: CSSProperties;
  aiChips: CSSProperties;
  aiChip: CSSProperties;
  threadCard: CSSProperties;
  threadGlow: CSSProperties;
  threadHeader: CSSProperties;
  threadLeft: CSSProperties;
  avatar: CSSProperties;
  threadText: CSSProperties;
  threadName: CSSProperties;
  threadMeta: CSSProperties;
  liveChip: CSSProperties;
  liveDot: CSSProperties;
  threadBody: CSSProperties;
  stream: CSSProperties;
  messageRow: CSSProperties;
  messageBubble: CSSProperties;
  meBubble: CSSProperties;
  futureMeBubble: CSSProperties;
  messageTop: CSSProperties;
  messageRole: CSSProperties;
  messageRoleMe: CSSProperties;
  copyButton: CSSProperties;
  messageText: CSSProperties;
  timestamp: CSSProperties;
  typingRow: CSSProperties;
  typingBubble: CSSProperties;
  typingDots: CSSProperties;
  typingDot: CSSProperties;
  composerShell: CSSProperties;
  composerTop: CSSProperties;
  composerChip: CSSProperties;
  composerRow: CSSProperties;
  composerTextarea: CSSProperties;
  sendButton: CSSProperties;
  micButton: CSSProperties;
  helper: CSSProperties;
  sheetBackdrop: CSSProperties;
  sheet: CSSProperties;
  sheetTitle: CSSProperties;
  sheetSub: CSSProperties;
  sheetGroup: CSSProperties;
  sheetButton: CSSProperties;
  paywallBackdrop: CSSProperties;
  paywall: CSSProperties;
  paywallHeader: CSSProperties;
  paywallTitle: CSSProperties;
  paywallSub: CSSProperties;
  featureCard: CSSProperties;
  featureList: CSSProperties;
  featureItem: CSSProperties;
  featureDot: CSSProperties;
  paywallButtons: CSSProperties;
  proButton: CSSProperties;
  ghostButton: CSSProperties;
  hintLine: CSSProperties;
  freeTag: CSSProperties;
  sheetInput: CSSProperties;
  sheetPrimary: CSSProperties;
  sheetSecondary: CSSProperties;
  sheetHint: CSSProperties;
  insightsGrid: CSSProperties;
  insightCard: CSSProperties;
  insightTitle: CSSProperties;
  insightSub: CSSProperties;
  sparkWrap: CSSProperties;
  sparkBars: CSSProperties;
  sparkBar: CSSProperties;
  sparkFill: CSSProperties;
  sparkLabelRow: CSSProperties;
  miniCards: CSSProperties;
  miniCard: CSSProperties;
  miniValue: CSSProperties;
  miniLabel: CSSProperties;
  themeBubbleContainer: CSSProperties;
  themeBubble: CSSProperties;
  voiceHint: CSSProperties;
  memoryPills: CSSProperties;
  memoryPill: CSSProperties;
  scrollBottomBtn: CSSProperties;
  contextMenu: CSSProperties;
  contextMenuBtn: CSSProperties;
  contextMenuBtnDanger: CSSProperties;
  focusModeOverlay: CSSProperties;
  focusModeHeader: CSSProperties;
  focusModeTitle: CSSProperties;
  focusModeClose: CSSProperties;
  focusModeTextarea: CSSProperties;
  focusModeFooter: CSSProperties;
  memoryJourney: CSSProperties;
  journeyTrack: CSSProperties;
  journeyGlow: CSSProperties;
  journeyPath: CSSProperties;
  journeyNode: CSSProperties;
}

export interface ChatState {
  messages: Message[];
  draft: string;
  loading: boolean;
  typing: boolean;
}

export interface AuthState {
  user: User | null;
  profile: ProfileRow | null;
  usage: Usage;
  isPro: boolean;
}

export interface MemoryState {
  memorySummary: string;
  lastContext: string[];
}

export interface VoiceState {
  isListening: boolean;
  voiceText: string;
}

export interface UIState {
  mood: Mood;
  activeTab: ViewTab;
  showMenu: boolean;
  showPaywall: boolean;
  showSignIn: boolean;
  showSettings: boolean;
  showMemorySheet: boolean;
  focusMode: boolean;
}

export type { Message, Mood, Usage, ViewTab, ProfileRow };
