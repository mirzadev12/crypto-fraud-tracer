import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import { PageHeader, SectionHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Website policies",
  description: "Privacy, terms of use, hyperlinking and copyright for the FineX prototype.",
};

/*
 * Written from what the software actually does, checked against the code on
 * 4 Oct 2026: no cookies are set (grep document.cookie / cookies() finds none);
 * the browser keeps three keys (lib/officer.ts, lib/watchlist.ts,
 * lib/outcome-store.ts); the server keeps four files (alerts.json, audit.jsonl,
 * cases.json, vapid.json). Change this page when any of that changes.
 */

const UPDATED = "4 October 2026";

function Policy({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-16">
      <SectionHeader index={index} title={title} />
      <div className="mt-6 max-w-3xl space-y-4 text-sm leading-7 text-muted">{children}</div>
    </section>
  );
}

export default function PoliciesPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Policies"
        title="Website policies"
        description={`Last updated ${UPDATED}. FineX is a student prototype for the Indian Cyber Crime Coordination Centre (I4C), Ministry of Home Affairs, built for Smart India Hackathon 2026. It is not an official Government of India website, and nothing here is official policy.`}
      />

      <Policy index="01" title="Privacy">
        <p>
          <span className="text-ink">No cookies.</span> The application sets none and runs no advertising or
          analytics scripts. A strict content-security policy stops the page loading or sending anything to another
          site.
        </p>
        <p>
          <span className="text-ink">What stays in your browser</span> (local storage, never sent to anyone but this
          server): the officer ID you typed at sign-in; the list of wallets on your watch; and the outcomes you
          recorded for freeze requests. Clearing the site&rsquo;s data removes them.
        </p>
        <p>
          <span className="text-ink">What this server keeps</span>, in plain files: the audit log of every trace (the
          wallet, the time, the officer ID stated at sign-in and whether a gateway verified it), the shared case file,
          the server-side watch list used to send alerts, and a push-notification key. The audit log is hash-chained
          so it cannot be altered without showing. On this demonstration host those files are not kept across deploys
          or restarts, so the audit log, the case file and the alert list start empty after one; a deployment that
          must keep them points <span className="font-mono text-xs">FINEX_STATE_DIR</span> at a persistent disk.
        </p>
        <p>
          <span className="text-ink">What leaves this server.</span> To trace a wallet, the server asks public
          blockchain services for that wallet&rsquo;s transfers, so those services can see which addresses are being
          looked up. A deployment that must not allow this points the reads at the agency&rsquo;s own nodes. The
          USDT/INR rate is read from CoinDCX or WazirX and carries no wallet.
        </p>
        <p>
          The officer ID is <span className="text-ink">stated, not verified</span>, unless the deployment sits behind
          a sign-in gateway. No password, Aadhaar, phone number or other personal identifier is collected.
        </p>
      </Policy>

      <Policy index="02" title="Terms of use">
        <p>
          FineX produces <span className="text-ink">investigative leads</span>. An attribution carries a stated
          confidence and an evidence tier; confidence is how much evidence was seen, not a probability that it is
          right. A lead is not, on its own, grounds for freezing an account, and nothing the tool prints is a legal
          determination.
        </p>
        <p>
          Use it only for lawful purposes, on wallets you are authorised to investigate. The recorded cases are real
          wallets selected by a script, not victim reports, and must not be described as proceeds of a particular
          fraud.
        </p>
        <p>
          The tool is provided as is, without warranty, as a prototype. Where a chain service did not answer, the
          screen says so; it never reports an unread wallet as empty.
        </p>
      </Policy>

      <Policy index="03" title="Hyperlinking and external sites">
        <p>
          Links to other sites (block explorers, cybercrime.gov.in, the sources of the sanctions and registration
          data) are provided for reference. FineX is not responsible for their content or availability, and a link
          is not an endorsement. You may link to any page of this site; a trace link reproduces the same run on any
          later day.
        </p>
      </Policy>

      <Policy index="04" title="Copyright and sources">
        <p>
          The software and its text are the work of the FineX team. The attribution tables are derived from public
          blockchain data and public explorer tags; the sanctions screening uses the OFAC SDN list published by the
          US Treasury; the registration line uses the Ministry of Finance&rsquo;s answer to Lok Sabha Unstarred
          Question 112 (4 December 2023). Each is cited where it is used.
        </p>
        <p>
          This site does not use the State Emblem of India or any national insignia, which may not be used without
          authorisation under the State Emblem of India (Prohibition of Improper Use) Act, 2005.
        </p>
      </Policy>

      <Policy index="05" title="Contact and reporting a problem">
        <p>
          To report a defect or a wrong attribution, tell the team that runs this deployment, naming the page and
          the case. If you are a victim of cyber fraud, do not use this site: call{" "}
          <span className="font-mono text-ink">1930</span> or report at cybercrime.gov.in.
        </p>
      </Policy>
    </AppShell>
  );
}
