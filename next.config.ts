import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

// Next puts a random per-build ID in these two Pages Router manifest URLs.
// Precaching them changed sw.js on every deploy — even docs-only ones — so
// browsers always installed a "new" worker and showed the update prompt. The
// App Router never loads them, so excluding them keeps sw.js byte-identical
// until a shipped asset actually changes.
const BUILD_ID_MANIFEST = /\/_(build|ssg)Manifest\.js$/;

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
  cacheOnNavigation: false,
  manifestTransforms: [
    async (entries) => ({
      manifest: entries.filter((entry) => !BUILD_ID_MANIFEST.test(entry.url)),
      warnings: [],
    }),
  ],
});

// Behind Vercel's proxy the Origin/Host check must be pinned explicitly or it
// can be bypassed (API.md §2.4).
function resolveAllowedOrigins(): string[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    return [];
  }

  try {
    return [new URL(appUrl).host];
  } catch {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be an absolute URL to pin Server Action origins.",
    );
  }
}

const allowedOrigins = resolveAllowedOrigins();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      ...(allowedOrigins.length > 0 ? { allowedOrigins } : {}),
    },
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];

    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }

    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withSerwist(nextConfig);
