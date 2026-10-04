# PLAN B — FineX finale work for the second Claude account

You are the second of two Claude accounts working on FineX at the same time.
Plan A (the other account) owns the data, backend and integration. **You own the
India-facing presentation, accessibility, documents and motion.** The split is by
file, so the two of you never edit the same file. Read this whole file first.

## The project in one paragraph

FineX is our Smart India Hackathon 2026 entry for problem statement **SIH26183**
(Ministry of Home Affairs · I4C): an investigator pastes a victim-reported crypto
wallet; FineX traces the stolen USDT hop by hop on TRON, Ethereum or Polygon,
names the exchange **and the customer deposit address** that received it, triages
the case CRITICAL / SUSPICIOUS / CLOSED, and drafts a hashed evidence packet and a
freeze request. **The idea-submission deadline is 5 October 2026.** About 247
teams have submitted against this problem statement; several claim more chains,
trained ML and legal paperwork. Our edge is that everything FineX shows is real,
read from the chain, and checkable — your job is to make it look unmistakably
built for India and for Indian cybersecurity, without inventing anything.

## Setup

1. The repository owner adds your GitHub account as a collaborator on
   `github.com/mirzadev12/crypto-fraud-tracer` (Settings → Collaborators). Accept
   the invitation.
2. `git clone https://github.com/mirzadev12/crypto-fraud-tracer`
3. `git switch finale/refine` then `git switch -c finale/india`
4. `npm install`
5. Work only on `finale/india`. Push only that branch, only to this repository:
   `git push -u origin finale/india`. **Never push to `main`, never push to any
   other remote, never touch the deployed site or Render.** Plan A merges your
   branch into `finale/refine` and runs the final checks.

If you are Claude Code on the web (claude.ai/code): you cannot reach the chain
APIs, and Turbopack cannot fetch the fonts. Build with `npx next build --webpack`
and run with `DEMO_MODE=true`; the recorded cases then answer offline.

## Read before you edit

- `CONTEXT.md` §3 — the house rules (they bind every pixel): palette budget
  (~90% near-black, ~7% ivory/greys, ~2% brass, ~1% risk colour); four faces with
  one job each (Cinzel titles, Cormorant only in the printed packet, Inter for UI,
  IBM Plex Mono for addresses and figures); spacing 4/8/16/24/40/64/96/128 only;
  square corners; the one border-light gradient and no other; no glow, blobs,
  glassmorphism or icon soup; provenance language ("recorded", never "demo");
  `min-w-0` on grid children; sweep widths for sideways scroll.
- `CONTEXT.md` §11 and §12 — the features built on this branch and the finale work.
- `docs/plans/2026-10-04-finale-refine.md` — the whole plan, both halves.
- `docs/research/2026-10-04-india-context.md` — what is verified at primary
  sources about India's laws, helplines, the State Emblem, maps and GIGW. If it
  is not there yet, it is still being written; do B8 last.

## Your files (only these)

`components/AppShell.tsx`, `Navbar.tsx`, `InvestigateForm.tsx`, `BulkTriage.tsx`,
`EvidencePacket.tsx`, `FreezeRequest.tsx`, `CombinedFreezeRequest.tsx`,
`PacketFingerprint.tsx`, `HeroTrace.tsx`; `app/page.tsx` (landing), `app/help/**`,
`app/operations/**`, `app/audit/**`; new pages `app/accessibility`,
`app/policies`, `app/developers`; `lib/format.ts`; the Hindi help content files;
`public/openapi.json` (new); additive rules **at the end** of `app/globals.css`.

Everything else belongs to Plan A — in particular `lib/**` (except
`lib/format.ts`), `app/api/**`, `app/dashboard`, `app/reports`, `app/fund-flow`,
`app/attribution`, `components/CaseQueue`, `ReportsList`, `FundFlowExplorer`,
`CaseRail`, `CaseFile`, `TraceView`, `InvestigativeLeads`, `LiveStatus`,
`SweepDiagram`, `next.config.ts`, `data/**`, `scripts/**`. If a task of yours
needs a change there, write it in `docs/plans/plan-b-requests.md` (what, where,
why), push it, and carry on.

## Already built by Plan A that you will use

- `components/LiveStatus.tsx` — one line: each chain's newest block, read now.
  You place it (B1).
- `GET /api/status`, `GET /api/register` — the live pulse and the live register
  (the register is no longer a committed file; the 8 illustrative cases are gone).
- `SYSTEM_ACTOR`, `isSystemActor()`, `actorBasis()` in `lib/identity.ts` — the
  server's scheduled re-read is logged under a named system actor.
- Security headers (strict CSP: nothing may be loaded or fetched from another
  origin — no external fonts, images, scripts or CDNs; draw SVG yourself).

## The split for 5 October (deadline day)

**Plan A (the other account) does:** B1 (done, see below), the live INR rate,
the advisory ML ranking, then — after merging your branch — the full checks, the
deck and portal text, and the screenshots for the deck. So **push early and
often**: whatever is on `finale/india` by mid-afternoon on 5 Oct is what gets
merged. Unfinished tasks are simply left out; nothing half-built may be pushed.

**You do, in this priority order** (most important first; stop wherever the day
ends):

1. **B4** scam typology, with *digital arrest* first
2. **B3** Hindi on the main screens
3. **B2** IST beside UTC
4. **B7** the OpenAPI spec and `/developers`
5. **B6** the GIGW pages and text-size control
6. **B5** the state and UT tiles
7. **B9** motion and graphics (hero, fingerprint, coverage plate, audit chain)
8. **B8** the legal-basis picker (needs the research note)

B10 (screenshots) moves to Plan A, who takes them after the merge.

## Tasks

Each task: build it, check it at 375 / 784 / 1100 / 1600 px, commit, push.

**B1. India identity, honestly — DONE by Plan A on 4 Oct** (commit on
`finale/refine`; do not redo it). For reference, what it is: a slim strip at the top of every page: "A
prototype for the Indian Cyber Crime Coordination Centre (I4C), Ministry of Home
Affairs · Smart India Hackathon 2026 · Not an official Government of India
website". Footer: "Report cyber fraud: call **1930** or visit cybercrime.gov.in"
(a real link). Place `<LiveStatus />` in the footer and on the landing page. No
State Emblem, no national flag graphic, no map of India.

**B2. IST beside UTC.** Every timestamp shows IST next to UTC
(`lib/format.ts`; a fixed +05:30 offset, never a clock read during render — that
breaks hydration and the lint rule).

**B3. Hindi across the main screens.** Navigation, landing page, case-file section
headings, the packet's section titles. The evidence text itself stays English.
Extend the mechanism the Help page already uses (`?lang=hi`). Mark every string
"machine-drafted, for native review". Noto Sans Devanagari is already the
fallback face; keep `:lang(hi)` letter-spacing resets.

**B4. Scam typology.** A typology field on New case, the complaint sheet and
batch triage: digital arrest, task-based job fraud, investment / trading app,
sextortion, loan app, ransomware, phishing, darknet, other. Shown on the evidence
packet and the freeze request. Carried in the link (`?typology=`), never inferred
by the tool.

**B5. States and UTs.** A tile grid of the 36 states and UTs (tiles, not a map)
summarising a batch by state, on the batch triage results; the tiles fill as
answers land. Build on the existing by-state grouping (`lib/by-state.ts`,
read-only for you).

**B6. GIGW pages.** An accessibility statement (target WCAG 2.1 AA; say what was
tested and what was not), Website policies (privacy, terms, hyperlinking,
copyright), a text-size control in the shell, and "Last updated" in the footer
(the build date).

**B7. API for integrators.** `public/openapi.json` (OpenAPI 3.1) for every route
in `app/api/**` (read the handlers; do not change them), and a `/developers` page
that renders it with one `curl` example per endpoint. This answers the problem
statement's "integration with LEA systems / API integrations".

**B8. Officer-chosen legal sections — approved by the team on 4 Oct.** The research note is in (`docs/research/2026-10-04-india-context.md`): offer **only** the sections in its "What FineX may show" table, add the old-or-new-law choice it describes (matters pending on 1 July 2024 stay under CrPC/IEA), never pre-fill or sign the certificate, and never say s.106 or s.107 freezes a wallet. A "Legal
basis" picker on the freeze request listing only the BNSS / BSA sections that the
research note verifies on India Code, chosen by the officer, never printed by
default; and an optional electronic-record certificate block on the evidence
packet, with blanks. Say on screen that a law officer should confirm.

**B9. Motion and graphics (FineX's own vocabulary only).** Use the
`/impeccable:impeccable` skill (`animate`, then `polish`) — a refinement of the
existing look, not a redesign.
- Landing hero: the trace reads itself once — the lit path draws hop by hop, the
  taint figures step down as it reaches each node (100% → 13% → 0.5%), and a
  brass lozenge seals the exit cluster; then the existing packets carry on.
- Evidence packet: the findings fingerprint settles character by character, like
  a teleprinter, once, when the packet opens.
- Landing: a coverage plate — TRON, Ethereum and Polygon as three lines
  converging on an exchange, drawn in the hero's constellation language.
- Audit page: the hash chain drawn as linked entries; and print the actor's basis
  with `actorBasis()` so the scheduled re-read reads "run by the server on its own
  schedule" instead of "stated, not verified".
- Every effect has a `prefers-reduced-motion` path (the finished state). No glow,
  no particles, no new gradients, no AI-generated imagery — drawn SVG only.

**B10. Screenshots for the deck.** At 1440 px and 390 px: landing, Queue, a case
file, the evidence packet, batch triage with the state tiles, `/developers`.
Save them in `docs/screens-2026-10-05/` and push.

**Also (small, from Plan A):** on `/operations`, the problem statement's
"AI/ML-assisted risk detection" row moves from not built to **built, advisory**:
an unsupervised isolation forest ranks unusual wallets in each trace
(`components/AnomalyPanel.tsx`); it never names an exit or sets the status, and
no accuracy figure is claimed. Mention the live USDT/INR rate (CoinDCX, WazirX
fallback) wherever the page lists data sources.

## Rules that must hold

- **Nothing from NOIR** (the team's separate entry for another problem
  statement): no departure boards, split-flap or odometer counters, wayfinding
  signs or arrows, yellow, or a VASP-first desk.
- Attribution is a deterministic lookup; confidence is how much evidence was
  seen, never accuracy; an unreadable wallet is never reported as empty; never
  claim SAHYOG or NCRP integration is live; count every figure from `data/`;
  timestamps stay absolute.
- No secrets in the repository; `.env*` stays ignored.

## Before every push

```
npx next typegen
npx tsc --noEmit
npx eslint .
node --import ./tests/register.mjs --test "tests/*.test.mjs"
npm run build            (on claude.ai/code: npx next build --webpack)
```

Then open each page you changed at 375, 784, 1100 and 1600 px: no sideways
scroll (`document.documentElement.scrollWidth > clientWidth` must be false), no
console errors, with and without `?lang=hi`.

## When you finish

Push `finale/india`, write a short summary in `docs/plans/plan-b-done.md` (what
was built, what was not, anything Plan A must check), push again, and tell the
team.
