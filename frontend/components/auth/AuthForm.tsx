"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { apiFetch } from "@/lib/api";

type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
  initialEmail?: string;
  registeredNotice?: boolean;
  initialError?: string | null;
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const initialState: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSubmitLabel(mode: AuthMode, isSubmitting: boolean): string {
  if (!isSubmitting) {
    return mode === "login" ? "Login" : "Sign up";
  }

  return mode === "login" ? "Signing in..." : "Signing up...";
}

export function AuthForm({
  mode,
  initialEmail = "",
  registeredNotice = false,
  initialError = null,
}: AuthFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    ...initialState,
    email: initialEmail,
  });
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(
    registeredNotice ? "Account created. You can now log in." : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
    setInfo(null);
  }

  function validate(): string | null {
    if (mode === "register") {
      if (!form.firstName.trim() || !form.lastName.trim()) {
        return "First name and last name are required.";
      }
    }

    if (!EMAIL_PATTERN.test(form.email.trim())) {
      return "Enter a valid email address.";
    }

    if (form.password.length < 8) {
      return "Password must be at least 8 characters.";
    }

    if (mode === "register" && form.password !== form.confirmPassword) {
      return "Passwords do not match.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload =
        mode === "register"
          ? {
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
              email: form.email.trim(),
              password: form.password,
            }
          : {
              email: form.email.trim(),
              password: form.password,
            };

      const response = await apiFetch(`/api/v1/auth/${mode}`, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const responsePayload = (await response.json()) as { detail?: string };

      if (!response.ok) {
        throw new Error(responsePayload.detail || "Unable to continue right now.");
      }

      if (mode === "register") {
        await apiFetch("/api/v1/auth/logout", {
          method: "POST",
        });

        const nextEmail = encodeURIComponent(form.email.trim());
        router.push(`/login?registered=1&email=${nextEmail}`);
        return;
      }

      router.push("/upload");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to continue right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="w-full rounded-[1.5rem] border border-white/10 bg-white/8 p-5 shadow-[0_20px_80px_rgba(4,10,22,0.28)] backdrop-blur-xl sm:p-6">
      {info ? (
        <div className="rounded-[1rem] border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {info}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[1rem] border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <form
        className={`${info || error ? "mt-4" : ""} grid gap-3.5`}
        onSubmit={handleSubmit}
      >
        <a
          href={`/api/auth/google/start?mode=${mode}`}
          className="flex h-11 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5 shrink-0"
          >
            <path
              fill="#EA4335"
              d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.6 3.6 14.5 2.7 12 2.7 6.9 2.7 2.8 6.9 2.8 12s4.1 9.3 9.2 9.3c5.3 0 8.8-3.7 8.8-8.9 0-.6-.1-1.1-.2-1.5H12Z"
            />
            <path
              fill="#4285F4"
              d="M21.8 12.4c0-.6-.1-1.1-.2-1.5H12v3.9h5.4c-.3 1.4-1.1 2.5-2.3 3.3l3 2.3c1.8-1.7 2.7-4.2 2.7-7.2Z"
            />
            <path
              fill="#FBBC05"
              d="M6.1 14.5c-.2-.6-.4-1.3-.4-2s.1-1.4.4-2l-3.1-2.4C2.3 9.3 2 10.6 2 12s.3 2.7 1 3.9l3.1-2.4Z"
            />
            <path
              fill="#34A853"
              d="M12 21.3c2.5 0 4.6-.8 6.2-2.3l-3-2.3c-.8.6-1.9 1-3.2 1-2.5 0-4.7-1.7-5.5-4l-3.1 2.4c1.6 3.1 4.9 5.2 8.6 5.2Z"
            />
            <path
              fill="#4285F4"
              d="M6.5 13.7c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7L3.4 7.9C2.5 9.1 2 10.5 2 12s.5 2.9 1.4 4.1l3.1-2.4Z"
            />
          </svg>
          <span>Continue with Google</span>
        </a>

        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-white/35">
          <span className="h-px flex-1 bg-white/10" />
          <span>or</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {mode === "register" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-white/84">First name</span>
              <input
                type="text"
                autoComplete="given-name"
                value={form.firstName}
                onChange={(event) => updateField("firstName", event.target.value)}
                className="h-11 w-full rounded-xl border border-white/12 bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-sky-300/50"
                placeholder="Amina"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-white/84">Last name</span>
              <input
                type="text"
                autoComplete="family-name"
                value={form.lastName}
                onChange={(event) => updateField("lastName", event.target.value)}
                className="h-11 w-full rounded-xl border border-white/12 bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-sky-300/50"
                placeholder="Njeri"
              />
            </label>
          </div>
        ) : null}

        <label className="grid gap-2">
          <span className="text-sm font-medium text-white/84">Email address</span>
          <input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            className="h-11 w-full rounded-xl border border-white/12 bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-sky-300/50"
            placeholder="name@example.com"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-white/84">Password</span>
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={form.password}
            onChange={(event) => updateField("password", event.target.value)}
            className="h-11 w-full rounded-xl border border-white/12 bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-sky-300/50"
            placeholder="At least 8 characters"
          />
        </label>

        {mode === "register" ? (
          <label className="grid gap-2">
            <span className="text-sm font-medium text-white/84">Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(event) =>
                updateField("confirmPassword", event.target.value)
              }
              className="h-11 w-full rounded-xl border border-white/12 bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-sky-300/50"
              placeholder="Repeat your password"
            />
          </label>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 inline-flex h-11 items-center justify-center rounded-full bg-sky-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {getSubmitLabel(mode, isSubmitting)}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-white/64">
        <span>
          {mode === "login" ? "Need an account?" : "Already have an account?"}
        </span>
        <Link
          href={mode === "login" ? "/register" : "/login"}
          className="font-semibold text-[var(--accent)] transition hover:text-[var(--accent-strong)]"
        >
          {mode === "login" ? "Register" : "Login"}
        </Link>
      </div>
    </section>
  );
}
