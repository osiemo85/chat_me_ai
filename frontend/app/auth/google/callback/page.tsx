"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { apiFetch } from "@/lib/api";

function readCookie(name: string): string | null {
  const target = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(target));

  return match ? decodeURIComponent(match.slice(target.length)) : null;
}

function clearGoogleStateCookie() {
  document.cookie = "google_oauth_state=; Max-Age=0; Path=/; SameSite=Lax";
}

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }
    hasStartedRef.current = true;

    const oauthError = searchParams.get("error");
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const expectedState = readCookie("google_oauth_state");

    async function exchangeCode() {
      if (oauthError) {
        setError("Google sign-in was cancelled or denied.");
        return;
      }

      if (!code || !state || !expectedState || state !== expectedState) {
        clearGoogleStateCookie();
        setError("Google sign-in could not be verified. Please try again.");
        return;
      }

      try {
        const response = await apiFetch("/api/v1/auth/google/exchange", {
          body: JSON.stringify({
            code,
            redirectUri: `${window.location.origin}/auth/google/callback`,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const payload = (await response.json()) as { detail?: string };

        if (!response.ok) {
          throw new Error(payload.detail || "Unable to complete Google sign-in.");
        }

        clearGoogleStateCookie();
        router.replace("/upload");
      } catch (exchangeError) {
        clearGoogleStateCookie();
        setError(
          exchangeError instanceof Error
            ? exchangeError.message
            : "Unable to complete Google sign-in.",
        );
      }
    }

    void exchangeCode();
  }, [router, searchParams]);

  return (
    <AuthShell title="Google sign-in" subtitle="">
      <section className="w-full rounded-[1.5rem] border border-white/10 bg-white/8 p-5 shadow-[0_20px_80px_rgba(4,10,22,0.28)] backdrop-blur-xl sm:p-6">
        {error ? (
          <div className="rounded-[1rem] border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : (
          <p className="text-sm text-white/80">Finishing Google sign-in...</p>
        )}

        <div className="mt-4">
          <Link
            href="/register"
            className="text-sm font-medium text-sky-200 transition hover:text-white"
          >
            Back to signup
          </Link>
        </div>
      </section>
    </AuthShell>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Google sign-in" subtitle="">
          <section className="w-full rounded-[1.5rem] border border-white/10 bg-white/8 p-5 shadow-[0_20px_80px_rgba(4,10,22,0.28)] backdrop-blur-xl sm:p-6">
            <p className="text-sm text-white/80">Finishing Google sign-in...</p>
          </section>
        </AuthShell>
      }
    >
      <GoogleCallbackContent />
    </Suspense>
  );
}
