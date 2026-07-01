import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = {
  title: "Register | Chat Me AI",
  description:
    "Create a Chat Me AI account to start building your public AI twin.",
};

type RegisterPageProps = {
  searchParams: Promise<{ error?: string }>;
};

function resolveAuthError(error?: string): string | null {
  if (error === "google_config") {
    return "Google sign-in is not configured yet.";
  }

  return null;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Signup to Chat with Me"
      subtitle=""
    >
      <AuthForm
        mode="register"
        initialError={resolveAuthError(params.error)}
      />
    </AuthShell>
  );
}
