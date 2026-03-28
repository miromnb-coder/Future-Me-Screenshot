export const dynamic = "force-dynamic";

"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function SuccessContent() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const session_id = params.get("session_id");

    if (!session_id) return;

    fetch("/api/verify-session", {
      method: "POST",
      body: JSON.stringify({ session_id }),
      headers: { "Content-Type": "application/json" }
    }).then(() => {
      router.replace("/");
    });
  }, [params, router]);

  return <div style={{ padding: 40 }}>Unlocking Pro...</div>;
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
