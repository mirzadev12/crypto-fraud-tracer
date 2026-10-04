import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import { PageHeader, SectionHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Accessibility statement",
  description: "What FineX does for accessibility, what was tested, and what was not.",
};

/*
 * A statement is only worth anything if it says what was NOT done. Everything
 * under "What is in place" is verifiable in the code or by a check run on
 * 4 Oct 2026; everything under "What has not been done" is stated as such.
 */

const UPDATED = "4 October 2026";

export default function AccessibilityPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Accessibility"
        title="Accessibility statement"
        description={`Last updated ${UPDATED}. FineX aims to meet WCAG 2.1 level AA, the standard the Guidelines for Indian Government Websites (GIGW 3.0) point to. It does not yet claim to, because no independent audit has been done. This page says what is in place and what is not.`}
      />

      <section className="mt-16">
        <SectionHeader index="01" title="What is in place" />
        <ul className="mt-6 max-w-3xl list-disc space-y-3 pl-5 text-sm leading-7 text-muted">
          <li>
            <span className="text-ink">Text contrast.</span> All interface text was measured against its background
            and clears 4.5:1 (ordinary text 6.1 to 15.3:1). Colours that fail as text are used only for rules and
            marks.
          </li>
          <li>
            <span className="text-ink">Keyboard.</span> The page controls are native buttons, links, fields and selects (the graph canvases are the exception, see below); a
            &ldquo;Skip to content&rdquo; link is the first stop on every page; keyboard focus is visible.
          </li>
          <li>
            <span className="text-ink">Structure.</span> One main heading per page, no skipped heading levels, the
            page language declared, every field labelled, and descriptive page titles. A structural check of fifteen
            screens found no unlabelled control or duplicate id.
          </li>
          <li>
            <span className="text-ink">Status is never colour alone.</span> CRITICAL, SUSPICIOUS and CLOSED are
            written words; the graph&rsquo;s fast-forward warning is also written on the line.
          </li>
          <li>
            <span className="text-ink">Reduced motion.</span> When the system asks for less motion, animations are
            removed and the travelling-money markers are hidden; the finished drawing remains.
          </li>
          <li>
            <span className="text-ink">Small screens.</span> Every page was checked at 375, 784, 1100 and 1600 px
            wide for sideways scrolling, and tables scroll inside their own box.
          </li>
          <li>
            <span className="text-ink">Language.</span> The Help page is available in Hindi (machine-drafted and
            awaiting native-speaker review). The rest of the interface is in English.
          </li>
          <li>
            <span className="text-ink">Printing.</span> The evidence packet and freeze request print on A4 with every
            column intact.
          </li>
        </ul>
      </section>

      <section className="mt-16">
        <SectionHeader index="02" title="What has not been done" />
        <ul className="mt-6 max-w-3xl list-disc space-y-3 pl-5 text-sm leading-7 text-muted">
          <li>No independent accessibility audit, and no formal WCAG 2.1 conformance claim.</li>
          <li>No testing with screen readers such as NVDA, JAWS or TalkBack.</li>
          <li>
            The flow, bubble and timeline graphs are visual. Every wallet and transfer they show is also in the
            tables beside them, but the graphs themselves are not described for screen readers.
          </li>
          <li>Most of the interface is English only; Hindi covers the Help page.</li>
          <li>No text-size control of its own: the page follows the browser&rsquo;s zoom and text settings.</li>
        </ul>
      </section>

      <section className="mt-16">
        <SectionHeader index="03" title="Reporting a barrier" />
        <p className="mt-6 max-w-3xl text-sm leading-7 text-muted">
          If something here cannot be used with your assistive technology, open an issue on the project&rsquo;s
          repository describing the page and the tool you use, and it will be treated as a defect.
        </p>
      </section>
    </AppShell>
  );
}
