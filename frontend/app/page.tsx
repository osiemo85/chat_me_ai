import Link from "next/link";

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

export default function Home() {
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
          <Link
            href="/upload"
            className="rounded-full bg-sky-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
          >
            Get Started
          </Link>
        </header>

        <div className="flex flex-1 flex-col">
          <section className="flex min-h-[70vh] flex-1 items-center justify-center py-10 text-center">
            <div className="hero-message mx-auto flex max-w-5xl flex-col items-center rounded-[2.2rem] border border-cyan-300/20 bg-white/6 px-6 py-10 backdrop-blur-xl sm:px-10 lg:px-14 lg:py-14">
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
                <Link
                  href="/upload"
                  className="inline-flex min-h-14 items-center justify-center rounded-full bg-sky-400 px-8 text-lg font-semibold text-slate-950 shadow-[0_0_40px_rgba(56,189,248,0.4)] transition hover:scale-[1.02] hover:bg-sky-300"
                >
                  Get Started
                </Link>
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
