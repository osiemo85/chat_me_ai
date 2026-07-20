"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

type BillingStatus = {
  status: string;
  freePublicChatsUsed: number;
  freePublicChatsLimit: number;
  accessStartsAt: string | null;
  accessExpiresAt: string | null;
  hostedPlanUrl: string;
  paymentRequired: boolean;
  planLabel: string;
  currency: string;
  amountDisplay: string;
};

type CheckoutLinkPayload = {
  hostedUrl: string;
  callbackUrl: string;
};

const PROFILE_REQUIRED_ERROR = "Profile not found.";

const planCards = [
  {
    id: "yearly-access",
    eyebrow: "Featured plan",
    name: "Yearly access",
    price: "$5",
    cadence: "for the whole year",
    description:
      "Subscribe now to avoid limits. Free accounts can only make 2 chats.",
    highlights: [
      "2 chats on free accounts",
      "Unlimited public chats after subscribing",
      "Simple yearly payment",
    ],
    cta: "Subscribe now",
    isUpcoming: false,
  },
  {
    id: "upcoming",
    eyebrow: "Next plan",
    name: "Upcoming",
    price: "Soon",
    cadence: "advanced features are coming",
    description: "Plan with advanced features such as voice chat.",
    highlights: [
      "Voice chat access",
      "More advanced capabilities",
      "Details coming soon",
    ],
    cta: "Coming soon",
    isUpcoming: true,
  },
];

function formatDate(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default function SubscriptionPage() {
  const router = useRouter();
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const isSubscribed = billingStatus?.status === "active";
  const needsProfileBeforeSubscription = error === PROFILE_REQUIRED_ERROR;

  useEffect(() => {
    let cancelled = false;

    async function loadBilling() {
      try {
        const response = await apiFetch("/api/v1/payments/me", {
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const payload = (await response.json()) as BillingStatus | { detail?: string };

        if (!response.ok) {
          throw new Error(
            "detail" in payload && payload.detail
              ? payload.detail
              : "Unable to load subscription details.",
          );
        }

        if (!cancelled) {
          setBillingStatus(payload as BillingStatus);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load subscription details.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBilling();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleCheckout() {
    setIsStartingCheckout(true);
    setError(null);

    try {
      const response = await apiFetch("/api/v1/payments/paystack/checkout-link", {
        method: "POST",
      });
      const payload = (await response.json()) as CheckoutLinkPayload | { detail?: string };

      if (!response.ok) {
        throw new Error(
          "detail" in payload && payload.detail
            ? payload.detail
            : "Unable to start yearly access checkout.",
        );
      }

      window.location.href = (payload as CheckoutLinkPayload).hostedUrl;
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Unable to start yearly access checkout.",
      );
      setIsStartingCheckout(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--bg)] px-6 py-10 text-[var(--text)] sm:px-10 sm:py-14">
      <div className="hero-orb hero-orb-cyan" aria-hidden="true" />
      <div className="hero-orb hero-orb-amber" aria-hidden="true" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="hero-panel relative overflow-hidden rounded-[2rem] border border-white/10 px-6 py-8 sm:px-10 sm:py-12">
          <div
            className="hero-grid pointer-events-none absolute inset-0 opacity-40"
            aria-hidden="true"
          />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                Subscription
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                {isSubscribed ? "Thank you for subscribing" : "Subscribe now to avoid limits"}
              </h1>
              {!isSubscribed ? (
                <p className="mt-4 max-w-2xl text-base leading-8 text-white/72 sm:text-lg">
                  You can only make 2 chats with free accounts. Pay $5 for whole year
                  access.
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/upload"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/14 bg-white/8 px-5 text-sm font-semibold text-white transition hover:bg-white/12"
              >
                Back
              </Link>
              <button
                type="button"
                onClick={() => void handleCheckout()}
                disabled={isLoading || isStartingCheckout || isSubscribed}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--warm)] px-6 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubscribed
                  ? "Subscribed!"
                  : isStartingCheckout
                    ? "Redirecting..."
                    : "Start subscription"}
              </button>
              {isSubscribed ? (
                <p className="w-full text-right text-sm text-white/68">
                  Expires {formatDate(billingStatus?.accessExpiresAt ?? null)}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-[1.6rem] border border-rose-300/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
            {needsProfileBeforeSubscription ? (
              <p>
                Profile not found. Complete it{" "}
                <Link href="/upload" className="font-semibold underline underline-offset-4">
                  here
                </Link>{" "}
                before you subscribe.
              </p>
            ) : (
              error
            )}
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
            {planCards.map((plan) => (
              <article
                key={plan.id}
                className="hero-panel relative flex min-h-[34rem] h-full flex-col rounded-[1.9rem] border border-white/10 p-6 sm:p-8"
              >
                <div className="absolute right-5 top-5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100">
                  {plan.isUpcoming
                    ? "Placeholder"
                    : billingStatus?.status === "active"
                      ? "Active"
                      : "Best value"}
                </div>

                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                  {plan.eyebrow}
                </p>
                <h2 className="mt-4 text-2xl font-semibold text-white">{plan.name}</h2>
                <div className="mt-6 flex items-end gap-2">
                  <span className="text-5xl font-semibold tracking-[-0.05em] text-white">
                    {plan.price}
                  </span>
                  <span className="pb-1 text-sm text-white/64">{plan.cadence}</span>
                </div>
                <p className="mt-5 text-sm leading-7 text-white/72">{plan.description}</p>

                <div className="mt-6 space-y-3">
                  {plan.highlights.map((item) => (
                    <div
                      key={item}
                      className="rounded-[1.15rem] border border-white/10 bg-black/18 px-4 py-3 text-sm text-white/78"
                    >
                      {item}
                    </div>
                  ))}
                </div>

                {!plan.isUpcoming ? (
                  <>
                    <div className="mt-8 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[1.2rem] border border-white/10 bg-black/18 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                          Status
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {isLoading ? "Loading..." : billingStatus?.status ?? "Unavailable"}
                        </p>
                      </div>

                      <div className="rounded-[1.2rem] border border-white/10 bg-black/18 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                          Free chats
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {isLoading
                            ? "Loading..."
                            : billingStatus
                              ? `${billingStatus.freePublicChatsUsed} / ${billingStatus.freePublicChatsLimit}`
                              : "Unavailable"}
                        </p>
                      </div>

                      <div className="rounded-[1.2rem] border border-white/10 bg-black/18 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                          Expires
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {isLoading
                            ? "Loading..."
                            : formatDate(billingStatus?.accessExpiresAt ?? null)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleCheckout()}
                      disabled={isStartingCheckout || isLoading || isSubscribed}
                      className="mt-auto inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSubscribed
                        ? "Subscribed!"
                        : isStartingCheckout
                          ? "Redirecting..."
                          : plan.cta}
                    </button>
                  </>
                ) : (
                  <div className="mt-auto rounded-[1.35rem] border border-dashed border-white/16 bg-black/14 p-5 text-sm leading-7 text-white/58">
                    Plan with advanced features such as voice chat.
                    <div className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/12 bg-white/6 px-5 text-sm font-semibold text-white/58">
                      {plan.cta}
                    </div>
                  </div>
                )}
              </article>
            ))}
        </section>
      </div>
    </main>
  );
}
