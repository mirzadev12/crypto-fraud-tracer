import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The sign-in page is a client component and cannot export metadata itself,
 * so it went out under the bare site title — the only screen without one.
 */
export const metadata: Metadata = {
  title: "Sign in",
  description: "Investigator console sign-in. The officer ID is recorded against what you do, as stated and not verified; the prototype does not authenticate, and departmental sign-in would.",
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
