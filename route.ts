import { NextResponse } from 'next/server';
import { buildConversation, type Tone } from '@/lib/futureChat';

export const runtime = 'nodejs';

function isTone(value: unknown): value is Tone {
  return value === 'realistic' || value === 'savage' || value === 'supportive' || value === 'funny';
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<{
      decision: string;
      tone: Tone;
      futureLabel: string;
      horizon: string;
      intensity: number;
    }>;

    const decision = typeof body.decision === 'string' && body.decision.trim() ? body.decision.trim() : 'Should I do this?';
    const tone = isTone(body.tone) ? body.tone : 'realistic';
    const futureLabel = typeof body.futureLabel === 'string' && body.futureLabel.trim() ? body.futureLabel.trim() : 'Future Me';
    const horizon = typeof body.horizon === 'string' && body.horizon.trim() ? body.horizon.trim() : '14';
    const intensity = typeof body.intensity === 'number' && Number.isFinite(body.intensity) ? Math.max(0, Math.min(100, body.intensity)) : 72;

    const messages = buildConversation({ decision, tone, futureLabel, horizon, intensity });

    return NextResponse.json({
      messages,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
