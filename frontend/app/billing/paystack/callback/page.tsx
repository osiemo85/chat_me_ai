"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

type VerifyResponse = {
  status: string;
  accessStartsAt: string | null;
  accessExpiresAt: string | null;
  reference: string;
};

type CallbackState = "loading" | "success" | "pending" | "failed";

function formatDate(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function PaystackCallbackContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  const [state, setState] = useState<CallbackState>("loading");
  const [message, setMessage] = useState("Verifying your Paystack payment...");
  const [verification, setVerification] = useState<VerifyResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verifyPayment() {
      if (!reference) {
        if (!cancelled) {
          setState("failed");
          setMessage("Missing Paystack reference in the callback URL.");
        }
        return;
      }

      try {
        const response = await apiFetch("/api/v1/payments/paystack/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });
        const payload = (await response.json()) as VerifyResponse | { detail?: string };

        if (!response.ok) {
          if (!cancelled) {
            setState(response.status === 400 ? "pending" : "failed");
            setMessage(
              ("detail" in payload ? payload.detail : undefined) ??
                "Unable to verify your payment.",
            );
          }
          return;
        }

        if (!cancelled) {
          setVerification(payload as VerifyResponse);
          setState("success");
          setMessage("Yearly access is active for this twin.");
        }
      } catch (error) {
        if (!cancelled) {
          setState("failed");
          setMessage(
            error instanceof Error ? error.message : "Unable to verify your payment.",
          );
        }
      }
    }

    void verifyPayment();

    return () => {
      cancelled = true;
    };
  }, [reference]);

  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text)] sm:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/8 p-8 backdrop-blur-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            Paystack callback
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">
            {state === "success"
              ? "Payment confirmed"
              : state === "pending"
                ? "Verification pending"
                : state === "failed"
                  ? "Verification failed"
                  : "Checking payment"}
          </h1>
          <p className="mt-4 text-base leading-8 text-white/74">{message}</p>

          {verification ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <article className="rounded-[1.5rem] border border-white/10 bg-black/18 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                  Access started
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {formatDate(verification.accessStartsAt)}
                </p>
              </article>

              <article className="rounded-[1.5rem] border border-white/10 bg-black/18 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                  Access expires
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {formatDate(verification.accessExpiresAt)}
                </p>
              </article>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
            >
              Back to dashboard
            </Link>
            <Link
              href="/upload"
              className="rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
            >
              Back to upload
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function PaystackCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text)] sm:px-10">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            <section className="rounded-[2rem] border border-white/10 bg-white/8 p-8 text-white/74 backdrop-blur-xl">
              Verifying your Paystack payment...
            </section>
          </div>
        </main>
      }
    >
      <PaystackCallbackContent />
    </Suspense>
  );
}
