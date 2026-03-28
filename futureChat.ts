export type Tone = 'realistic' | 'savage' | 'supportive' | 'funny';

export type Bubble = { id: string; side: 'left' | 'right'; text: string; time: string };

const firstLines: Record<Tone, string[]> = {
  realistic: [
    'I am future you. I came back from two weeks later.',
    'I need to tell you the honest version.',
    'So… this is how it played out.',
  ],
  savage: [
    'Hello. I am you, but with receipts.',
    'Yeah, I saw that decision. Bad news.',
    'I am here to prevent the cringe timeline.',
  ],
  supportive: [
    'Hey, I know this feels big.',
    'I checked in from the future and it is actually fine.',
    'Quick update from later: you handled this well.',
  ],
  funny: [
    'Yo, it is me from later, and I have opinions.',
    'Breaking news from the future timeline.',
    'I travelled back for one important message.',
  ],
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function padTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function seededPick(seed: number, items: string[]) {
  return items[Math.abs(seed) % items.length];
}

export function formatHorizon(value: string) {
  const days = Number(value);
  if (Number.isNaN(days) || days <= 0) return 'later';
  if (days === 1) return '1 day later';
  if (days < 7) return `${days} days later`;
  if (days === 7) return '1 week later';
  if (days < 30) return `${Math.round(days / 7)} weeks later`;
  return `${Math.round(days / 30)} months later`;
}

export function buildConversation(input: {
  decision: string;
  tone: Tone;
  futureLabel: string;
  horizon: string;
  intensity: number;
}) {
  const seed = Array.from(input.decision + input.futureLabel + input.horizon + input.tone).reduce(
    (acc, ch) => acc + ch.charCodeAt(0),
    0,
  );
  const now = new Date();
  const baseHour = clamp(now.getHours() + 1, 0, 23);
  const firstTime = padTime(baseHour, (now.getMinutes() + 3) % 60);
  const secondTime = padTime(baseHour, (now.getMinutes() + 6) % 60);
  const thirdTime = padTime(baseHour, (now.getMinutes() + 9) % 60);
  const fourthTime = padTime(baseHour, (now.getMinutes() + 12) % 60);

  const opener = seededPick(seed, firstLines[input.tone]);
  const moodLine =
    input.tone === 'supportive'
      ? 'No panic. The important part is what you learn from it.'
      : input.tone === 'funny'
      ? 'The timeline is not cooked, but it is definitely weird.'
      : input.tone === 'savage'
      ? 'You know exactly why I am annoyed.'
      : 'Here is the honest outcome.';

  const outcome = (() => {
    const i = input.intensity;
    if (input.tone === 'supportive') {
      return i > 60
        ? 'It was awkward, but it passed. You bounced back faster than you think.'
        : 'It turned out okay. You worried more than necessary.';
    }
    if (input.tone === 'funny') {
      return i > 60
        ? 'Not catastrophic, just very meme-worthy.'
        : 'Low stakes, maximum overthinking.';
    }
    if (input.tone === 'savage') {
      return i > 60
        ? 'You absolutely did the thing, and future me is still judging you.'
        : 'Honestly? Could have been worse, but still questionable.';
    }
    return i > 60
      ? 'It looked small in the moment, but it came back later.'
      : 'It was a decent choice after all.';
  })();

  const reactions = [
    input.tone === 'supportive' ? 'Breathe. You are fine.' : '…',
    input.tone === 'funny' ? 'I cannot believe this is the branch we chose.' : 'I know.',
    input.tone === 'savage' ? 'That was your decision, by the way.' : input.decision.trim(),
  ];

  return [
    { id: '1', side: 'left' as const, text: opener, time: firstTime },
    { id: '2', side: 'right' as const, text: input.decision, time: secondTime },
    { id: '3', side: 'left' as const, text: moodLine, time: thirdTime },
    { id: '4', side: 'left' as const, text: outcome, time: fourthTime },
    { id: '5', side: 'right' as const, text: reactions[0], time: fourthTime },
    { id: '6', side: 'left' as const, text: reactions[1], time: fourthTime },
    { id: '7', side: 'left' as const, text: reactions[2], time: fourthTime },
  ] satisfies Bubble[];
}
