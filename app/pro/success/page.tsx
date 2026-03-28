"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ProSuccessPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState("Verifying payment…");

  useEffect(() => {
    const sessionId = params.get("session_id");

    if (!sessionId) {
      setStatus("Missing session id.");
      return;
    }

    (async () => {
      const res = await fetch("/api/verify-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.ok) {
        setStatus("Pro unlocked.");
        setTimeout(() => router.replace("/"), 900);
      } else {
        setStatus("Payment could not be verified.");
      }
    })();
  }, [params, router]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: 28, marginBottom: 12 }}>Future Me Pro</h1>
        <p style={{ opacity: 0.7, lineHeight: 1.6 }}>{status}</p>
      </div>
    </main>
  );
}
