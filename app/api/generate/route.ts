import { NextResponse } from "next/server";

type Tone = "regret" | "win" | "savage" | "wholesome";

function buildConversation(decision: string, tone: Tone, horizon: string) {
  const clean = decision.trim().replace(/\s+/g, " ");
  const base = clean || "this";
  const tones = {
    regret: [
      { from: "me", text: `Should I do ${base}?` },
      { from: "future me", text: `You already know the answer.` },
      { from: "me", text: "Tell me straight." },
      { from: "future me", text: `You did it. It looked good for 3 days.\nThen ${horizon} later, you were annoyed every time you saw it.` }
    ],
    win: [
      { from: "me", text: `Should I do ${base}?` },
      { from: "future me", text: `Yes. This one actually ages well.` },
      { from: "me", text: "For real?" },
      { from: "future me", text: `For real. ${horizon} later, this ends up being one of your better calls.` }
    ],
    savage: [
      { from: "me", text: `Should I do ${base}?` },
      { from: "future me", text: `No. Be serious for one second.` },
      { from: "me", text: "That bad?" },
      { from: "future me", text: `Not even close to worth it. ${horizon} later, you will cringe every time you remember this.` }
    ],
    wholesome: [
      { from: "me", text: `Should I do ${base}?` },
      { from: "future me", text: `You're asking the right question.` },
      { from: "me", text: "So… yes?" },
      { from: "future me", text: `Yes. Small choice, big calm energy later.` }
    ]
  };

  return tones[tone];
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const decision = String(body.decision ?? "");
  const tone = String(body.tone ?? "regret") as Tone;
  const horizon = String(body.horizon ?? "2 weeks");

  return NextResponse.json({
    title: "Future Me",
    horizon,
    tone,
    messages: buildConversation(decision, tone, horizon),
    caption:
      tone === "regret"
        ? `I asked my future self and got cooked 💀`
        : tone === "savage"
          ? `My future self did NOT let me off easy.`
          : tone === "win"
            ? `Future me said this one was actually smart.`
            : `Small choice, better future.`
  });
}
