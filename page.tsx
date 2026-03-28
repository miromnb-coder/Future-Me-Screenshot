"use client";

import html2canvas from 'html2canvas';
import { useMemo, useRef, useState } from 'react';
import { buildConversation, formatHorizon, type Bubble, type Tone } from '@/lib/futureChat';

const toneLabel: Record<Tone, string> = {
  realistic: 'Realistic',
  savage: 'Savage',
  supportive: 'Supportive',
  funny: 'Funny',
};

const presetDecisions = [
  'Should I buy this right now?',
  'Should I text them back?',
  'Should I skip this and save money?',
  'Should I actually start today?',
  'Should I post this?',
];

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

export default function Home() {
  const [decision, setDecision] = useState('Should I buy this right now?');
  const [tone, setTone] = useState<Tone>('realistic');
  const [futureLabel, setFutureLabel] = useState('Future Me');
  const [horizon, setHorizon] = useState('14');
  const [intensity, setIntensity] = useState(72);
  const [subtitle, setSubtitle] = useState('Make a screenshot-worthy chat with your future self.');
  const [messages, setMessages] = useState<Bubble[]>(() =>
    buildConversation({ decision: 'Should I buy this right now?', tone: 'realistic', futureLabel: 'Future Me', horizon: '14', intensity: 72 }),
  );
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [copied, setCopied] = useState(false);
  const shotRef = useRef<HTMLDivElement | null>(null);

  const toneHint = useMemo(() => {
    if (tone === 'supportive') return 'Warm, reassuring, still feels real.';
    if (tone === 'savage') return 'Sharper and more dramatic for shareable screenshots.';
    if (tone === 'funny') return 'Meme energy, but clean enough to look real.';
    return 'Balanced and believable, like a real conversation.';
  }, [tone]);

  const previewTitle = `${formatHorizon(horizon)} · ${toneLabel[tone]}`;

  async function generate() {
    const payload = {
      decision: decision.trim() || 'Should I do this?',
      tone,
      futureLabel: futureLabel.trim() || 'Future Me',
      horizon,
      intensity,
    };

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to generate');
      const data = (await res.json()) as { messages: Bubble[]; generatedAt: string };
      setMessages(data.messages);
      setGeneratedAt(new Date(data.generatedAt));
    } catch {
      setMessages(buildConversation(payload));
      setGeneratedAt(new Date());
    }
    setSubtitle('New screenshot ready.');
  }

  function randomize() {
    const d = presetDecisions[Math.floor(Math.random() * presetDecisions.length)];
    const tones: Tone[] = ['realistic', 'savage', 'supportive', 'funny'];
    setDecision(d);
    setTone(tones[Math.floor(Math.random() * tones.length)]);
    setFutureLabel(Math.random() > 0.5 ? 'Future Me' : 'Later Me');
    setHorizon(String([2, 7, 14, 30][Math.floor(Math.random() * 4)]));
    setIntensity(40 + Math.floor(Math.random() * 60));
  }

  async function downloadScreenshot() {
    if (!shotRef.current) return;
    const canvas = await html2canvas(shotRef.current, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement('a');
    link.download = `future-me-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function shareShot() {
    if (!shotRef.current) return;
    const canvas = await html2canvas(shotRef.current, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
    });
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const file = new File([blob], 'future-me.png', { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Future Me Screenshot' });
      return;
    }
    const url = URL.createObjectURL(blob);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="min-h-screen px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:flex-row">
        <section className="glass chat-shadow flex-1 rounded-[28px] p-5 sm:p-7">
          <div className="flex flex-col gap-2 border-b border-white/10 pb-5">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold tracking-wide text-indigo-200">
              VIRAL CHAT GENERATOR
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Future Me Screenshot</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{subtitle} Make it look like a real chat, then export it as a clean image for TikTok, Reels, or stories.</p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-200">Decision</span>
              <textarea
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                className="min-h-28 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm outline-none transition focus:border-indigo-400/50 focus:bg-white/5"
                placeholder="Should I buy this right now?"
              />
            </label>

            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-200">Tone</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(Object.keys(toneLabel) as Tone[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`rounded-2xl border px-3 py-3 text-sm font-medium transition ${tone === t ? 'border-indigo-400/60 bg-indigo-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                    >
                      {toneLabel[t]}
                    </button>
                  ))}
                </div>
              </label>

              <label className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-slate-200">Future name</span>
                  <span className="text-xs text-slate-400">Shown in the header</span>
                </div>
                <input
                  value={futureLabel}
                  onChange={(e) => setFutureLabel(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-indigo-400/50 focus:bg-white/5"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-slate-200">Time horizon</span>
                <span className="text-xs text-slate-400">Days</span>
              </div>
              <input
                type="range"
                min="1"
                max="90"
                value={horizon}
                onChange={(e) => setHorizon(e.target.value)}
                className="w-full accent-indigo-400"
              />
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>1 day</span>
                <span>{horizon} days</span>
                <span>90 days</span>
              </div>
            </label>

            <label className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-slate-200">Drama / intensity</span>
                <span className="text-xs text-slate-400">{intensity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full accent-fuchsia-400"
              />
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>calm</span>
                <span>viral</span>
                <span>chaos</span>
              </div>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={generate} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:scale-[1.01]">
              Generate screenshot
            </button>
            <button onClick={randomize} className="rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Randomize
            </button>
            <button onClick={downloadScreenshot} className="rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Download PNG
            </button>
            <button onClick={shareShot} className="rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Share
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <p className="font-medium text-slate-100">What makes it feel real</p>
            <p className="mt-1 leading-6">{toneHint} The conversation uses a proper header, believable timing, and small detail lines so the screenshot looks like a native chat app, not a generic template.</p>
          </div>
        </section>

        <section className="glass chat-shadow w-full rounded-[28px] p-4 sm:p-6 lg:w-[430px]">
          <div className="mx-auto flex max-w-[390px] flex-col gap-4">
            <div ref={shotRef} className="overflow-hidden rounded-[32px] border border-white/10 bg-[#08101f] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 bg-[#0b1325] px-5 py-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">future me</p>
                  <h2 className="text-lg font-semibold text-white">{futureLabel}</h2>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <div>{previewTitle}</div>
                  <div>{generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>

              <div className="hide-scrollbar max-h-[620px] space-y-3 overflow-auto px-4 py-5">
                <div className="mx-auto mb-2 w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
                  {formatHorizon(horizon)}
                </div>
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.side === 'right' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] rounded-3xl px-4 py-3 text-[14px] leading-6 ${message.side === 'right' ? 'chat-shadow rounded-br-md bg-indigo-500 text-white' : 'chat-shadow rounded-bl-md bg-white/10 text-slate-100'}`}>
                      <p>{message.text}</p>
                      <p className="mt-1 text-[10px] opacity-60">{message.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 bg-[#0b1325] px-4 py-4 text-center text-[11px] text-slate-400">
                Tap and hold this image on mobile to save or share after exporting.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <p className="font-medium text-white">Preview mode</p>
              <p className="mt-1 leading-6">The screenshot is built from the card above, so what you see is what you export.</p>
              {copied ? <p className="mt-2 text-xs text-emerald-300">Link copied to clipboard.</p> : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
