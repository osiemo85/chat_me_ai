import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getApiBaseUrl } from "@/lib/api";

import { TwinChatPanel } from "./TwinChatPanel";

type TwinPageProps = {
  params: Promise<{ publicId: string }>;
};

type PublicProfile = {
  firstName: string;
  secondName: string;
  githubUrl: string | null;
  linkedinUrl: string | null;
  otherUrl: string | null;
  passportUrl: string | null;
  persona: string;
  publicProfileId: string;
  uploadStatus: string;
  cvProcessingStatus: string;
};

function extractPublicProfileIdFromSlug(slug: string): string {
  const match = slug.match(/(twin_[a-f0-9]+)$/i);
  return match?.[1] ?? slug;
}

async function getPublicProfile(publicId: string): Promise<PublicProfile | null> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/profiles/public/${publicId}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as PublicProfile;
}

export async function generateMetadata({ params }: TwinPageProps): Promise<Metadata> {
  const { publicId: slug } = await params;
  const publicId = extractPublicProfileIdFromSlug(slug);
  const profile = await getPublicProfile(publicId);

  if (!profile) {
    return {
      title: "Chat Me AI",
    };
  }

  const fullName = `${profile.firstName} ${profile.secondName}`;

  return {
    title: `Chat with Me - ${fullName}`,
    icons: {
      icon: [{ url: "/logo.ico" }],
      shortcut: [{ url: "/logo.ico" }],
      apple: [{ url: "/logo.ico" }],
    },
  };
}

export default async function TwinPage({ params }: TwinPageProps) {
  const { publicId: slug } = await params;
  const publicId = extractPublicProfileIdFromSlug(slug);
  const profile = await getPublicProfile(publicId);

  if (!profile) {
    notFound();
  }

  const fullName = `${profile.firstName} ${profile.secondName}`;
  const socialLinks = [
    profile.linkedinUrl
      ? { href: profile.linkedinUrl, label: "LinkedIn" }
      : null,
    profile.githubUrl ? { href: profile.githubUrl, label: "GitHub" } : null,
    profile.otherUrl ? { href: profile.otherUrl, label: "Other Link" } : null,
  ].filter(Boolean) as Array<{ href: string; label: string }>;

  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text)] sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="rounded-[2rem] border border-white/10 bg-white/8 px-6 py-5 backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                Chat with Me
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                I am {fullName}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-8 text-white/74 sm:text-lg">
                Welcome to my professional profile. You are free to ask any
                questions about my background and experience. You may explore
                my social links provided to learn more about me. You can send
                an email directly from the chat interface and I will respond
                immediately.
              </p>
            </div>

            <nav className="flex flex-wrap items-center gap-3 lg:justify-end">
              {socialLinks.length > 0 ? (
                socialLinks.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/12 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                  >
                    {item.label}
                  </a>
                ))
              ) : (
                <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white/60">
                  No external links shared
                </span>
              )}
            </nav>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
            <div className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-black/18">
              {profile.passportUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.passportUrl}
                  alt={`${fullName} passport profile`}
                  className="h-[29rem] w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-[29rem] items-center justify-center text-sm text-white/48">
                  Profile image not available
                </div>
              )}
            </div>

          </section>

          <section className="space-y-6 rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                Professional Overview
              </p>
              <p className="mt-4 text-xl leading-8 text-white/74">
                Review my profile, explore my shared links, and ask questions to
                learn more about my background and experience.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/18 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                Speaking Style
              </p>
              <p className="mt-3 text-sm leading-7 text-white/74">
                {profile.persona}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/18 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                My Socials
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {socialLinks.length > 0 ? (
                  socialLinks.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white transition hover:bg-white/12"
                    >
                      {item.label}
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-white/60">No social links shared.</p>
                )}
              </div>
            </div>
          </section>
        </div>

        <TwinChatPanel
          publicProfileId={profile.publicProfileId}
          candidateName={fullName}
          candidateImageUrl={profile.passportUrl}
        />
      </div>
    </main>
  );
}
