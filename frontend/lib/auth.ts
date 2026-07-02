import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getApiBaseUrl } from "@/lib/api";

type AuthStatusResponse = {
  authenticated?: boolean;
};

export async function redirectIfAuthenticated(destination = "/upload"): Promise<void> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  if (!cookieHeader) {
    return;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/status`, {
      cache: "no-store",
      headers: {
        cookie: cookieHeader,
      },
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as AuthStatusResponse;
    if (payload.authenticated === true) {
      redirect(destination);
    }
  } catch {
    // Leave the auth pages reachable if the status check is unavailable.
  }
}
