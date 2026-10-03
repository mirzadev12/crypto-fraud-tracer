import type { NextConfig } from "next";

/*
 * Security headers on every response.
 *
 * The CSP is the "without nonces" policy from the bundled Next.js guide
 * (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md):
 * nonces would force every page to render dynamically, and most of FineX is
 * static. What it still guarantees: nothing is loaded or fetched from another
 * origin (every chain read happens on the server; the browser only ever talks
 * to this app's own /api), no plugin content, no framing by another site, and
 * forms post only here. 'unsafe-eval' is added in development only, where
 * React needs it for error overlays.
 *
 * `upgrade-insecure-requests` is deliberately absent: it would break the
 * production build served over http on localhost, which is how every release
 * is verified. HSTS does that job on the deployed https origin.
 */
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
