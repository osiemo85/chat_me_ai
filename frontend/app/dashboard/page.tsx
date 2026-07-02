"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

type DashboardSummary = {
  totalUsers: number;
  totalTwins: number;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
};

type DashboardUserRow = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  authProvider: string;
  publicProfileId: string | null;
  publicTwinUrl: string | null;
  persona: string | null;
  uploadStatus: string | null;
  cvProcessingStatus: string | null;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  createdAt: string;
  lastActivityAt: string | null;
};

type DashboardUsageRow = {
  userId: string;
  email: string;
  publicProfileId: string;
  publicTwinUrl: string;
  requestsSent: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCost: number;
  lastRequestAt: string | null;
};

type DashboardPayload = {
  summary: DashboardSummary;
  users: DashboardUserRow[];
  usage: DashboardUsageRow[];
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const response = await apiFetch("/api/v1/admin/dashboard", {
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (response.status === 403) {
          router.replace("/?message=This%20is%20an%20admin%20page.");
          return;
        }

        const payload = (await response.json()) as DashboardPayload | { detail?: string };

        if (!response.ok) {
          throw new Error(
            "detail" in payload && payload.detail
              ? payload.detail
              : "Unable to load the dashboard.",
          );
        }

        if (!cancelled) {
          setData(payload as DashboardPayload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the dashboard.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text)] sm:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/10 bg-white/8 px-6 py-5 backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                Admin Dashboard
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                Usage and payment management
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-8 text-white/74">
                Review token usage, current cost, user records, and each public twin link in one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/upload"
                className="rounded-full border border-white/12 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                Go to upload
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/12 disabled:opacity-60"
              >
                {isLoggingOut ? "Signing out..." : "Logout"}
              </button>
            </div>
          </div>
        </header>

        {isLoading ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/8 p-6 text-sm text-white/72 backdrop-blur-xl">
            Loading dashboard...
          </section>
        ) : null}

        {error ? (
          <section className="rounded-[2rem] border border-rose-300/30 bg-rose-500/10 p-6 text-sm text-rose-100">
            {error}
          </section>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "Total users", value: formatNumber(data.summary.totalUsers) },
                { label: "Total twins", value: formatNumber(data.summary.totalTwins) },
                { label: "Requests sent", value: formatNumber(data.summary.totalRequests) },
                { label: "Tokens so far", value: formatNumber(data.summary.totalTokens) },
                { label: "Current cost", value: formatCurrency(data.summary.totalCost) },
              ].map((item) => (
                <article
                  key={item.label}
                  className="rounded-[1.75rem] border border-white/10 bg-white/8 p-5 backdrop-blur-xl"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                    {item.label}
                  </p>
                  <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
                    {item.value}
                  </p>
                </article>
              ))}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                    Users
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Current accounts and twin details
                  </h2>
                </div>
                <p className="text-sm text-white/58">
                  {formatNumber(data.users.length)} users loaded
                </p>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm text-white/78">
                  <thead className="text-xs uppercase tracking-[0.2em] text-white/42">
                    <tr>
                      <th className="px-3 py-3">User</th>
                      <th className="px-3 py-3">Email</th>
                      <th className="px-3 py-3">Twin</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Tokens</th>
                      <th className="px-3 py-3">Cost</th>
                      <th className="px-3 py-3">Last activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((row) => (
                      <tr key={row.userId} className="border-t border-white/8 align-top">
                        <td className="px-3 py-4">
                          <div className="font-semibold text-white">
                            {row.firstName} {row.lastName}
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/42">
                            {row.authProvider}
                          </div>
                        </td>
                        <td className="px-3 py-4">{row.email}</td>
                        <td className="px-3 py-4">
                          {row.publicTwinUrl ? (
                            <div className="space-y-2">
                              <div className="font-medium text-white">{row.publicProfileId}</div>
                              <a
                                href={row.publicTwinUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-200 underline decoration-white/20 underline-offset-4"
                              >
                                Open public twin
                              </a>
                            </div>
                          ) : (
                            <span className="text-white/42">No twin yet</span>
                          )}
                        </td>
                        <td className="px-3 py-4">
                          <div>{row.uploadStatus ?? "No upload"}</div>
                          <div className="mt-1 text-white/50">
                            {row.cvProcessingStatus ?? "No processing"}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div>{formatNumber(row.totalTokens)}</div>
                          <div className="mt-1 text-white/50">
                            {formatNumber(row.totalRequests)} requests
                          </div>
                        </td>
                        <td className="px-3 py-4">{formatCurrency(row.totalCost)}</td>
                        <td className="px-3 py-4">
                          <div>{formatDate(row.lastActivityAt)}</div>
                          <div className="mt-1 text-white/50">
                            Joined {formatDate(row.createdAt)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                    Usage
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Request totals by public twin
                  </h2>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm text-white/78">
                  <thead className="text-xs uppercase tracking-[0.2em] text-white/42">
                    <tr>
                      <th className="px-3 py-3">User ID</th>
                      <th className="px-3 py-3">Email</th>
                      <th className="px-3 py-3">Public twin</th>
                      <th className="px-3 py-3">Requests</th>
                      <th className="px-3 py-3">Prompt</th>
                      <th className="px-3 py-3">Completion</th>
                      <th className="px-3 py-3">Total tokens</th>
                      <th className="px-3 py-3">Cost</th>
                      <th className="px-3 py-3">Last request</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.usage.map((row) => (
                      <tr
                        key={`${row.userId}-${row.publicProfileId}`}
                        className="border-t border-white/8 align-top"
                      >
                        <td className="px-3 py-4 font-mono text-xs text-white/72">{row.userId}</td>
                        <td className="px-3 py-4">{row.email}</td>
                        <td className="px-3 py-4">
                          <div className="font-medium text-white">{row.publicProfileId}</div>
                          <a
                            href={row.publicTwinUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-sky-200 underline decoration-white/20 underline-offset-4"
                          >
                            {row.publicTwinUrl}
                          </a>
                        </td>
                        <td className="px-3 py-4">{formatNumber(row.requestsSent)}</td>
                        <td className="px-3 py-4">{formatNumber(row.promptTokens)}</td>
                        <td className="px-3 py-4">{formatNumber(row.completionTokens)}</td>
                        <td className="px-3 py-4 font-semibold text-white">
                          {formatNumber(row.totalTokens)}
                        </td>
                        <td className="px-3 py-4">{formatCurrency(row.totalCost)}</td>
                        <td className="px-3 py-4">{formatDate(row.lastRequestAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
