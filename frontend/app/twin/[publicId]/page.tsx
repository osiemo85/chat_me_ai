import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getApiBaseUrl } from "@/lib/api";

import { TwinChatPanel } from "./TwinChatPanel";
import { TypewriterName } from "./TypewriterName";

type TwinPageProps = {
  params: Promise<{ publicId: string }>;
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

function SocialIcon({ label }: { label: string }) {
  if (label === "LinkedIn") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="social-icon social-icon-linkedin">
        <rect width="24" height="24" rx="4" />
        <path fill="#ffffff" d="M19.5 19.5h-3.07v-4.8c0-1.15-.03-2.62-1.6-2.62-1.6 0-1.85 1.24-1.85 2.53v4.89H9.91V9.62h2.95v1.35h.04c.41-.78 1.41-1.6 2.9-1.6 3.1 0 3.7 2.04 3.7 4.71v5.42ZM6.45 8.27a1.79 1.79 0 1 1 0-3.58 1.79 1.79 0 0 1 0 3.58ZM4.91 19.5h3.08V9.62H4.91v9.88Z" />
      </svg>
    );
  }

  if (label === "GitHub") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="social-icon social-icon-github">
        <path d="M12 .3a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.74.08-.74 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18a4.7 4.7 0 0 1 1.24 3.22c0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .3Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="social-icon social-icon-other">
      <path d="M13.06 5.06a3.5 3.5 0 0 1 4.95 0l.93.93a3.5 3.5 0 0 1 0 4.95l-2.47 2.47a3.5 3.5 0 0 1-4.95 0 .9.9 0 0 1 1.27-1.27 1.7 1.7 0 0 0 2.41 0l2.47-2.47a1.7 1.7 0 0 0 0-2.41l-.93-.93a1.7 1.7 0 0 0-2.41 0L12.9 7.76a.9.9 0 1 1-1.27-1.27l1.43-1.43ZM10.94 18.94a3.5 3.5 0 0 1-4.95 0l-.93-.93a3.5 3.5 0 0 1 0-4.95l2.47-2.47a3.5 3.5 0 0 1 4.95 0 .9.9 0 1 1-1.27 1.27 1.7 1.7 0 0 0-2.41 0l-2.47 2.47a1.7 1.7 0 0 0 0 2.41l.93.93a1.7 1.7 0 0 0 2.41 0l1.43-1.43a.9.9 0 1 1 1.27 1.27l-1.43 1.43Z" />
    </svg>
  );
}

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
  const heroText = `I am, ${fullName}`;
  const socialLinks = [
    profile.linkedinUrl
      ? { href: profile.linkedinUrl, label: "LinkedIn" }
      : null,
    profile.githubUrl ? { href: profile.githubUrl, label: "GitHub" } : null,
    profile.otherUrl ? { href: profile.otherUrl, label: "Other Link" } : null,
  ].filter(Boolean) as Array<{ href: string; label: string }>;
  const publicContact =
    profile.contactEmail || profile.contactPhone
      ? { email: profile.contactEmail, phone: profile.contactPhone }
      : null;
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/12 bg-black">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <a href="#" className="shrink-0 text-base font-semibold text-white sm:text-2xl">
            Chat Me AI
          </a>

          <nav className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
            {publicContact ? (
              <a
                href="#contact"
                aria-label="Contact"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center px-0 text-sm font-semibold text-white/82 transition hover:text-white sm:h-auto sm:min-h-10 sm:w-auto sm:min-w-0 sm:rounded-full sm:border sm:border-white/18 sm:px-4 sm:hover:bg-white/10"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 sm:hidden">
                  <rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <path d="m4.5 7 7.5 6 7.5-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
                <span className="hidden sm:inline">Contact</span>
              </a>
            ) : null}
            <div className="ml-3 flex min-w-0 items-center justify-end gap-1 sm:ml-8 sm:gap-2">
              {socialLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.label}
                  className="social-link inline-flex h-9 min-w-9 items-center justify-center gap-2 rounded-full px-2 text-xs font-semibold text-white/76 transition hover:bg-white/10 hover:text-white sm:h-auto sm:min-w-0 sm:rounded-none sm:px-2 sm:py-2 sm:text-sm"
                >
                  <SocialIcon label={item.label} />
                  <span className="hidden sm:inline">{item.label}</span>
                </a>
              ))}
            </div>
            <a
              href="#chat"
              className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-white px-3 text-xs font-semibold text-black transition hover:bg-white/88 sm:min-h-11 sm:px-5 sm:text-sm"
            >
              Chat Now
            </a>
          </nav>
        </div>
      </header>

      <section className="public-twin-hero border-b border-white/10">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[clamp(8.5rem,31vw,13rem)_minmax(0,1fr)] items-start gap-x-4 gap-y-5 px-4 py-8 sm:px-6 sm:py-10 md:grid-cols-[0.72fr_1.28fr] md:gap-x-12 md:gap-y-0 lg:min-h-[30rem] lg:gap-x-16 lg:px-8 lg:py-12">
          <div className="passport-stage row-span-1 flex -translate-y-2 justify-start md:row-span-2 md:-translate-y-5">
            {profile.passportUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.passportUrl}
                alt={`${fullName} passport profile`}
                className="floating-passport aspect-square w-full max-w-52 rounded-full object-cover object-top shadow-[0_26px_90px_rgba(0,0,0,0.54)] sm:max-w-56 md:max-w-72 lg:max-w-[21rem]"
              />
            ) : (
              <div className="floating-passport flex aspect-square w-full max-w-52 items-center justify-center rounded-full border border-white/14 text-center text-xs text-white/48 sm:max-w-56 md:max-w-72 lg:max-w-[21rem]">
                Profile image not available
              </div>
            )}
          </div>

          <div className="self-center text-left">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-white/54 sm:text-xs">
              Chat with Me
            </p>
            <h1
              className="mt-2 max-w-5xl text-[clamp(1.5rem,4.8vw,4.9rem)] font-semibold leading-[1] text-white sm:mt-3"
              aria-label={heroText}
            >
              <TypewriterName text={heroText} loop />
            </h1>
          </div>
          <div className="col-span-2 max-w-3xl md:col-span-1 md:col-start-2">
            <p className="max-w-3xl text-sm leading-6 text-white/70 sm:text-base sm:leading-7">
              Chat with me about my background, experience, skills, and
              professional work.
            </p>

            <div className="mt-4 flex flex-wrap justify-start gap-x-4 gap-y-2">
              {socialLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.label}
                  className="social-link inline-flex items-center gap-2 text-sm font-semibold text-white/68 transition hover:text-white"
                >
                  <SocialIcon label={item.label} />
                  <span className="hidden sm:inline">{item.label}</span>
                </a>
              ))}
            </div>

            <p className="mt-4 max-w-3xl border-t border-white/10 pt-4 text-sm leading-6 text-white/58">
              {profile.persona}
            </p>

            {publicContact ? (
              <section id="contact" className="mt-5 scroll-mt-20 border-t border-white/10 pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/48">
                  Get in touch
                </p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
                  {publicContact.email ? (
                    <a
                      href={`mailto:${publicContact.email}`}
                      className="text-white/78 underline decoration-white/25 underline-offset-4 transition hover:text-white"
                    >
                      {publicContact.email}
                    </a>
                  ) : null}
                  {publicContact.phone ? (
                    <a
                      href={`tel:${publicContact.phone.replace(/\s+/g, "")}`}
                      className="text-white/78 underline decoration-white/25 underline-offset-4 transition hover:text-white"
                    >
                      {publicContact.phone}
                    </a>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </section>

      <div id="chat" className="mx-auto w-full max-w-7xl scroll-mt-4 px-2 py-5 sm:px-4 sm:py-6 lg:px-6 xl:px-8">
        <TwinChatPanel
          publicProfileId={profile.publicProfileId}
          candidateName={fullName}
          candidateImageUrl={profile.passportUrl}
        />
      </div>
    </main>
  );
}
