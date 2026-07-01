import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = {
  title: "Login | Chat Me AI",
  description: "Sign in to continue building and managing your Chat Me AI twin.",
};

type LoginPageProps = {
  searchParams: Promise<{ email?: string; registered?: string; error?: string }>;
};

function resolveAuthError(error?: string): string | null {
  if (error === "google_config") {
    return "Google sign-in is not configured yet.";
  }

  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Login"
      subtitle=""
    >
      <AuthForm
        mode="login"
        initialEmail={params.email}
        initialError={resolveAuthError(params.error)}
        registeredNotice={params.registered === "1"}
      />
    </AuthShell>
  );
}
