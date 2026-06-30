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

export default async function TwinPage({ params }: TwinPageProps) {
  const { publicId: slug } = await params;
  const publicId = extractPublicProfileIdFromSlug(slug);
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/profiles/public/${publicId}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    notFound();
  }

  const profile = (await response.json()) as PublicProfile;
  const fullName = `${profile.firstName} ${profile.secondName}`;
  const socialLinks = [
    profile.linkedinUrl
      ? { href: profile.linkedinUrl, label: "LinkedIn" }
      : null,
    profile.githubUrl ? { href: profile.githubUrl, label: "GitHub" } : null,
    profile.otherUrl ? { href: profile.otherUrl, label: "Other Link" } : null,
  ].filter(Boolean) as Array<{ href: string; label: string }>;

  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-16 text-[var(--text)] sm:px-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
              Public AI Twin
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
              {fullName}
            </h1>
            <p className="mt-3 text-lg leading-8 text-white/70">
              Persona: {profile.persona}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
              Identity
            </p>

            <div className="mt-5 overflow-hidden rounded-[1.8rem] border border-white/10 bg-black/18">
              {profile.passportUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.passportUrl}
                  alt={`${fullName} passport profile`}
                  className="h-80 w-full object-cover"
                />
              ) : (
                <div className="flex h-80 items-center justify-center text-sm text-white/48">
                  No passport image available
                </div>
              )}
            </div>
          </section>

          <section className="space-y-6 rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                Shareable profile
              </p>
              <p className="mt-4 text-xl leading-8 text-white/74">
                This unique AI twin identity is tied to the current CV and
                current passport photo for this candidate.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/18 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                Public ID
              </p>
              <p className="mt-2 break-all text-sm text-white/76">
                {profile.publicProfileId}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/18 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                Social links
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

            <div className="rounded-[1.5rem] border border-white/10 bg-black/18 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                Processing status
              </p>
              <p className="mt-2 text-sm leading-7 text-white/70">
                Upload: {profile.uploadStatus}. CV content:{" "}
                {profile.cvProcessingStatus}.
              </p>
            </div>
          </section>
        </div>

        <TwinChatPanel
          publicProfileId={profile.publicProfileId}
          fullName={fullName}
        />
      </div>
    </main>
  );
}
