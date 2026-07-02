import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME =
  process.env.AUTH_SESSION_COOKIE_NAME?.trim() || "chat_me_ai_session";
const API_BASE_URL =
  (process.env.API_BASE_URL?.trim() || "http://localhost:8000").replace(/\/$/, "");

type AuthStatusResponse = {
  authenticated?: boolean;
};

export async function proxy(request: NextRequest) {
  if (!request.cookies.has(AUTH_COOKIE_NAME)) {
    return NextResponse.next();
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/status`, {
      cache: "no-store",
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
    });

    if (!response.ok) {
      return NextResponse.next();
    }

    const payload = (await response.json()) as AuthStatusResponse;
    if (payload.authenticated === true) {
      return NextResponse.redirect(new URL("/upload", request.url));
    }
  } catch {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/register"],
};
