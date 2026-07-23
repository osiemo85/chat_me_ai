"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChangeEvent,
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { apiFetch, getApiBaseUrl } from "@/lib/api";

const personaOptions = [
  "Professional",
  "Confident",
  "Friendly",
  "Technical",
  "Executive",
] as const;

type FormState = {
  firstName: string;
  secondName: string;
  email: string;
  contactEmail: string;
  contactPhone: string;
  linkedinUrl: string;
  githubUrl: string;
  otherUrl: string;
  persona: string;
  cvFileName: string;
  passportFileName: string;
};

type SubmissionResult = {
  is_update: boolean;
  public_link: string;
  public_profile_id: string;
};

type PublicProfile = {
  firstName: string;
  secondName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  otherUrl: string | null;
  passportUrl: string | null;
  persona: string;
  publicProfileId: string;
  uploadStatus: string;
  cvProcessingStatus: string;
};

type EditableProfile = {
  firstName: string;
  secondName: string;
  email: string;
  contactEmail: string | null;
  contactPhone: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  otherUrl: string | null;
  persona: string;
  publicProfileId: string;
  cvFileName: string | null;
  passportFileName: string | null;
};

type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type AuthMeResponse = {
  user: AuthUser;
};

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

type ProcessStage = "idle" | "uploading" | "extracting" | "preparing" | "ready" | "failed";

const initialState: FormState = {
  firstName: "",
  secondName: "",
  email: "",
  contactEmail: "",
  contactPhone: "",
  linkedinUrl: "",
  githubUrl: "",
  otherUrl: "",
  persona: personaOptions[0],
  cvFileName: "",
  passportFileName: "",
};

function extractPublicProfileIdFromSlug(slug: string): string {
  const match = slug.match(/(twin_[a-f0-9]+)$/i);
  return match?.[1] ?? slug;
}

function resolveStage(profile: PublicProfile | null, isSubmitting: boolean): ProcessStage {
  if (isSubmitting) {
    return "uploading";
  }

  if (!profile) {
    return "idle";
  }

  if (profile.uploadStatus === "failed" || profile.cvProcessingStatus === "failed") {
    return "failed";
  }

  if (profile.uploadStatus === "completed" && profile.cvProcessingStatus === "completed") {
    return "ready";
  }

  if (profile.cvProcessingStatus === "extracting") {
    return "extracting";
  }

  if (profile.uploadStatus === "uploaded") {
    return "preparing";
  }

  return "uploading";
}

function isEditableProfile(payload: EditableProfile | { detail?: string }): payload is EditableProfile {
  return "firstName" in payload;
}

function isPublicProfile(payload: PublicProfile | { detail?: string }): payload is PublicProfile {
  return "publicProfileId" in payload;
}

function UploadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const publicIdParam = searchParams.get("publicId");
  const normalizedPublicId = publicIdParam
    ? extractPublicProfileIdFromSlug(publicIdParam)
    : null;

  const [form, setForm] = useState<FormState>(initialState);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [prefillError, setPrefillError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] =
    useState<SubmissionResult | null>(null);
  const [profileStatus, setProfileStatus] = useState<PublicProfile | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [existingProfileId, setExistingProfileId] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const pollingTimerRef = useRef<number | null>(null);

  const completion = useMemo(() => {
    const requiredFields = [
      form.firstName,
      form.secondName,
      form.email,
      form.persona,
      form.cvFileName,
      form.passportFileName,
    ];

    const completed = requiredFields.filter(Boolean).length;
    return Math.round((completed / requiredFields.length) * 100);
  }, [form]);

  const activePublicId = submissionResult?.public_profile_id ?? normalizedPublicId;
  const activeEditableProfileId = normalizedPublicId ?? existingProfileId;
  const processStage = resolveStage(profileStatus, isSubmitting);
  const isProcessingView =
    isSubmitting ||
    (!!submissionResult &&
      processStage !== "ready" &&
      processStage !== "failed") ||
    processStage === "uploading" ||
    processStage === "extracting" ||
    processStage === "preparing";
  const isCompleteView = processStage === "ready" && submissionResult;
  const shareableLink = submissionResult?.public_link ?? null;
  const isSubscribed = billingStatus?.status === "active";

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const response = await apiFetch("/api/v1/auth/me", {
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const payload = (await response.json()) as
          | AuthMeResponse
          | { detail?: string };

        if (!response.ok || !("user" in payload)) {
          throw new Error(
            "detail" in payload && payload.detail
              ? payload.detail
              : "Unable to load your account.",
          );
        }

        if (cancelled) {
          return;
        }

        setCurrentUser(payload.user);
        setForm((current) => ({
          ...current,
          firstName: current.firstName || payload.user.firstName,
          secondName: current.secondName || payload.user.lastName,
          email: payload.user.email,
        }));
      } catch (error) {
        if (!cancelled) {
          setSubmissionError(
            error instanceof Error
              ? error.message
              : "Unable to load your account.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsAuthenticating(false);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (isAuthenticating || !currentUser) {
      return;
    }

    let cancelled = false;

    async function prefill() {
      setIsPrefilling(true);
      setPrefillError(null);

      try {
        const response = await apiFetch(
          normalizedPublicId
            ? `/api/v1/profiles/edit/${normalizedPublicId}`
            : "/api/v1/profiles/edit/me",
          { cache: "no-store" },
        );

        const payload = (await response.json()) as
          | EditableProfile
          | { detail?: string };

        if (!response.ok) {
          if (response.status === 404 && !normalizedPublicId) {
            if (!cancelled) {
              setExistingProfileId(null);
            }
            return;
          }

          throw new Error(
            "detail" in payload && payload.detail
              ? payload.detail
              : "Unable to load profile details.",
          );
        }

        if (!isEditableProfile(payload)) {
          throw new Error("Unable to load profile details.");
        }

        if (cancelled) {
          return;
        }

        setForm((current) => ({
          ...current,
          firstName: payload.firstName,
          secondName: payload.secondName,
          email: currentUser?.email ?? payload.email,
          contactEmail: payload.contactEmail ?? "",
          contactPhone: payload.contactPhone ?? "",
          linkedinUrl: payload.linkedinUrl ?? "",
          githubUrl: payload.githubUrl ?? "",
          otherUrl: payload.otherUrl ?? "",
          persona: payload.persona,
          cvFileName: payload.cvFileName ?? "",
          passportFileName: payload.passportFileName ?? "",
        }));
        setExistingProfileId(payload.publicProfileId);
      } catch (error) {
        if (!cancelled) {
          setPrefillError(
            error instanceof Error
              ? error.message
              : "Unable to load profile details.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsPrefilling(false);
        }
      }
    }

    void prefill();

    return () => {
      cancelled = true;
    };
  }, [currentUser, isAuthenticating, normalizedPublicId]);

  useEffect(() => {
    if (isAuthenticating || !currentUser) {
      return;
    }

    let cancelled = false;

    async function loadBilling() {
      try {
        const response = await apiFetch("/api/v1/payments/me", {
          cache: "no-store",
        });
        const payload = (await response.json()) as BillingStatus | { detail?: string };

        if (!response.ok) {
          throw new Error(
            "detail" in payload && payload.detail
              ? payload.detail
              : "Unable to load billing status.",
          );
        }

        if (!cancelled) {
          setBillingStatus(payload as BillingStatus);
        }
      } catch {
        if (!cancelled) {
          setBillingStatus(null);
        }
      }
    }

    void loadBilling();

    return () => {
      cancelled = true;
    };
  }, [currentUser, isAuthenticating]);

  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        window.clearTimeout(pollingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activePublicId || !submissionResult) {
      return;
    }

    if (processStage === "ready" || processStage === "failed") {
      if (pollingTimerRef.current) {
        window.clearTimeout(pollingTimerRef.current);
      }
      return;
    }

    let cancelled = false;

    async function pollStatus() {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/v1/profiles/public/${activePublicId}`, {
          cache: "no-store",
        });

        const payload = (await response.json()) as
          | PublicProfile
          | { detail?: string };

        if (!response.ok) {
          throw new Error(
            "detail" in payload && payload.detail
              ? payload.detail
              : "Unable to fetch processing status.",
          );
        }

        if (cancelled) {
          return;
        }

        if (!isPublicProfile(payload)) {
          throw new Error("Unable to fetch processing status.");
        }

        setProfileStatus(payload);
        setSubmissionError(null);

        const nextStage = resolveStage(payload, false);
        if (nextStage === "ready" || nextStage === "failed") {
          return;
        }

        pollingTimerRef.current = window.setTimeout(() => {
          void pollStatus();
        }, 1800);
      } catch (error) {
        if (!cancelled) {
          setSubmissionError(
            error instanceof Error
              ? error.message
              : "Unable to fetch processing status.",
          );
        }
      }
    }

    void pollStatus();

    return () => {
      cancelled = true;
      if (pollingTimerRef.current) {
        window.clearTimeout(pollingTimerRef.current);
      }
    };
  }, [activePublicId, processStage, submissionResult]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setCopied(false);
    setSubmissionError(null);
  }

  function handleCvFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    updateField("cvFileName", file.name);
  }

  function handlePassportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    updateField("passportFileName", file.name);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmissionError(null);
    setSubmissionResult(null);
    setProfileStatus(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/profiles`, {
        credentials: "include",
        body: formData,
        method: "POST",
      });

      const payload = (await response.json()) as
        | SubmissionResult
        | { detail?: string; error?: string };

      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const errorMessage =
          "detail" in payload
            ? payload.detail
            : "error" in payload
              ? payload.error
              : undefined;
        throw new Error(errorMessage || "Unable to save profile.");
      }

      const nextResult = payload as SubmissionResult;
      setCopied(false);
      setSubmissionResult(nextResult);
      setProfileStatus({
        firstName: form.firstName,
        secondName: form.secondName,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
        githubUrl: form.githubUrl || null,
        linkedinUrl: form.linkedinUrl || null,
        otherUrl: form.otherUrl || null,
        passportUrl: null,
        persona: form.persona,
        publicProfileId: nextResult.public_profile_id,
        uploadStatus: "uploading",
        cvProcessingStatus: "pending",
      });
      router.replace(`/upload?publicId=${nextResult.public_profile_id}`);
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "Unable to save profile.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopyLink() {
    if (!shareableLink) {
      return;
    }

    await navigator.clipboard.writeText(shareableLink);
    setCopied(true);
  }

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await apiFetch("/api/v1/auth/logout", {
        method: "POST",
      });
      router.replace("/login");
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "Unable to log out right now.",
      );
      setIsLoggingOut(false);
    }
  }

  const processSteps = [
    {
      key: "uploading",
      label: "Uploading files",
      description: "Saving your CV and passport to secure storage.",
      done: ["extracting", "preparing", "ready"].includes(processStage),
      active: processStage === "uploading",
    },
    {
      key: "extracting",
      label: "Extracting CV",
      description: "Reading your CV content for structured processing.",
      done: ["preparing", "ready"].includes(processStage),
      active: processStage === "extracting",
    },
    {
      key: "preparing",
      label: "Preparing twin",
      description: "Chunking profile content and finishing your public twin.",
      done: processStage === "ready",
      active: processStage === "preparing",
    },
    {
      key: "ready",
      label: "Ready",
      description: "Your shareable AI twin link is live.",
      done: processStage === "ready",
      active: processStage === "ready",
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-16 text-[var(--text)] sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        {isSubscribed ? (
          <div className="flex justify-end">
            <div className="flex flex-wrap justify-end gap-3">
              <Link
                href="/subscription"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-sky-400 px-6 font-semibold text-slate-950 transition hover:bg-sky-300"
              >
                View subscription!
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/12 bg-white/8 px-6 font-semibold text-white transition hover:bg-white/12"
              >
                Back to Home
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/12 bg-black/20 px-6 font-semibold text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
              Upload Profile
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
              {activeEditableProfileId ? "Update your AI twin" : "Build your AI twin profile"}
            </h1>
            <p className="mt-3 max-w-2xl text-lg leading-8 text-white/70">
              Add required identity details, your CV PDF, passport photo, and
              optional social links. After submit, this page tracks the full
              processing flow until the twin is ready.
            </p>
          </div>

          {!isSubscribed ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href="/subscription"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-sky-400 px-6 font-semibold text-slate-950 transition hover:bg-sky-300"
              >
                Subscribe Now
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/12 bg-white/8 px-6 font-semibold text-white transition hover:bg-white/12"
              >
                Back to Home
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/12 bg-black/20 px-6 font-semibold text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          ) : null}
        </div>

        {isAuthenticating ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/8 p-8 backdrop-blur-xl">
            <div className="mx-auto flex min-h-[24rem] max-w-xl items-center justify-center">
              <div className="h-20 w-20 animate-spin rounded-full border-4 border-white/12 border-t-sky-400" />
            </div>
          </section>
        ) : null}

        {!isAuthenticating && isProcessingView ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/8 p-8 backdrop-blur-xl">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div className="flex flex-col items-center justify-center rounded-[1.8rem] border border-sky-300/20 bg-black/20 px-6 py-10 text-center">
                <div className="h-24 w-24 animate-spin rounded-full border-4 border-white/12 border-t-sky-400" />
                <p className="mt-6 text-sm font-semibold uppercase tracking-[0.28em] text-sky-300">
                  Processing
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-white">
                  {processStage === "uploading"
                    ? "Uploading"
                    : processStage === "extracting"
                      ? "Extracting"
                      : "Preparing"}
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-7 text-white/66">
                  Stay on this page while your files are stored and your public
                  AI twin is prepared.
                </p>
              </div>

              <div className="space-y-4">
                {processSteps.map((step, index) => (
                  <div
                    key={step.key}
                    className={`rounded-[1.5rem] border p-5 transition ${
                      step.active
                        ? "border-sky-300/45 bg-sky-400/10"
                        : step.done
                          ? "border-emerald-300/30 bg-emerald-400/10"
                          : "border-white/10 bg-black/18"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">
                          Step {index + 1}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold text-white">
                          {step.label}
                        </h3>
                      </div>
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                          step.done
                            ? "bg-emerald-300 text-slate-950"
                            : step.active
                              ? "bg-sky-400 text-slate-950"
                              : "bg-white/10 text-white/60"
                        }`}
                      >
                        {step.done ? "✓" : index + 1}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-white/68">
                      {step.description}
                    </p>
                  </div>
                ))}

                {submissionError ? (
                  <div className="rounded-[1.5rem] border border-rose-400/25 bg-rose-400/10 p-4 text-sm leading-7 text-rose-100">
                    {submissionError}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {!isAuthenticating && isCompleteView && shareableLink ? (
          <section className="rounded-[2rem] border border-emerald-400/25 bg-emerald-400/10 p-8 backdrop-blur-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-100">
              AI Twin Ready
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white">
              Share your live twin
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50/80">
              This link is public and shareable. Copy it now and keep it safe.
              It appears on this page only and will disappear after a page
              reload.
            </p>

            <div className="mt-6 rounded-[1.5rem] border border-emerald-200/20 bg-black/15 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100/80">
                Shareable link
              </p>
              <p className="mt-2 text-sm leading-7 text-emerald-50/78">
                Share this public link with employers or anyone you want to
                review your AI twin profile.
              </p>
              <a
                href={shareableLink}
                className="mt-3 block break-all font-semibold text-white underline"
              >
                {shareableLink}
              </a>
            </div>

            <div className="mt-6 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 font-semibold text-slate-950 transition hover:bg-sky-100"
              >
                {copied ? "Copied" : "Copy Link"}
              </button>
              <Link
                href="/upload"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-sky-400 px-6 font-semibold text-slate-950 transition hover:bg-sky-300"
              >
                Update
              </Link>
              <Link
                href={shareableLink}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/12 bg-white/8 px-6 font-semibold text-white transition hover:bg-white/12"
              >
                Open Twin
              </Link>
            </div>
          </section>
        ) : null}

        {!isAuthenticating && !isProcessingView && !isCompleteView ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.06fr)_minmax(20.5rem,0.94fr)] xl:grid-cols-[minmax(0,0.98fr)_minmax(22.5rem,0.98fr)] lg:items-start">
            <form
              onSubmit={handleSubmit}
              className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl sm:p-8"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-white/84">
                    First name *
                  </span>
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={(event) =>
                      updateField("firstName", event.target.value)
                    }
                    placeholder="Ada"
                    className="w-full rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-white/32 focus:border-sky-300/60"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-white/84">
                    Second name *
                  </span>
                  <input
                    name="secondName"
                    value={form.secondName}
                    onChange={(event) =>
                      updateField("secondName", event.target.value)
                    }
                    placeholder="Lovelace"
                    className="w-full rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-white/32 focus:border-sky-300/60"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-white/84">Email *</span>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    readOnly
                    placeholder="ada@example.com"
                    className="w-full rounded-2xl border border-white/12 bg-black/10 px-4 py-3 text-white/78 outline-none placeholder:text-white/32"
                  />
                </label>

                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-white/84">Public contact details</p>
                  <p className="mt-1 text-xs leading-5 text-white/48">
                    Optional. These details are visible to anyone who can view your public twin.
                  </p>
                </div>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-white/84">Public email</span>
                  <input
                    name="contactEmail"
                    type="email"
                    value={form.contactEmail}
                    onChange={(event) => updateField("contactEmail", event.target.value)}
                    placeholder="hello@example.com"
                    className="w-full rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-white/32 focus:border-sky-300/60"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-white/84">Public phone</span>
                  <input
                    name="contactPhone"
                    type="tel"
                    value={form.contactPhone}
                    onChange={(event) => updateField("contactPhone", event.target.value)}
                    placeholder="+254 700 000 000"
                    className="w-full rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-white/32 focus:border-sky-300/60"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-white/84">
                    LinkedIn link
                  </span>
                  <input
                    name="linkedinUrl"
                    type="url"
                    value={form.linkedinUrl}
                    onChange={(event) =>
                      updateField("linkedinUrl", event.target.value)
                    }
                    placeholder="https://linkedin.com/in/..."
                    className="w-full rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-white/32 focus:border-sky-300/60"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-white/84">
                    GitHub link
                  </span>
                  <input
                    name="githubUrl"
                    type="url"
                    value={form.githubUrl}
                    onChange={(event) =>
                      updateField("githubUrl", event.target.value)
                    }
                    placeholder="https://github.com/..."
                    className="w-full rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-white/32 focus:border-sky-300/60"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-white/84">
                    Other link
                  </span>
                  <input
                    name="otherUrl"
                    type="url"
                    value={form.otherUrl}
                    onChange={(event) => updateField("otherUrl", event.target.value)}
                    placeholder="Portfolio, X, personal website, or another profile"
                    className="w-full rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-white/32 focus:border-sky-300/60"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-white/84">
                    Persona *
                  </span>
                  <select
                    name="persona"
                    value={form.persona}
                    onChange={(event) =>
                      updateField("persona", event.target.value)
                    }
                    className="w-full rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-sky-300/60"
                  >
                    {personaOptions.map((option) => (
                      <option key={option} value={option} className="bg-slate-950">
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-white/84">
                    CV PDF {activeEditableProfileId ? "" : "*"}
                  </span>
                  <input
                    name="cvFile"
                    type="file"
                    accept="application/pdf"
                    onChange={handleCvFileChange}
                    className="w-full rounded-2xl border border-dashed border-white/18 bg-black/20 px-4 py-3 text-sm text-white/74 file:mr-4 file:rounded-full file:border-0 file:bg-sky-400 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-white/84">
                    Passport photo {activeEditableProfileId ? "" : "*"}
                  </span>
                  <input
                    name="passportFile"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handlePassportFileChange}
                    className="w-full rounded-2xl border border-dashed border-white/18 bg-black/20 px-4 py-3 text-sm text-white/74 file:mr-4 file:rounded-full file:border-0 file:bg-sky-400 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button
                  type="submit"
                  disabled={isSubmitting || isPrefilling}
                  className="inline-flex min-h-14 items-center justify-center rounded-full bg-sky-400 px-8 text-lg font-semibold text-slate-950 shadow-[0_0_40px_rgba(56,189,248,0.35)] transition hover:scale-[1.02] hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {activeEditableProfileId ? "Update AI Twin" : "Create AI Twin"}
                </button>
                <p className="text-sm text-white/58">
                  {activeEditableProfileId
                    ? "Stored details are prefilled from your profile. Upload new files only if you want to replace the current CV or passport photo."
                    : "Create your profile by adding identity details, a CV PDF, and a passport photo."}
                </p>
              </div>

              {submissionError ? (
                <div className="mt-6 rounded-[1.5rem] border border-rose-400/25 bg-rose-400/10 p-4 text-sm leading-7 text-rose-100">
                  {submissionError}
                </div>
              ) : null}
            </form>

            <div className="space-y-6">
              {!isSubscribed ? (
                <div className="rounded-[1.35rem] border border-sky-300/20 bg-sky-400/8 px-4 py-3 backdrop-blur-xl">
                  <p className="text-xs leading-6 text-white/84">
                    <span className="font-semibold uppercase tracking-[0.24em] text-sky-200">
                      FREE ACCESS,
                    </span>{" "}
                    {billingStatus
                      ? `Current free usage: ${billingStatus.freePublicChatsUsed} / ${billingStatus.freePublicChatsLimit} chats used. Subscription: ${billingStatus.status}.`
                      : "Current free usage status is unavailable right now."}
                  </p>
                </div>
              ) : null}

              <aside className="space-y-6">
                <div className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl xl:h-full">
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                    Completion
                  </p>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-sky-400 transition-all"
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {completion}%
                  </p>
                  <p className="mt-2 text-sm leading-7 text-white/66">
                    {activeEditableProfileId
                      ? "Stored profile details are loaded from the database. Replace only the fields or files you want to update."
                      : "Required: first name, second name, email, persona, CV PDF, and passport photo."}
                  </p>

                  {prefillError ? (
                    <div className="mt-6 rounded-[1.5rem] border border-rose-400/25 bg-rose-400/10 p-4 text-sm leading-7 text-rose-100">
                      {prefillError}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl xl:h-full">
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                    Preview
                  </p>
                  <dl className="mt-4 space-y-4 text-sm">
                    <div>
                      <dt className="text-white/45">Name</dt>
                      <dd className="mt-1 text-white">
                        {[form.firstName, form.secondName].filter(Boolean).join(" ") ||
                          "Not filled yet"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-white/45">Email</dt>
                      <dd className="mt-1 text-white">
                        {form.email || "Not filled yet"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-white/45">Persona</dt>
                      <dd className="mt-1 text-white">{form.persona}</dd>
                    </div>
                    <div>
                      <dt className="text-white/45">CV file</dt>
                      <dd className="mt-1 text-white">
                        {form.cvFileName || "No PDF selected"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-white/45">Passport photo</dt>
                      <dd className="mt-1 text-white">
                        {form.passportFileName || "No passport photo selected"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-white/45">Social links</dt>
                      <dd className="mt-1 text-white/78">
                        {[
                          form.linkedinUrl && "LinkedIn",
                          form.githubUrl && "GitHub",
                          form.otherUrl && "Other",
                          form.contactEmail && form.contactPhone && "Contact",
                        ]
                          .filter(Boolean)
                          .join(", ") || "No social links added"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </aside>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[var(--bg)] px-6 py-16 text-[var(--text)] sm:px-10">
          <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center">
            <div className="h-20 w-20 animate-spin rounded-full border-4 border-white/12 border-t-sky-400" />
          </div>
        </main>
      }
    >
      <UploadPageContent />
    </Suspense>
  );
}
