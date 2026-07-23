"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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

type DashboardSubscriptionRow = {
  userId: string;
  email: string;
  publicProfileId: string | null;
  publicTwinUrl: string | null;
  status: string;
  planLabel: string;
  freePublicChatsUsed: number;
  freePublicChatsLimit: number;
  accessStartsAt: string | null;
  accessExpiresAt: string | null;
  manualAccessGrantedByEmail: string | null;
  manualAccessGrantedAt: string | null;
  updatedAt: string | null;
};

type DashboardPayload = {
  summary: DashboardSummary;
  users: DashboardUserRow[];
  usage: DashboardUsageRow[];
  subscriptions: DashboardSubscriptionRow[];
};

type PageMode = "loading" | "admin";
type DashboardSection = "overview" | "users" | "usage" | "subscriptions";
type ManualAccessDuration = "2_days" | "1_week" | "1_month" | "custom";

const manualAccessOptions: Array<{ value: ManualAccessDuration; label: string }> = [
  { value: "2_days", label: "2 days" },
  { value: "1_week", label: "1 week" },
  { value: "1_month", label: "1 month" },
  { value: "custom", label: "Custom date" },
];

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
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatStatusLabel(value: string): string {
  if (!value) {
    return "Inactive";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function AdminDashboard({
  data,
  activeSection,
  onSectionChange,
  onManualAccessGrant,
  onManualAccessRevoke,
}: {
  data: DashboardPayload;
  activeSection: DashboardSection;
  onSectionChange: (section: DashboardSection) => void;
  onManualAccessGrant: (input: {
    userId: string;
    duration: ManualAccessDuration;
    customExpiresAt?: string;
  }) => Promise<void>;
  onManualAccessRevoke: (userId: string) => Promise<void>;
}) {
  const [grantDurations, setGrantDurations] = useState<Record<string, ManualAccessDuration>>({});
  const [customDates, setCustomDates] = useState<Record<string, string>>({});
  const [grantingUserId, setGrantingUserId] = useState<string | null>(null);
  const [grantMessage, setGrantMessage] = useState<string | null>(null);
  const [expandedGrantDetails, setExpandedGrantDetails] = useState<Record<string, boolean>>({});

  const navigationItems: Array<{
    id: DashboardSection;
    label: string;
    description: string;
  }> = [
    { id: "overview", label: "Overview", description: "General statistics" },
    { id: "users", label: "Users", description: "Accounts and twins" },
    { id: "usage", label: "Usage", description: "Requests and tokens" },
    { id: "subscriptions", label: "Subscriptions", description: "Plans and end dates" },
  ];

  async function handleGrant(row: DashboardSubscriptionRow) {
    const duration = grantDurations[row.userId] ?? "2_days";
    const customDate = customDates[row.userId];

    if (duration === "custom" && !customDate) {
      setGrantMessage("Choose a custom end date before granting access.");
      return;
    }

    setGrantingUserId(row.userId);
    setGrantMessage(null);

    try {
      await onManualAccessGrant({
        userId: row.userId,
        duration,
        customExpiresAt: duration === "custom" ? new Date(customDate).toISOString() : undefined,
      });
      setGrantMessage(`Manual access updated for ${row.email}.`);
    } catch (grantError) {
      setGrantMessage(
        grantError instanceof Error ? grantError.message : "Unable to grant manual access.",
      );
    } finally {
      setGrantingUserId(null);
    }
  }

  async function handleRevoke(row: DashboardSubscriptionRow) {
    setGrantingUserId(row.userId);
    setGrantMessage(null);

    try {
      await onManualAccessRevoke(row.userId);
      setExpandedGrantDetails((current) => ({
        ...current,
        [row.userId]: false,
      }));
      setGrantMessage(`Manual access revoked for ${row.email}.`);
    } catch (revokeError) {
      setGrantMessage(
        revokeError instanceof Error ? revokeError.message : "Unable to revoke manual access.",
      );
    } finally {
      setGrantingUserId(null);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-[2rem] border border-white/10 bg-white/8 p-5 backdrop-blur-xl xl:sticky xl:top-10 xl:h-fit">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
          Navigation
        </p>
        <nav className="mt-5 space-y-3">
          {navigationItems.map((item) => {
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                className={`flex w-full flex-col rounded-[1.4rem] border px-4 py-4 text-left transition ${
                  isActive
                    ? "border-cyan-200/50 bg-cyan-200/14 text-white"
                    : "border-white/8 bg-slate-950/20 text-white/70 hover:border-white/16 hover:bg-white/6 hover:text-white"
                }`}
              >
                <span className="text-base font-semibold">{item.label}</span>
                <span className="mt-1 text-sm opacity-80">{item.description}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="space-y-6">
        {activeSection === "overview" ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                Overview
              </p>
              <h2 className="text-2xl font-semibold text-white">General statistics</h2>
              <p className="text-sm leading-7 text-white/70">
                Total users, twins, requests, token usage, and current cost across the platform.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                { label: "Total users", value: formatNumber(data.summary.totalUsers) },
                { label: "Total twins", value: formatNumber(data.summary.totalTwins) },
                { label: "Requests sent", value: formatNumber(data.summary.totalRequests) },
                { label: "Tokens so far", value: formatNumber(data.summary.totalTokens) },
                { label: "Current cost", value: formatCurrency(data.summary.totalCost) },
              ].map((item) => (
                <article
                  key={item.label}
                  className="rounded-[1.75rem] border border-white/10 bg-slate-950/20 p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                    {item.label}
                  </p>
                  <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
                    {item.value}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeSection === "users" ? (
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
              <p className="text-sm text-white/58">{formatNumber(data.users.length)} users loaded</p>
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
        ) : null}

        {activeSection === "usage" ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                Usage
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Request totals by public twin
              </h2>
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
        ) : null}

        {activeSection === "subscriptions" ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                  Subscriptions
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Billing status and plan details
                </h2>
              </div>
              <p className="text-sm text-white/58">
                {formatNumber(data.subscriptions.length)} users loaded
              </p>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-xs text-white/78">
                <thead className="text-[0.65rem] uppercase tracking-[0.16em] text-white/42">
                  <tr>
                    <th className="px-2 py-2">User</th>
                    <th className="px-2 py-2">Twin</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Plan</th>
                    <th className="px-2 py-2">Manual access</th>
                    <th className="px-2 py-2">Free usage</th>
                    <th className="px-2 py-2">Start date</th>
                    <th className="px-2 py-2">End date</th>
                  </tr>
                </thead>
                <tbody>
                  {grantMessage ? (
                    <tr>
                      <td colSpan={8} className="px-2 py-2">
                        <div className="rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-xs text-white/72">
                          {grantMessage}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {data.subscriptions.map((row) => (
                    <tr
                      key={`${row.userId}-${row.publicProfileId ?? "no-profile"}`}
                      className="border-t border-white/8 align-top"
                    >
                      <td className="px-2 py-2">
                        <div className="font-medium text-white">{row.email}</div>
                        <div className="mt-0.5 max-w-32 truncate font-mono text-[0.65rem] text-white/50">
                          {row.userId}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        {row.publicTwinUrl ? (
                          <div>
                            <div className="max-w-32 truncate font-medium text-white">
                              {row.publicProfileId}
                            </div>
                            <a
                              href={row.publicTwinUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-0.5 inline-block text-[0.65rem] text-sky-200 underline decoration-white/20 underline-offset-4"
                            >
                              Open
                            </a>
                          </div>
                        ) : (
                          <span className="text-white/42">No twin yet</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white">
                          {formatStatusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-2 py-2">{row.planLabel}</td>
                      <td className="min-w-[220px] px-2 py-2">
                        {row.manualAccessGrantedByEmail ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedGrantDetails((current) => ({
                                ...current,
                                [row.userId]: !current[row.userId],
                              }))
                            }
                            className="mb-1.5 rounded-lg border border-cyan-200/20 bg-cyan-200/10 px-2 py-1 text-left text-[0.65rem] text-cyan-50 transition hover:border-cyan-200/35 hover:bg-cyan-200/14"
                            title={`Granted by ${row.manualAccessGrantedByEmail}${
                              row.manualAccessGrantedAt
                                ? ` on ${formatDate(row.manualAccessGrantedAt)}`
                                : ""
                            }`}
                          >
                            <span className="font-semibold">Manual grant</span>
                            {expandedGrantDetails[row.userId] ? (
                              <span className="mt-0.5 block text-cyan-50/68">
                                Granted by {row.manualAccessGrantedByEmail}
                                {row.manualAccessGrantedAt ? (
                                  <span className="block">
                                    {formatDate(row.manualAccessGrantedAt)}
                                  </span>
                                ) : null}
                              </span>
                            ) : null}
                          </button>
                        ) : (
                          <div className="mb-1.5 text-[0.65rem] text-white/42">No manual grant</div>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {row.manualAccessGrantedByEmail ? (
                            <button
                              type="button"
                              onClick={() => void handleRevoke(row)}
                              disabled={!row.publicProfileId || grantingUserId === row.userId}
                              className="h-8 rounded-lg border border-rose-200/30 bg-rose-300/12 px-2.5 text-xs font-semibold text-rose-50 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {grantingUserId === row.userId ? "Revoking..." : "Revoke"}
                            </button>
                          ) : (
                            <>
                              <select
                                value={grantDurations[row.userId] ?? "2_days"}
                                onChange={(event) =>
                                  setGrantDurations((current) => ({
                                    ...current,
                                    [row.userId]: event.target.value as ManualAccessDuration,
                                  }))
                                }
                                disabled={!row.publicProfileId || grantingUserId === row.userId}
                                className="h-8 rounded-lg border border-white/12 bg-slate-950/60 px-2 text-xs text-white outline-none transition focus:border-cyan-200/50 disabled:opacity-50"
                              >
                                {manualAccessOptions.map((option) => (
                                  <option key={option.value} value={option.value} className="bg-slate-950">
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              {(grantDurations[row.userId] ?? "2_days") === "custom" ? (
                                <input
                                  type="datetime-local"
                                  value={customDates[row.userId] ?? ""}
                                  onChange={(event) =>
                                    setCustomDates((current) => ({
                                      ...current,
                                      [row.userId]: event.target.value,
                                    }))
                                  }
                                  disabled={!row.publicProfileId || grantingUserId === row.userId}
                                  className="h-8 rounded-lg border border-white/12 bg-slate-950/60 px-2 text-xs text-white outline-none transition focus:border-cyan-200/50 disabled:opacity-50"
                                />
                              ) : null}
                              <button
                                type="button"
                                onClick={() => void handleGrant(row)}
                                disabled={!row.publicProfileId || grantingUserId === row.userId}
                                className="h-8 rounded-lg border border-cyan-200/30 bg-cyan-200/14 px-2.5 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-200/20 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {grantingUserId === row.userId ? "Granting..." : "Grant"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        {formatNumber(row.freePublicChatsUsed)} / {formatNumber(row.freePublicChatsLimit)}
                      </td>
                      <td className="px-2 py-2">{formatDate(row.accessStartsAt)}</td>
                      <td className="px-2 py-2">{formatDate(row.accessExpiresAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [mode, setMode] = useState<PageMode>("loading");
  const [adminData, setAdminData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeSection, setActiveSection] = useState<DashboardSection>("overview");

  const loadDashboard = useCallback(async () => {
    const adminResponse = await apiFetch("/api/v1/admin/dashboard", {
      cache: "no-store",
    });

    if (adminResponse.status === 401) {
      router.replace("/login");
      return;
    }

    if (adminResponse.ok) {
      const payload = (await adminResponse.json()) as DashboardPayload;
      setAdminData(payload);
      setMode("admin");
      setError(null);
      return;
    }

    if (adminResponse.status !== 403) {
      const payload = (await adminResponse.json()) as { detail?: string };
      throw new Error(payload.detail ?? "Unable to load the dashboard.");
    }

    router.replace("/upload");
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      try {
        await loadDashboard();
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load the dashboard.");
          setMode("loading");
        }
      }
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [loadDashboard]);

  async function handleManualAccessGrant(input: {
    userId: string;
    duration: ManualAccessDuration;
    customExpiresAt?: string;
  }) {
    const response = await apiFetch("/api/v1/admin/access-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(payload?.detail ?? "Unable to grant manual access.");
    }

    await loadDashboard();
  }

  async function handleManualAccessRevoke(userId: string) {
    const response = await apiFetch(`/api/v1/admin/access-grants/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(payload?.detail ?? "Unable to revoke manual access.");
    }

    await loadDashboard();
  }

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
                Admin dashboard
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-8 text-white/74">
                Start on the overview for general statistics, then use the left sidebar for users,
                usage, and subscription details.
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

        {mode === "loading" ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/8 p-6 text-sm text-white/72 backdrop-blur-xl">
            Loading dashboard...
          </section>
        ) : null}

        {error ? (
          <section className="rounded-[2rem] border border-rose-300/30 bg-rose-500/10 p-6 text-sm text-rose-100">
            {error}
          </section>
        ) : null}
        {mode === "admin" && adminData ? (
          <AdminDashboard
            data={adminData}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            onManualAccessGrant={handleManualAccessGrant}
            onManualAccessRevoke={handleManualAccessRevoke}
          />
        ) : null}
      </div>
    </main>
  );
}
