import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The sign-in page is a client component and cannot export metadata itself,
 * so it went out under the bare site title — the only screen without one.
 */
export const metadata: Metadata = {
  title: "Sign in",
  description: "Investigator console sign-in. The prototype does not authenticate; departmental single sign-on would.",
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
