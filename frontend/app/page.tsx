"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { ChatStarfield } from "@/app/twin/[publicId]/ChatStarfield";
import { TypewriterName } from "@/app/twin/[publicId]/TypewriterName";

const featureChips = ["CV-grounded", "Public AI twin", "Recruiter-friendly", "Fast setup"];

const steps = [
  {
    id: "01",
    title: "Create account",
    detail: "Open your workspace.",
  },
  {
    id: "02",
    title: "Upload CV and photo",
    detail: "Add your facts and identity.",
  },
  {
    id: "03",
    title: "Share your twin",
    detail: "Send one public link to employers.",
  },
];

const testimonials = [
  {
    quote:
      "I created my twin and started sharing it with employers. Within a week, I had 10 interview conversations because people could quickly understand my background before calling me.",
    name: "Mercy A.",
    role: "Product Designer",
    impact: "10 interview conversations in one week",
  },
  {
    quote:
      "One recruiter reached out and told me, 'I like the creativity of this thing, it feels lively.' That message alone told me the twin was helping me stand out before the interview even started.",
    name: "Brian K.",
    role: "Frontend Engineer",
    impact: "Stronger first impression with recruiters",
  },
  {
    quote:
      "I shared my twin link on LinkedIn and people were genuinely amazed by it. Instead of sending a long explanation about my work, I just shared one link and it spoke for me clearly.",
    name: "Sharon N.",
    role: "Operations Analyst",
    impact: "Higher engagement from shared profile links",
  },
  {
    quote:
      "The best part was that employers could ask about my experience even when I was away. By the time they contacted me, they already understood my work history and skills much better.",
    name: "David O.",
    role: "Backend Developer",
    impact: "Better-informed follow-up conversations",
  },
  {
    quote:
      "My twin helped me secure a remote job because the hiring team could explore my experience before our first call. They were impressed by how modern and easy it was to share my CV.",
    name: "Kevin M.",
    role: "Remote Product Specialist",
    impact: "Helped secure a remote role",
  },
  {
    quote:
      "As an HR manager, I appreciated being able to share one link with candidates and quickly understand their background. The conversational CV made screening more engaging and efficient.",
    name: "Angela W.",
    role: "HR Manager",
    impact: "More engaging candidate screening",
  },
  {
    quote:
      "The twin gave my personal brand a fresh, modern edge. As a digital marketer, I loved sharing a CV that felt interactive instead of sending another static document.",
    name: "Lydia K.",
    role: "Digital Marketer",
    impact: "A more memorable personal brand",
  },
];

function TestimonialAvatar({
  name,
}: {
  name: string;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/22 bg-cyan-300/10 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100 sm:h-16 sm:w-16">
      {initials}
    </div>
  );
}

function HomeActions({
  isAuthenticated,
  isLoading,
  hasExistingTwin,
  isLoggingOut,
  onLogout,
}: {
  isAuthenticated: boolean;
  isLoading: boolean;
  hasExistingTwin: boolean;
  isLoggingOut: boolean;
  onLogout: () => Promise<void>;
}) {
  if (isLoading) {
    return <div className="h-10 w-36 rounded-full border border-white/10 bg-white/6" />;
  }

  if (isAuthenticated) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/upload"
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          {hasExistingTwin ? "Update Twin" : "Create Twin"}
        </Link>
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={isLoggingOut}
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/12 bg-white/8 px-4 text-sm font-semibold text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Link
        href="/login"
        className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/12 bg-white/8 px-4 text-sm font-semibold text-white transition hover:bg-white/12"
      >
        Login
      </Link>
      <Link
        href="/register"
        className="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90"
      >
        Create account
      </Link>
    </div>
  );
}

function LandingSkeleton() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="hero-grid absolute inset-0 opacity-30" />
        <div className="hero-orb hero-orb-cyan" />
        <div className="hero-orb hero-orb-amber" />
      </div>

      <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-8 lg:px-12 xl:px-14">
        <div className="rounded-full border border-white/10 bg-black/70 px-4 py-3">
          <div className="h-10 w-full rounded-full bg-white/6" />
        </div>

        <div className="mt-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 sm:p-8">
            <div className="h-4 w-28 rounded-full bg-white/10" />
            <div className="mt-4 h-24 rounded-[1.5rem] bg-white/8" />
            <div className="mt-4 h-16 rounded-[1.5rem] bg-white/8" />
          </div>
          <div className="mt-4 rounded-[2rem] border border-white/10 bg-white/6 p-6 sm:p-8">
            <div className="h-4 w-40 rounded-full bg-white/10" />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="h-20 rounded-[1.2rem] bg-white/8" />
              <div className="h-20 rounded-[1.2rem] bg-white/8" />
              <div className="h-20 rounded-[1.2rem] bg-white/8" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasExistingTwin, setHasExistingTwin] = useState(false);
  const [publicTwinLink, setPublicTwinLink] = useState<string | null>(null);
  const [isTwinLinkCopied, setIsTwinLinkCopied] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
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
          setHasExistingTwin(false);
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

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) {
      return;
    }

    let cancelled = false;

    async function loadTwinState() {
      try {
        const response = await apiFetch("/api/v1/profiles/edit/me", {
          cache: "no-store",
        });

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setHasExistingTwin(false);
          setPublicTwinLink(null);
          return;
        }

        const payload = (await response.json()) as { publicLink?: string | null };
        setHasExistingTwin(true);
        setPublicTwinLink(payload.publicLink ?? null);
      } catch {
        if (!cancelled) {
          setHasExistingTwin(false);
          setPublicTwinLink(null);
        }
      }
    }

    void loadTwinState();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isAuthLoading]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveTestimonial((current) => (current + 1) % testimonials.length);
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await apiFetch("/api/v1/auth/logout", {
        method: "POST",
      });
      setIsAuthenticated(false);
      setHasExistingTwin(false);
      setPublicTwinLink(null);
      setIsTwinLinkCopied(false);
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function handleCopyTwinLink() {
    if (!publicTwinLink) {
      return;
    }

    await navigator.clipboard.writeText(publicTwinLink);
    setIsTwinLinkCopied(true);
  }

  const primaryHref = isAuthenticated ? "/upload" : "/register";
  const primaryLabel = isAuthenticated
    ? hasExistingTwin
      ? "Update Twin"
      : "Create Twin"
    : "Create your Twin";
  const currentTestimonial = testimonials[activeTestimonial];

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="hero-grid absolute inset-0 opacity-30" />
        <div className="hero-orb hero-orb-cyan" />
        <div className="hero-orb hero-orb-amber" />
        <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,rgba(140,244,255,0.16),transparent_55%)]" />
      </div>

      <section className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-8 sm:py-5 lg:px-12 xl:px-14">
        <header className="rounded-full border border-white/10 bg-black/72 px-4 py-3 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
                Chat Me AI
              </p>
            </div>

            <nav className="hidden items-center gap-5 text-sm text-white/64 md:flex">
              <a
                href="#steps"
                className="inline-flex min-h-8 items-center justify-center rounded-full border border-white/10 bg-white/6 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                Steps
              </a>
              <a
                href="#stories"
                className="inline-flex min-h-8 items-center justify-center rounded-full border border-white/10 bg-white/6 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                Customer Feedback
              </a>
            </nav>

            <HomeActions
              isAuthenticated={isAuthenticated}
              isLoading={isAuthLoading}
              hasExistingTwin={hasExistingTwin}
              isLoggingOut={isLoggingOut}
              onLogout={handleLogout}
            />
          </div>
        </header>

        {isAuthenticated && publicTwinLink ? (
          <section className="mt-4 rounded-[1.5rem] border border-cyan-300/20 bg-cyan-300/8 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/75">
                  Your public twin link
                </p>
                <a
                  href={publicTwinLink}
                  className="mt-1 block truncate text-sm font-semibold text-white underline decoration-white/25 underline-offset-4"
                >
                  {publicTwinLink}
                </a>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyTwinLink()}
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-black transition hover:bg-cyan-50"
              >
                {isTwinLinkCopied ? "Copied" : "Copy link"}
              </button>
            </div>
          </section>
        ) : null}

        <section className="public-twin-hero relative mt-5 overflow-hidden rounded-[2rem] border border-white/10 px-5 py-6 sm:px-7 sm:py-8 lg:px-8 lg:py-9">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.08),transparent_24%),radial-gradient(circle_at_88%_86%,rgba(140,244,255,0.12),transparent_24%)]" />
          <div className="relative text-center">
            {accessMessage ? (
              <div className="mb-4 max-w-2xl rounded-[1rem] border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                {accessMessage}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {featureChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[0.72rem] font-medium text-white/74"
                >
                  {chip}
                </span>
              ))}
            </div>

            <h1
              className="mt-5 mx-auto max-w-4xl text-[clamp(2.15rem,5vw,4.8rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-white"
              aria-label="Let employers chat and talk to you when you are away"
            >
              <TypewriterName text="Let employers chat and talk to you when you are away" />
            </h1>

            <p className="mt-4 mx-auto max-w-2xl text-sm leading-6 text-white/72 sm:text-base sm:leading-7">
              Build a public AI twin from your CV, photo, persona, and equip it
              with your social media links so employers can talk to you any time.
            </p>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href={primaryHref}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90 sm:min-h-12 sm:px-6"
                >
                  {primaryLabel}
              </Link>
            </div>
          </div>
        </section>

        <section
          id="steps"
          className="public-twin-hero relative mt-4 overflow-hidden rounded-[2rem] border border-white/10 p-5 sm:p-6"
        >
          <ChatStarfield />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_16%,rgba(255,255,255,0.08),transparent_22%),radial-gradient(circle_at_84%_82%,rgba(140,244,255,0.1),transparent_24%)]" />
          <div className="relative z-10">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
              Steps to get started
            </p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/68">
              Three short steps to get your public twin ready.
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {steps.map((step) => (
              <article
                key={step.id}
                className="rounded-[1.25rem] border border-white/10 bg-black/22 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/22 bg-cyan-300/10 text-xs font-semibold tracking-[0.18em] text-cyan-100">
                    {step.id}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-white/66">{step.detail}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          id="stories"
          className="public-twin-hero relative mt-4 overflow-hidden rounded-[2rem] border border-white/10 p-5 sm:p-6 lg:p-7"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.08),transparent_24%),radial-gradient(circle_at_88%_86%,rgba(140,244,255,0.12),transparent_24%)]" />
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                What customers say
              </p>
            </div>

            <div className="flex items-center gap-2">
              {testimonials.map((item, index) => (
                <button
                  key={`${item.name}-${item.role}`}
                  type="button"
                  onClick={() => setActiveTestimonial(index)}
                  aria-label={`Show testimonial ${index + 1}`}
                  className={`h-2.5 rounded-full transition ${
                    index === activeTestimonial ? "w-8 bg-white" : "w-2.5 bg-white/26 hover:bg-white/48"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="relative z-10 mt-5">
            <article
              key={`${currentTestimonial.name}-${activeTestimonial}`}
              className="animate-[testimonialFade_420ms_ease] rounded-[1.6rem] border border-white/10 bg-black/24 p-5 sm:p-6"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  <TestimonialAvatar name={currentTestimonial.name} />
                  <div>
                    <p className="text-sm font-semibold text-white sm:text-base">
                      {currentTestimonial.name}
                    </p>
                    <p className="mt-1 text-sm text-white/56">{currentTestimonial.role}</p>
                  </div>
                </div>
                <p className="rounded-full border border-cyan-300/20 bg-cyan-300/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                  {currentTestimonial.impact}
                </p>
              </div>

              <p className="mt-6 max-w-4xl text-[1.05rem] leading-8 text-white/84 sm:text-[1.2rem]">
                “{currentTestimonial.quote}”
              </p>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LandingSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
