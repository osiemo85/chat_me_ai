function normalizeBaseUrl(value: string | undefined): string {
  return value?.trim().replace(/\/$/, "") ?? "";
}

export function getApiBaseUrl(): string {
  const publicBaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
  if (publicBaseUrl) {
    return publicBaseUrl;
  }

  if (typeof window !== "undefined") {
    return "";
  }

  const serverBaseUrl = normalizeBaseUrl(process.env.API_BASE_URL);
  if (serverBaseUrl) {
    return serverBaseUrl;
  }

  return "http://localhost:8000";
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
  });
}
