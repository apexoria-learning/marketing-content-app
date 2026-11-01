import { NextResponse, type NextRequest } from "next/server";
import { isMiddlewareUserAllowed } from "./server/auth/middleware";
import {
  createMiddlewareDatabaseClient,
  getExpiredSessionCookies,
} from "./server/db/middleware";
import { isUnauthenticatedError } from "./server/auth/session-error";

function createContentSecurityPolicy(nonce: string): string {
  const scriptPolicy =
    process.env.NODE_ENV === "development"
      ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
      : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const upgradePolicy =
    process.env.NODE_ENV === "production" ? "; upgrade-insecure-requests" : "";

  return (
    [
      "default-src 'self'",
      `script-src ${scriptPolicy}`,
      `style-src 'self' 'nonce-${nonce}'`,
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ") + upgradePolicy
  );
}

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createMiddlewareDatabaseClient(
    request,
    (cookies, headers) => {
      for (const { name, value } of cookies) {
        request.cookies.set(name, value);
      }

      requestHeaders.set("cookie", request.cookies.toString());
      response = NextResponse.next({ request: { headers: requestHeaders } });

      for (const { name, value, options } of cookies) {
        response.cookies.set(name, value, options);
      }

      for (const [name, value] of Object.entries(headers)) {
        response.headers.set(name, value);
      }
    },
  );
  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data.user;

  if (error && !isUnauthenticatedError(error)) {
    console.error("Middleware session verification failed.", {
      code: error.code,
      status: error.status,
    });
  }

  const pathname = request.nextUrl.pathname;
  // The component gallery exists for Playwright/axe only; the page itself
  // also 404s in production.
  const isDevOnlyRoute =
    process.env.NODE_ENV !== "production" && pathname === "/design-system";
  const isPublicRoute =
    isDevOnlyRoute ||
    pathname === "/sign-in" ||
    pathname === "/no-access" ||
    pathname === "/auth/callback" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/api/health";
  const isServerActionRequest =
    request.method === "POST" &&
    request.headers.has("Next-Action") &&
    !pathname.startsWith("/api/");

  if (!isServerActionRequest && user && !isMiddlewareUserAllowed(user.email)) {
    const expiredCookies = getExpiredSessionCookies(request);
    try {
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "local",
      });

      if (signOutError) {
        console.error("Denied session sign-out failed.", {
          code: signOutError.code,
          status: signOutError.status,
        });
      }
    } catch {
      console.error(
        "Denied session sign-out request failed; clearing local credentials.",
      );
    }

    for (const cookie of expiredCookies) {
      request.cookies.delete(cookie.name);
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }

    if (pathname.startsWith("/api/")) {
      response = responseWithCookies(
        response,
        NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }),
      );
    } else if (pathname !== "/no-access") {
      response = redirectWithCookies(
        response,
        new URL("/no-access", request.url),
      );
    }
  } else if (!isServerActionRequest && !user && !isPublicRoute) {
    if (pathname.startsWith("/api/")) {
      response = responseWithCookies(
        response,
        NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
      );
    } else {
      const next = `${pathname}${request.nextUrl.search}`;
      const destination = new URL("/sign-in", request.url);
      destination.searchParams.set("next", next);
      response = redirectWithCookies(response, destination);
    }
  }

  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

function redirectWithCookies(
  currentResponse: NextResponse,
  destination: URL,
): NextResponse {
  return responseWithCookies(
    currentResponse,
    NextResponse.redirect(destination),
  );
}

function responseWithCookies(
  currentResponse: NextResponse,
  destinationResponse: NextResponse,
): NextResponse {
  for (const cookie of currentResponse.cookies.getAll()) {
    destinationResponse.cookies.set(cookie);
  }

  for (const name of ["Cache-Control", "Expires", "Pragma"]) {
    const value = currentResponse.headers.get(name);

    if (value) {
      destinationResponse.headers.set(name, value);
    }
  }

  return destinationResponse;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icons/).*)",
    },
  ],
};
