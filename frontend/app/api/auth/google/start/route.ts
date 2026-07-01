import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

function getBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXTAUTH_URL?.trim();
  return configured ? configured.replace(/\/$/, "") : request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const mode = request.nextUrl.searchParams.get("mode") === "login" ? "login" : "register";

  if (!clientId) {
    const url = new URL(`/${mode}`, request.url);
    url.searchParams.set("error", "google_config");
    return NextResponse.redirect(url);
  }

  const baseUrl = getBaseUrl(request);
  const redirectUri = `${baseUrl}/auth/google/callback`;
  const state = randomUUID();
  const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  googleUrl.searchParams.set("client_id", clientId);
  googleUrl.searchParams.set("redirect_uri", redirectUri);
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "openid email profile");
  googleUrl.searchParams.set("state", state);
  googleUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(googleUrl);
  response.cookies.set("google_oauth_state", state, {
    httpOnly: false,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
    secure: baseUrl.startsWith("https://"),
  });

  return response;
}
