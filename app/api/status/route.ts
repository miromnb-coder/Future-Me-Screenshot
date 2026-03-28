import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  try {
    const sessionId = cookies().get("future_me_pro_session")?.value;

    if (!sessionId) {
      return NextResponse.json({ isPro: false });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return NextResponse.json({
      isPro: session.payment_status === "paid"
    });
  } catch {
    return NextResponse.json({ isPro: false });
  }
}
