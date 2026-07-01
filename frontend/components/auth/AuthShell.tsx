import Link from "next/link";
import { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthShell({
  title,
  subtitle,
  children,
}: AuthShellProps) {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[var(--bg)] px-4 py-6 text-[var(--text)] sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-grid absolute inset-0 opacity-40" />
        <div className="hero-orb hero-orb-cyan" />
        <div className="hero-orb hero-orb-amber" />
        <div className="hero-orb hero-orb-rose" />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-sm flex-col justify-center">
        <header className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="text-sm font-semibold tracking-[0.08em] text-[var(--accent)]"
          >
            Chat Me AI
          </Link>

          <Link
            href="/"
            className="text-sm text-white/64 transition hover:text-white"
          >
            Back
          </Link>
        </header>

        <section className="mx-auto w-full">
          <div className="mb-4 text-center">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-sm text-white/64">{subtitle}</p>
            ) : null}
          </div>

          {children}
        </section>
      </div>
    </main>
  );
}
