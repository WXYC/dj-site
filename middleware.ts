import { NextRequest, NextResponse } from "next/server";

const AUTH_BASE = process.env.NEXT_PUBLIC_AUTH_URL!;

// Helper function to create a timeout signal
function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

// Check if AUTH_BASE is properly configured
if (!AUTH_BASE) {
  console.error(
    "[Middleware] NEXT_PUBLIC_AUTH_URL environment variable is not set!"
  );
}

export const config = {
  matcher: ["/dashboard/admin/:path*", "/dashboard/:path*", "/login", "/onboarding"],
};

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;

  let session = null;
  let isAuthenticated = false;

  try {
    // Add debugging info
    console.log(
      `[Middleware] Checking auth for ${url.pathname} with AUTH_BASE: ${AUTH_BASE}`
    );

    const res = await fetch(`${AUTH_BASE}/session`, {
      headers: {
        cookie: req.headers.get("cookie") ?? "",
        "user-agent": req.headers.get("user-agent") ?? "",
        "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
      },
      credentials: "include",
      // Use custom timeout signal for better compatibility
      signal: createTimeoutSignal(5000), // 5 second timeout
    });

    if (res.ok) {
      const data = await res.json();
      session = data.session;
      isAuthenticated = Boolean(session);
      console.log(
        `[Middleware] Auth check successful: ${
          isAuthenticated ? "authenticated" : "not authenticated"
        }`
      );
    } else {
      console.warn(
        `[Middleware] Auth server returned ${res.status}: ${res.statusText}`
      );
    }
  } catch (error) {
    // Handle different types of fetch failures
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        console.warn(
          "[Middleware] Auth server request timed out after 5 seconds - treating as unauthenticated"
        );
      } else if (
        error.name === "TypeError" &&
        error.message.includes("fetch")
      ) {
        console.warn(
          "[Middleware] Network error connecting to auth server - treating as unauthenticated"
        );
      } else if (
        error.name === "TypeError" &&
        error.message.includes("Failed to fetch")
      ) {
        console.warn(
          "[Middleware] Failed to fetch from auth server (possible DNS/network issue) - treating as unauthenticated"
        );
      } else {
        console.warn(
          `[Middleware] Unexpected error: ${error.message} - treating as unauthenticated`
        );
      }
    } else {
      console.warn("[Middleware] Unknown error - treating as unauthenticated");
    }

    // On auth server failure, treat as unauthenticated for security
    // This ensures users are redirected to login if auth server is down
    isAuthenticated = false;
  }

  if (url.pathname.startsWith("/dashboard")) {
    if (!isAuthenticated) {
      const to = new URL("/login", url);
      // Only set 'next' parameter for specific dashboard routes, default to catalog
      if (url.pathname !== "/dashboard" && url.pathname !== "/dashboard/") {
        to.searchParams.set("next", url.pathname);
      } else {
        to.searchParams.set("next", "/dashboard/catalog");
      }
      return NextResponse.redirect(to);
    } else {
      // If authenticated and accessing /dashboard root, redirect to catalog
      if (url.pathname === "/dashboard" || url.pathname === "/dashboard/") {
        return NextResponse.redirect(new URL("/dashboard/catalog", url));
      }
    }
  }

  if (isAuthenticated && url.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/dashboard/catalog", url));
  }

  return NextResponse.next();
}
