import { permanentRedirect } from "next/navigation";

/**
 * The case queue is the application's home now.
 *
 * Kept as a redirect rather than deleted: links to /dashboard exist in the
 * help screen, the error and not-found screens, and in anything already shared,
 * and a navigation change that 404s a colleague's link is not an improvement.
 */
export default function LegacyDashboardRoute() {
  permanentRedirect("/");
}
