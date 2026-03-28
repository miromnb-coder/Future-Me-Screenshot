import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.session_id ?? "").trim();

    if (!sessionId) {
      return NextResponse.json({ ok: false, reason: "missing_session_id" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ ok: false, reason: "not_paid" }, { status: 402 });
    }

    const res = NextResponse.json({ ok: true });

    const cookieValue = session.id;

    res.cookies.set("future_me_pro_session", cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365
    });

    return res;
  } catch (error) {
    console.error("verify-session error", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
