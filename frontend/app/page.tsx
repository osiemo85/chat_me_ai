"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

const chips = [
  "AI Twin",
  "CV-powered",
  "Passport + persona for identity",
  "Quick hiring",
  "Tech-savvy profile",
];

const steps = [
  "Add your CV",
  "Add your passport photo and persona",
  "Add LinkedIn, GitHub, or other links",
];

function HomeActions({
  isAuthenticated,
  isLoading,
  isLoggingOut,
  onLogout,
}: {
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingOut: boolean;
  onLogout: () => Promise<void>;
}) {
  if (isLoading) {
    return <div className="h-10 w-40 rounded-full border border-white/10 bg-white/6" />;
  }

  if (isAuthenticated) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/upload"
          className="rounded-full bg-sky-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
        >
          Go to Upload
        </Link>
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={isLoggingOut}
          className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/login"
        className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/12"
      >
        Login
      </Link>
      <Link
        href="/register"
        className="rounded-full bg-sky-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
      >
        Register
      </Link>
    </div>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const accessMessage = searchParams.get("message");

  useEffect(() => {
    let cancelled = false;

    async function loadAuthState() {
      try {
        const response = await apiFetch("/api/v1/auth/status", {
          cache: "no-store",
        });

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setIsAuthenticated(false);
          return;
        }

        const payload = (await response.json()) as { authenticated?: boolean };
        setIsAuthenticated(payload.authenticated === true);
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setIsAuthLoading(false);
        }
      }
    }

    void loadAuthState();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await apiFetch("/api/v1/auth/logout", {
        method: "POST",
      });
      setIsAuthenticated(false);
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <main className="relative isolate overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-grid absolute inset-0 opacity-50" />
        <div className="hero-orb hero-orb-cyan" />
        <div className="hero-orb hero-orb-amber" />
        <div className="hero-orb hero-orb-rose" />
      </div>

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/6 px-5 py-3 backdrop-blur">
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-[var(--accent)]">
            Chat Me AI
          </p>
          <HomeActions
            isAuthenticated={isAuthenticated}
            isLoading={isAuthLoading}
            isLoggingOut={isLoggingOut}
            onLogout={handleLogout}
          />
        </header>

        <div className="flex flex-1 flex-col">
          <section className="flex min-h-[70vh] flex-1 items-center justify-center py-10 text-center">
            <div className="hero-message mx-auto flex max-w-5xl flex-col items-center rounded-[2.2rem] border border-cyan-300/20 bg-white/6 px-6 py-10 backdrop-blur-xl sm:px-10 lg:px-14 lg:py-14">
              {accessMessage ? (
                <div className="mb-6 w-full max-w-2xl rounded-[1rem] border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  {accessMessage}
                </div>
              ) : null}

              <h1 className="text-5xl font-semibold leading-[0.96] tracking-[-0.06em] text-white sm:text-6xl lg:text-8xl">
                Let employers chat and talk to you when you are away
              </h1>

              <p className="mt-6 max-w-3xl text-lg leading-8 text-white/74 sm:text-xl">
                Your AI twin is powered by your CV. Your passport photo and
                persona define identity. Add LinkedIn, GitHub, or other social
                links for a stronger public profile.
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-white/82 backdrop-blur"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              {!isAuthLoading ? (
                <div className="mt-8 flex flex-wrap justify-center gap-4">
                  {isAuthenticated ? (
                    <>
                      <Link
                        href="/upload"
                        className="inline-flex min-h-14 items-center justify-center rounded-full bg-sky-400 px-8 text-lg font-semibold text-slate-950 shadow-[0_0_40px_rgba(56,189,248,0.4)] transition hover:scale-[1.02] hover:bg-sky-300"
                      >
                        Go to Upload
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleLogout()}
                        disabled={isLoggingOut}
                        className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/12 bg-white/8 px-8 text-lg font-semibold text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isLoggingOut ? "Logging out..." : "Logout"}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/register"
                        className="inline-flex min-h-14 items-center justify-center rounded-full bg-sky-400 px-8 text-lg font-semibold text-slate-950 shadow-[0_0_40px_rgba(56,189,248,0.4)] transition hover:scale-[1.02] hover:bg-sky-300"
                      >
                        Create Account
                      </Link>
                      <Link
                        href="/login"
                        className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/12 bg-white/8 px-8 text-lg font-semibold text-white transition hover:bg-white/12"
                      >
                        Login
                      </Link>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </section>

          <section className="grid gap-6 pb-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
            <div className="rounded-[1.8rem] border border-white/10 bg-white/6 p-6 backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                Start here
              </p>
              <p className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white">
                Build a fast, tech-savvy hiring presence.
              </p>
              <p className="mt-4 text-base leading-7 text-white/72">
                Share an AI twin employers can message or speak to, even when
                you are offline.
              </p>

              <div className="mt-6">
                {isAuthLoading ? null : isAuthenticated ? (
                  <Link
                    href="/upload"
                    className="inline-flex min-h-14 items-center justify-center rounded-full bg-sky-400 px-8 text-lg font-semibold text-slate-950 shadow-[0_0_40px_rgba(56,189,248,0.4)] transition hover:scale-[1.02] hover:bg-sky-300"
                  >
                    Go to Upload
                  </Link>
                ) : (
                  <Link
                    href="/register"
                    className="inline-flex min-h-14 items-center justify-center rounded-full bg-sky-400 px-8 text-lg font-semibold text-slate-950 shadow-[0_0_40px_rgba(56,189,248,0.4)] transition hover:scale-[1.02] hover:bg-sky-300"
                  >
                    Create Account
                  </Link>
                )}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-white/6 p-6 backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                Steps to get started
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {steps.map((step, index) => (
                  <article
                    key={step}
                    className="rounded-[1.2rem] border border-white/10 bg-black/18 p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                      Step 0{index + 1}
                    </p>
                    <p className="mt-2 text-base font-medium text-white">
                      {step}
                    </p>
                  </article>
                ))}
              </div>

              <div className="mt-5 rounded-[1.2rem] border border-white/10 bg-black/18 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                  Social links
                </p>
                <p className="mt-2 text-sm leading-7 text-white/74">
                  Optional links: LinkedIn, GitHub, portfolio, or other social
                  links you want employers to see.
                </p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="relative isolate overflow-hidden bg-[var(--bg)] text-[var(--text)]">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="hero-grid absolute inset-0 opacity-50" />
            <div className="hero-orb hero-orb-cyan" />
            <div className="hero-orb hero-orb-amber" />
            <div className="hero-orb hero-orb-rose" />
          </div>

          <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-10 lg:px-12">
            <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/6 px-5 py-3 backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-[0.35em] text-[var(--accent)]">
                Chat Me AI
              </p>
              <div className="h-10 w-40 rounded-full border border-white/10 bg-white/6" />
            </header>

            <div className="flex flex-1 flex-col">
              <section className="flex min-h-[70vh] flex-1 items-center justify-center py-10 text-center">
                <div className="hero-message mx-auto flex max-w-5xl flex-col items-center rounded-[2.2rem] border border-cyan-300/20 bg-white/6 px-6 py-10 backdrop-blur-xl sm:px-10 lg:px-14 lg:py-14">
                  <h1 className="text-5xl font-semibold leading-[0.96] tracking-[-0.06em] text-white sm:text-6xl lg:text-8xl">
                    Let employers chat and talk to you when you are away
                  </h1>
                </div>
              </section>
            </div>
          </section>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
