# FineX — finale refinement, 4–5 Oct 2026 (two accounts, two plans)

Deadline on sih.gov.in: **5 October 2026** (read 4 Oct). SIH26183 has **247 of
500** ideas submitted, up from 115 on 29 Sep. All work goes to **mirzadev12**
only, on branch `finale/refine` (and Plan B's branch `finale/india`).
Nothing goes to reemrasheed2007 or Render until the user says so.

## Why these items

1. **Feedback: "most of the data is hardcoded."** It is accurate. Four screens
   (Queue `/dashboard`, Evidence `/reports`, Fund flow `/fund-flow`, the case
   rail) render the same 18 rows from `public/mock/cases.json`: 10 recorded
   cases frozen on 14 Sep and 8 illustrative cases on addresses that were never
   on the chain. Every visitor sees identical figures. The traces themselves are
   live, but nothing on screen proves it.
2. **The competition grew and claims more.** Nine public SIH26183 repositories.
   The newest claim five chains (Bitcoin through mempool.space), trained ML
   (RandomForest "98.6%", XGBoost), "Section 107 BNSS" freeze orders, BSA
   certificates, NCRP/SAHYOG intake, citizen and police portals, and live
   deployments. Several say their ML and legal pieces are "simplified demo
   implementations". FineX's edge stays real data, a named deposit account, and
   evidence anyone can verify, but the live site shows TRON only.
3. **Built but unpushed.** `feat/ethereum` (now merged into `finale/refine`)
   carries Ethereum and Polygon tracing, the Tether freeze check, NCRP-style
   complaint-sheet intake, one freeze request per exchange, address-poisoning
   guards, the findings fingerprint and QR, CoinDCX/WazirX/CoinSwitch
   attribution, the FIU-IND list, law-enforcement contacts, payers tracing,
   outcome recording, by-state grouping, Hindi help, server-side alerts, the case
   file, sign-in and the audit log, bridge recognition, and own-node support.
   That is most of what the competitors claim, built for real.
4. **"Make it look like it is for India and its cybersecurity."** See
   `docs/research/2026-10-04-india-context.md` for what is verified at primary
   sources and what the product may and may not show.

## Status (4 Oct, end of the first session)

| Item | State |
| --- | --- |
| A1 branch | **Done.** `finale/refine` = `feat/ethereum` + live `main`; tsc, eslint, build clean; 86 tests pass. |
| A2 live register | **Done.** `GET /api/register`; scheduled re-read logged in the audit chain; illustrative rows removed; Queue shows origin and read time, refreshes, rows move (FLIP). Verified live: the re-read finished 5 wallets in its first minutes (MEXC ×3, ISIL KHORASAN, CoinDCX). Not yet adapted: `/reports`, `/fund-flow` and the case rail read the same rows but do not show the origin label. |
| A3 live pulse | **Done.** On the Queue page; Plan B places it in the footer and landing. |
| A5 security | **Done** (headers, rate limit). The "Security controls" copy for `/operations` is still to write. |
| A8 graphic | **Done:** the clustering diagram on `/attribution`. Weekly data-refresh Action not started (needs `gh auth refresh -s workflow`). |
| A6 INR | **Done** (4–5 Oct): live USDT/INR from CoinDCX, WazirX fallback, on the key figures and the live line. |
| A7 ML | **Done**: advisory isolation-forest ranking under "Why"; 93 tests pass. |
| B1 India identity | **Done by Plan A**. |
| A4 explorer tags | **Done**: live explorer tags for the wallets where a TRON trail left the search (`/api/tag`, `TailTags`); annotation only. |
| Production check | 72 route × width checks on a production build (CSP on): 0 problems; check-demo 15/15. |
| Plan B | Taken over by Plan A on 4 Oct (the second account did not start). Done: B1 (statement now at the end of every page, at the user's request), B2 IST, B4 typology, B7 OpenAPI + /developers, /operations updated (ML built-advisory, security answer). Not done: B3 Hindi on main screens, B5 state tiles, B6 GIGW pages, B8 legal picker, B9 motion. |
| **Deployed** | **4 Oct, with the user's go-ahead:** reemrasheed2007 `main` (and mirzadev12 `main`) fast-forwarded to `602ec80`; Render serves it (`/api/health`). Live checks: headers, 3 chain heads, INR from CoinDCX, live register, 40 page × width checks with 0 problems. |
| A10 deck | Next: text-in-place edits to `Downloads/FineX - SIH 2026 - PS 26183 - Idea Presentation.pptx` for 3 chains, live data, ML (advisory), INR, Indian exchanges; portal text from `docs/pitch/05-portal-text-finale.md` (now valid: the site is live). Then the judge-style review the user asked for. |

For Plan B: the audit page prints "stated, not verified" under every named actor;
use `isSystemActor` / `actorBasis` from `lib/identity.ts` there so the scheduled
re-read reads "run by the server on its own schedule".

## File ownership (no two people edit one file)

| Owner | Files |
| --- | --- |
| **Plan A (this account)** | `lib/**` except `lib/format.ts` and the Hindi help content; `app/api/**`; `instrumentation.ts`; `next.config.ts`; `data/**`; `scripts/**`; `tests/**` for those; `public/mock/**`; `app/dashboard`, `app/reports`, `app/fund-flow`, `app/attribution`; `components/CaseQueue`, `ReportsList`, `FundFlowExplorer`, `CaseRail`, `CaseFile`, `TraceView`, `InvestigativeLeads`, `LiveStatus` (new); deck and portal text |
| **Plan B (friend)** | `components/AppShell`, `Navbar`, `InvestigateForm`, `BulkTriage`, `EvidencePacket`, `FreezeRequest`, `CombinedFreezeRequest`; `app/page.tsx` (landing), `app/help`, `app/operations`, new pages `app/accessibility`, `app/policies`, `app/developers`; `lib/format.ts`; the Hindi content files; `public/openapi.json`; additive rules in `app/globals.css` |

The only crossing point: Plan A ships `components/LiveStatus.tsx` early; Plan B
places it in the footer and on the landing page.

## Plan A — this account (data, backend, integration)

Order matters: A1 and A3 first, so Plan B can start on top of them.

- **A1. Branch.** `finale/refine` = `feat/ethereum` + live `main` (done: one
  conflict, resolved). Verify: tsc, eslint, 83 tests, build. Push to mirzadev12.
- **A2. A live register, not a file.** `GET /api/register` returns
  `CaseSummary[]` built from (a) the shared case file, (b) the last 50 traces
  this server answered (audit log), and (c) **reference wallets**: the 14 real
  recorded wallets, re-traced live by a server loop (`lib/reference-loop.ts`,
  started in `instrumentation.ts` like the alert loop), on boot and every 6 h,
  sequentially, pausing while an officer's trace runs. Each row carries
  "read at". `getCases()` asks the API first. The committed file becomes the
  offline fallback, badged RECORDED and dated. The 8 illustrative rows leave the
  register. In demo mode the register is the recorded set, as now.
  Verify: fresh boot shows the register filling in live; a trace run on the
  site appears in the Queue; demo mode unchanged (`check-demo` 15/15).
- **A3. Live pulse.** `GET /api/status`: latest TRON, Ethereum and Polygon block
  and its age, the OFAC list's publication date, label counts, traces answered
  today, last trace time. Cached 60 s, read through the configured endpoints
  (own-node rule). `components/LiveStatus.tsx` renders one quiet line, e.g.
  "TRON 86,795,088 · 5 s ago". A new block settles in with the house
  `fx-settle` and the brass lozenge turns once per read. **Done, pushed.**
- **A4. Live explorer tags for the unresolved tail.** For unlabelled wallets
  where the trail stops at the search limit, ask the explorer for its own tag
  (TRON: Tronscan account tag; Ethereum: the tags Blockscout returns). Shown in
  the case file as "Explorer tag, read live — not in our table". It is an
  annotation, not a finding, so recorded cases still re-derive identically.
- **A5. Security hardening you can show.** Headers in `next.config.ts` (CSP,
  HSTS, nosniff, frame-ancestors none, Referrer-Policy, Permissions-Policy). A
  per-IP rate limit on the trace, payers, wallet and watch routes (protects the
  shared chain budget). A "Security controls" list for Plan B to put on
  `/operations`.
- **A6. INR at a live Indian rate** *(needs your yes: reverses "no INR")*.
  `GET /api/rate` reads USDT/INR from an Indian exchange's public ticker and
  returns it with its source and time. `<Inr usdt={…} />` shows
  "≈ ₹3.7 lakh at CoinDCX USDT/INR, read 14:05 IST". Never a fixed rate.
- **A7. Unsupervised anomaly ranking** *(needs your yes: reverses "no ML")*. An
  isolation forest over per-wallet features already measured (dwell, fan-out,
  amounts, age), trained on the wallets each trace reads, shown as an
  *advisory* ranking with the features that drove it. It never names an exit,
  never sets the disposition, and the screen says so. Answers "AI/ML-assisted
  risk detection" honestly, where competitors show accuracy figures on
  synthetic data.
- **A8. Data that refreshes itself.** A weekly GitHub Action re-derives the OFAC
  tables (`scripts/refresh-sanctions.mjs`) and commits them. Pushing it needs
  `gh auth refresh -s workflow` on this machine. `/attribution` shows each
  dataset's date and next refresh.
- **A9. Integration.** Merge `finale/india`. Then run: fingerprint gate (all recorded
  cases re-derive identically), `check-demo`, an end-to-end sweep of every route
  at 375 / 784 / 1100 / 1600 px with no sideways scroll and no console errors,
  and a production build. Push to mirzadev12 `finale/refine`. Wait for the
  user before anything goes to reemrasheed2007 / Render.
- **A10. Deck and portal text.** Update the SIH26183 deck (text in place, the
  user's Canva layout) and the description with the new facts and screenshots
  from Plan B.

## Plan B — friend's account (India, cybersecurity, presentation)

Start from `finale/refine` after A1 and A3 are pushed. Work on branch
`finale/india`. If it runs in Claude Code on the web: it cannot reach chain
APIs or build with Turbopack, so build with `npx next build --webpack` and
verify with `DEMO_MODE=true`.

- **B1. India identity, honestly.** A slim strip on every page: "A prototype
  for the Indian Cyber Crime Coordination Centre (I4C), Ministry of Home Affairs
  · Smart India Hackathon 2026 · Not an official Government of India website".
  Footer: "Report cyber fraud: call **1930** or visit cybercrime.gov.in". **No
  State Emblem** and no map with boundaries (see the research note). Place
  `<LiveStatus />` in the footer and on the landing page.
- **B2. IST.** Every timestamp shows IST beside UTC (`lib/format.ts`,
  deterministic offset, no clock read in render).
- **B3. Hindi across the main screens.** Navigation, landing, case-file
  headings, the packet's section titles (the evidence text stays English).
  Extend the Help page's Hindi mechanism; mark everything "machine-drafted,
  for native review".
- **B4. Scam typology.** A typology field on New case, the complaint sheet and
  batch triage: digital arrest, task-based job fraud, investment/trading app,
  sextortion, loan app, ransomware, phishing, darknet, other. Shown on the
  packet and freeze request. Carried in the link (`?typology=`), never inferred.
- **B5. States and UTs.** A tile grid of the 36 states and UTs (no map
  boundaries) summarising a batch by state, built on the existing by-state
  grouping.
- **B6. GIGW pages.** Accessibility statement (WCAG 2.1 AA target, what is
  tested), Website policies (privacy, terms, hyperlinking, copyright), text-size
  control in the shell, "Last updated" date in the footer.
- **B7. API for integrators.** `public/openapi.json` (OpenAPI 3.1) for every
  route, and `/developers` that renders it with a `curl` per endpoint. This is
  the "integration with LEA systems / API integrations" line in the PS.
- **B8. Legal references** *(only if a law officer confirms)*: a "Legal basis"
  selector on the freeze request listing the BNSS/BSA sections the research note
  verifies, chosen by the officer, never printed by default; and an optional
  BSA certificate block on the packet with blanks.
- **B9. QA and screenshots.** Every route at 375 and 1440 px, both languages;
  screenshots of landing, Queue, a case file, the packet and the batch state
  grid for the deck.

## Motion and graphics (FineX's own vocabulary only)

Nothing is taken from NOIR, the team's separate SIH26182 entry. No departure
boards, no split-flap or odometer counters, no wayfinding signs or arrows, no
yellow. FineX's motion grammar is what it already has: brass lozenge ticks,
`fx-settle`, SMIL packets travelling edges, the single border light.

- **Landing (B):** the hero trace reads itself once. The lit path draws hop by
  hop (stroke-dashoffset), the taint figures step down as the line reaches each
  node (100% → 13% → 0.5%), and a brass lozenge seals the exit cluster. Then the
  existing packets continue. Reduced motion: the finished drawing.
- **Evidence packet (B):** the findings fingerprint settles character by
  character, like a teleprinter, once, when the packet opens. It shows the
  fingerprint being computed from the findings.
- **Register (A):** rows move to their new place (FLIP, 300 ms) when a live read
  reorders them, instead of jumping.
- **Attribution (A):** an SVG of the clustering method: unrelated payers →
  deposit addresses → one exchange hot wallet, with packets sweeping in. The
  explanation behind "241 deposit addresses", drawn.
- **Landing (B):** a coverage plate, three chains (TRON, Ethereum, Polygon) as
  rails converging on a VASP, drawn in the hero's constellation language.
- **Batch triage (B):** the 36 state and UT tiles fill as answers land.
- **Audit (B):** the hash chain drawn as linked entries, the newest linking in.
- Every effect has a reduced-motion path; no glow, no blobs, no particles, no
  gradient besides the one border light; drawn SVG, never AI imagery.

## Decisions — approved by the user on 4 Oct 2026

All three were approved, each reversing a rule recorded in CONTEXT.md:

- **A6, INR at a live rate:** always with its source and the time read; never a
  fixed rate; amounts in Indian grouping (lakh, crore).
- **A7, advisory anomaly ranking:** unsupervised, with the features that drove
  it; never names an exit and never sets the disposition; the screen says so.
- **B8, officer-chosen legal sections:** only sections verified on India Code
  in `docs/research/2026-10-04-india-context.md`; chosen by the officer, never
  printed by default; the BSA certificate block has blanks. A law officer's
  confirmation is still advised before the finale.

## Status, 4 Oct evening (final push)

Live: reemrasheed2007 / mirzadev12 `main` at `6c2b3e4` (deploys so far this
day: 602ec80 → 3f9b58d → afab7e6 → 6c2b3e4). On `finale/refine`, not yet
deployed: hero trace reads itself (`fx-reveal`), fingerprint teleprinter
(`fx-type`), optional BSA s.63(4) certificate on the packet (`BsaCertificate`).

Done since the morning plan: legal-basis picker on the freeze request
(`LegalBasisPicker`, `lib/legal-basis.ts`), `/policies`, `/accessibility`,
the typology dropdown fix (opaque select), the prototype line moved to the
footer.

Final round: three critic agents (Sonnet) review the live site on three lenses
and write to `docs/review/2026-10-04-critic-*.md` (PS compliance, competition
and blind spots, evaluator walkthrough and consistency). The main session fixes
what they find, re-scores on the rubric in `2026-10-04-judge-review.md`,
deploys, and lists every change. No video (user's instruction).

### Critic 3 (walkthrough) — fixes in progress
1. Queue "Open" on the live site waits 2+ min (no TronGrid key on Render — the
   owner sets TRONGRID_API_KEY in the dashboard). Code fix: keep the server's
   own traced runs in memory and serve an exact replay (`?asof=` = the run's
   `generatedAt`) from it; register rows link with their run's `asof`.
2. Queue copy calls the 14 script-picked wallets "today's complaints" →
   say "reference set".
3. Freeze request / packet print an auto amount and window as "reported" →
   "traced, none reported" when the link carried no amount / date.
4. "Rules, not a model" vs the advisory isolation forest → one sentence.
5. CLOSED wording says mixer; mixer list is empty → "OFAC-listed address".
6. Two case IDs for one wallet (year from the window) → stable per wallet.
7. README stale (Polygon "not read", routes missing).
8. Hero: add a problem → outcome subhead and a source-code link (public
   mirror mirzadev12; reemrasheed2007 is private).
Report: docs/review/2026-10-04-critic-walkthrough.md
