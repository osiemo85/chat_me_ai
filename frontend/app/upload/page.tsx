"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";

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
  linkedinUrl: string;
  githubUrl: string;
  otherUrl: string;
  persona: string;
  cvFileName: string;
};

const initialState: FormState = {
  firstName: "",
  secondName: "",
  email: "",
  linkedinUrl: "",
  githubUrl: "",
  otherUrl: "",
  persona: personaOptions[0],
  cvFileName: "",
};

export default function UploadPage() {
  const [form, setForm] = useState<FormState>(initialState);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const completion = useMemo(() => {
    const requiredFields = [
      form.firstName,
      form.secondName,
      form.email,
      form.persona,
      form.cvFileName,
    ];

    const completed = requiredFields.filter(Boolean).length;
    return Math.round((completed / requiredFields.length) * 100);
  }, [form]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setIsSubmitted(false);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    updateField("cvFileName", file?.name ?? "");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitted(true);
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-16 text-[var(--text)] sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
              Upload Profile
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
              Build your AI twin profile
            </h1>
            <p className="mt-3 max-w-2xl text-lg leading-8 text-white/70">
              Frontend only for now. Add your details, optional social links,
              CV PDF, and persona. File storage and backend save come later.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/12 bg-white/8 px-6 font-semibold text-white transition hover:bg-white/12"
          >
            Back to Home
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl sm:p-8"
          >
            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-white/84">
                  First name
                </span>
                <input
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
                  Second name
                </span>
                <input
                  value={form.secondName}
                  onChange={(event) =>
                    updateField("secondName", event.target.value)
                  }
                  placeholder="Lovelace"
                  className="w-full rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-white/32 focus:border-sky-300/60"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-white/84">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder="ada@example.com"
                  className="w-full rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-white/32 focus:border-sky-300/60"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-white/84">
                  LinkedIn link
                </span>
                <input
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
                  type="url"
                  value={form.otherUrl}
                  onChange={(event) =>
                    updateField("otherUrl", event.target.value)
                  }
                  placeholder="Portfolio, X, personal website, or another profile"
                  className="w-full rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-white/32 focus:border-sky-300/60"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-white/84">
                  Persona
                </span>
                <select
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
                  CV PDF
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="w-full rounded-2xl border border-dashed border-white/18 bg-black/20 px-4 py-3 text-sm text-white/74 file:mr-4 file:rounded-full file:border-0 file:bg-sky-400 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                type="submit"
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-sky-400 px-8 text-lg font-semibold text-slate-950 shadow-[0_0_40px_rgba(56,189,248,0.35)] transition hover:scale-[1.02] hover:bg-sky-300"
              >
                Save Frontend Draft
              </button>
              <p className="text-sm text-white/58">
                No backend save yet. This is a front-end-only capture flow.
              </p>
            </div>

            {isSubmitted ? (
              <div className="mt-6 rounded-[1.5rem] border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm leading-7 text-emerald-100">
                Draft captured in the UI. Next backend step will persist these
                fields plus the uploaded CV file reference.
              </div>
            ) : null}
          </form>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
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
                Required for this front-end draft: first name, second name,
                email, persona, and CV PDF.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
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
                  <dt className="text-white/45">Social links</dt>
                  <dd className="mt-1 text-white/78">
                    {[
                      form.linkedinUrl && "LinkedIn",
                      form.githubUrl && "GitHub",
                      form.otherUrl && "Other",
                    ]
                      .filter(Boolean)
                      .join(", ") || "No social links added"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100">
                Planned backend shape
              </p>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-white/68">
                <li>One profile record for identity and links</li>
                <li>Store only the CV file reference, not file bytes, in Postgres</li>
                <li>Supabase file storage wiring intentionally left out for now</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
