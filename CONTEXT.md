# Working context — read this before touching the code

Companion to `AGENTS.md`. `AGENTS.md` is the plan; this file is the state of the
repo and the decisions already made, so a new session does not re-derive them.

Last updated: 9 September 2026 (backend live).

---

## 1. What is done and what is not

### Done — the whole frontend, and the contract it runs on

| Area | Files | State |
| --- | --- | --- |
| Frozen contract | `lib/types.ts` | Complete, matches AGENTS.md §5 verbatim. **Do not change field names.** |
| Fixtures | `public/mock/*.json` | 4 files: `cases.json` (8 complaints), `trace-warm/hot/cold.json`. Regenerate with `node scripts/make-mocks.mjs public/mock`. |
| Data layer | `lib/api.ts` | Calls the real API, falls back to fixtures, validates every response. |
| Address validation | `lib/tron.ts` | Full base58check, synchronous, no dependencies. Verified against Node's `crypto` for SHA-256 and against real TRON addresses. |
| Formatting | `lib/format.ts` | UTC-only, deterministic — no locale or `Date.now()` in render, so SSR and hydration always agree. |
| Screens | `app/**` | `/`, `/login`, `/dashboard`, `/investigate`, `/trace/[address]`, `/fund-flow`, `/reports`, `/report/[address]`, plus `not-found` and `error`. |
| Components | `components/**` | Shell, flow graph, bubble map, trace view, case queue, evidence packet, primitives in `ui.tsx`. |

### Done — the backend, and it is live

| Area | Files | State |
| --- | --- | --- |
| Chain client | `lib/trongrid.ts` | Cache, SHA-256 per response, call counting, 429 backoff, 250ms pacing, and an `didFail` set so an unreadable wallet is never mistaken for an empty one. |
| Seeds | `data/hot-wallets.json` | 15 explorer-tagged exchange wallets, each re-verified live, each with a source URL. The last three carry a `note` recording what the tag does and does not establish. |
| Sanctions | `data/risk-lists.json` | 202 TRON addresses from the OFAC SDN list, 29 entities. Mixers and community lists are empty **on purpose** — no citable source, and the file says so. |
| Clustering | `scripts/cluster.mjs` → `data/deposit-addresses.json` | **241 deposit addresses across 10 exchanges**, 15 seeds. That is the number for the slide. `--from N --merge` adds a seed without re-deriving the rest. |
| Attribution | `lib/labels.ts` | 378 labels in one Map, §9 priority order, honest source tiers. |
| Rules | `lib/risk.ts` | Six rules, named thresholds, reason strings written as evidence. |
| Tracer | `lib/tracer.ts` | BFS, five limits, taint, dwell, triage. |
| Routes | `app/api/trace`, `app/api/trace/[address]` | Live, `force-dynamic`, checksum-validated server-side. |

Verified end to end against the live chain: 8 wallets, depth 2, WARM at an
explorer-tagged exchange wallet, taint 100% → 13.1% → 0.5%, rules firing on real
transfers. The UI needed no change — its badge flipped to **Live trace** on its
own, which is the integration contract in §2 doing its job.

### Done — the safety net (AGENTS.md §10)

| Area | Files | State |
| --- | --- | --- |
| Frozen cases | `data/demo-cases.json` | **Nine real cases across all three dispositions**, captured from the live pipeline: WARM ends at a **Bybit customer deposit address**, COLD ends at **ISIL KHORASAN** from the OFAC list, HOT is an address holding 1,066 USDT that has never sent any. Each is a complete `TraceResult` with its response hashes. |
| Capture | `scripts/freeze-cases.mjs` | Finds candidates from the committed data, traces them through `POST /api/trace`, keeps a result only if the pipeline independently reached the wanted disposition. `node scripts/freeze-cases.mjs HOT` recaptures one level and leaves the rest alone. |
| The flag | `lib/demo.ts` | `NEXT_PUBLIC_DEMO_MODE=true` (or `DEMO_MODE=true`). Exact-address match only; a frozen answer is stamped `x-finex-provenance: recorded` and the screen says RECORDED TRACE. |

Verified end to end with the flag on: all three addresses answer in ~165 ms
from the file with the recorded header, each echoing back its own address; a
valid address *not* in the file still goes to the chain and comes back stamped
`live`, so nothing leaks a frozen case to an address it does not belong to.

### Still not done

`/api/cases` (deliberately — see §3). The narrative from AGENTS.md §11 is built, but deterministically rather than by a hosted model — see §3.

---

## 2. The integration contract — how the UI meets the backend

Every screen goes through `lib/api.ts` and nothing else. It tries the real
endpoint first; on any failure it serves the committed fixture and the screen
shows an amber **Demo data** badge whose tooltip states the exact reason
(`POST /api/trace unavailable (404 Not Found) — showing the committed trace.`).
When the API answers correctly the badge flips to **Live API**. No other change
is needed anywhere.

| Method | Route | Returns | Fallback |
| --- | --- | --- | --- |
| `GET` | `/api/cases` | `CaseSummary[]` | `/mock/cases.json` |
| `POST` | `/api/trace` body `{address, amount, fraudDate}` | `TraceResult` | fixture for that address |
| `GET` | `/api/trace/[address]` | `TraceResult` | fixture for that address |

Three addresses have committed fixtures (`DEMO_ADDRESSES` in `lib/api.ts`):

- `TS27ffk2xJ95nTMYvLjBimcpqaLNHGiw2S` — WARM, ends at a Binance deposit address
- `TYz6M2Fn2egsb15oNZdACtABKotmheGQiD` — HOT, funds still at rest
- `TLtQgf2jiNt6aiAvuirZBwbL3SrBa5RKZS` — COLD, path enters a mixer

**Backend authors, two things matter:**

1. `normalizeTrace` in `lib/api.ts` repairs missing optional fields, drops edges
   whose endpoints are not in `nodes`, and rejects a `label` that is missing
   `entity`/`kind`/`confidence`/`source`. A partially built response renders
   rather than white-screening — but a rejected label means no attribution shows,
   so send all four fields.
2. `fraudDate` is sent as a full ISO timestamp, `amount` as a number.

---

## 3. Decisions already made — do not re-litigate

- **The product is FineX // Blockchain Intelligence.** A bureau instrument, not a
  SaaS dashboard. The gut check before shipping any screen: would this look at
  home in a government financial-crime unit? Fewer boxes, more rules, more
  negative space.
- **Palette, and it is a budget** (`app/globals.css`): ~90% near-black `#0a0a0a`
  / deep charcoal `#141414` / panel charcoal `#1e1e1e`; ~7% warm ivory `#f0ead8`
  and greys; ~2% brass `#c6a15b`; ~1% risk colour — critical `#b33a3a`,
  suspicious `#c98a34`, confirmed `#4a7856`. Brass is structural only: a rule, a
  selected state, one call to action per eyeline. It is never decoration, and
  risk colour appears only where a finding is being stated.
- **Contrast floor overrides three supplied values, measured not guessed.** All
  interface text clears 4.5:1 on charcoal: ink 15.3, muted 7.3, faint 6.1, brass
  7.6, suspicious 6.3, critical 4.8, confirmed 4.9. Three spec values could not
  be used as text and are kept for non-text duty instead — dim grey `#6b6660`
  (3.2:1) lives on as `--color-dim` for rules and disabled states, and critical
  `#b33a3a` (3.1:1) and confirmed `#4a7856` (3.6:1) as `--color-critical-deep`
  and `--color-confirmed-deep` for borders, marks and graph edges. CRITICAL is
  the most important word on the register; it cannot be the least legible one.
  Do not "restore" the spec hexes onto text.
- **Colour literals in the two canvases are drift-prone.** `TraceGraph.tsx` and
  `BubbleMap.tsx` set colour as hex strings (SVG attributes and react-flow style
  objects cannot take Tailwind classes), so a token change does not reach them.
  Three restyles left eight stale literals behind, including a faint value one
  contrast step below the token. After any palette change, grep both files for
  `#[0-9a-f]{6}` and reconcile every hit against `app/globals.css`.
- **Four faces, one job each**: Cinzel (`font-display`) for section titles and
  page headings only; Cormorant (`font-document`) for the printed evidence packet
  only; Inter (`font-sans`) for every functional surface; IBM Plex Mono
  (`font-mono`) for addresses, hashes and figures. Display serif never appears in
  body copy, and the document serif never leaves the packet.
- **Spacing is 4 / 8 / 16 / 24 / 40 / 64 / 96 / 128** — Tailwind 1, 2, 4, 6, 10,
  16, 24, 32. No arbitrary values. A sweep enforces this; keep it enforced.
- **Art Deco is geometry, not ornament.** `--radius-panel` is `0`; corners are
  square everywhere. `Diamond` (rotated lozenge) is the tick mark, `Rule` is the
  faded brass hairline, `SectionHeader` is index + lozenge + display title + rule.
  Deco should read as about a tenth of the design. No gradients, no glow, no
  glassmorphism, no floating blobs, no icon soup.
- **One gradient exists, and it is a border light** (`.fx-sweep` in
  `app/globals.css`). The primary action is a square dark frame with a single
  brass arc rotating behind its 1px ring — the element's own background is
  clipped to the padding box, so the conic layer shows only through the border.
  It is the animated-conic-border pattern rebuilt to the house rules: square,
  one arc rather than a spectrum, no blur, no glow around the button. Secondary
  options carry the same frame lit only on hover (`.fx-sweep-hover`), so the
  light follows the cursor instead of every button holding brass at rest; the
  opaque face appears only while there is an arc to hide, or a secondary on a
  charcoal panel would punch a dark hole in it. Under
  `prefers-reduced-motion` the arc is removed entirely and both fall back to a
  static border. Do not extend this to a second gradient anywhere: the ban in
  the bullet above still stands, and this is the one exception on the record.
- **Every clickable thing wears the same frame** (`.fx-option`, `.fx-option-quiet`,
  `.fx-option-on`). Nothing in this interface should be identifiable as clickable
  only by its colour. `.fx-option` carries a hairline border at rest and the
  brass arc travels it on hover or keyboard focus; `.fx-option-quiet` is the same
  control with no border until pointed at, for places where a permanent box would
  turn a row of links into a row of boxes — the navigation, a ghost action, a
  segmented control. `.fx-option-on` marks the option you are already on (the
  current page, the chosen view) with a brass-dim frame; it sits between the
  resting borders and the hover rules so a selected option still lights when you
  point at it. The nav's active page is now that frame rather than an underline
  hung off the bottom of the bar. Under `prefers-reduced-motion` the arc is
  dropped and the border itself carries the interaction, warming to brass-dim.
  The first pass at this applied the treatment to the two CTA styles only and
  left the nav, chips, toggles, rows and ghost actions bare — if a new control is
  added, it takes one of these classes. Its host must not be a plain inline element: an inline box cannot clip, so the oversized arc escapes and the page scrolls sideways. The base layer makes every host inline-block unless a display utility says otherwise.
- **The hero visual is the product, not an ornament** (`components/HeroTrace.tsx`).
  A cluster constellation — the register on-chain intelligence is read in — with
  one path lit through it: subject wallet at the heart of its own cluster, two
  hops carrying a falling share of the victim's money, and an exit marked as a
  deposit cluster. The claim as a picture: the chain is mostly noise, and the
  work is knowing which four addresses out of fifty are the case. Two earlier
  attempts are worth not repeating — a dithered abstract plate read as texture
  rather than as anything on-chain, and a row of four linked blocks read as a
  flowchart rather than as intelligence. The field is a golden-angle spiral
  computed once at module load, so it is identical between server and client;
  nodes that would sit on the lit path are dropped so the finding never fights
  the noise. It carries **no addresses and no amounts** — every figure is a
  taint percentage or a rule the pipeline applies (`< 10 min`). That property is
  the whole safeguard — there was a caption under the panel calling it a
  schematic and it has been removed, so nothing but the drawing itself now keeps
  the claim honest. **Do not put an address or a figure in USDT on it.** An
  invented address on the front page is the one thing this interface cannot
  afford to look like it prints.
- **Money moves on both canvases** (`.fx-packet`). Edges that merely exist read
  as a diagram; a packet travelling the edge reads as a trace. `BubbleMap` and
  the hero both carry one per leg, staggered by hop so the whole map reads as a
  single movement travelling away from the subject rather than every edge
  pulsing at once. The motion is SMIL `<animateMotion>`, chosen over CSS motion
  paths because it works in the SVG user coordinate system without
  `transform-box` guesswork on SVG children. **SMIL ignores
  `prefers-reduced-motion`**, so the reduced-motion block removes the packets
  with `display: none` rather than stopping an animation; a stopped packet would
  park at the head of every edge. Note when testing that a preview surface may
  itself report reduced motion, which switches off every animation in the app at
  once — check `matchMedia('(prefers-reduced-motion: reduce)').matches` before
  concluding an animation is broken.
- **The number is on the front page, not in a dialog.** AGENTS.md §7 says the
  deliverable of the clustering work is a number we can quote; the figures band
  under the hero states it — 241 deposit addresses, 10 exchanges, 202 sanctioned
  addresses, 0 commercial licences — with the derivation and the word
  *heuristic* immediately under it. Every figure there is counted from the
  committed files in `data/`; re-count them before changing any of them, and do
  not round.
- **An unresolved address is a first-class state, not an error.** `lib/api.ts`
  returns a discriminated `TraceLookup` — `resolved` / `unresolved` / `invalid` —
  and never throws for a valid address it holds no trace for. The unresolved
  screen echoes the address, confirms base58check passed, names the endpoint
  that would answer it, and states what the pipeline would do. It must never
  serve another address's recorded trace in its place: the moment a demo answers
  for an address it does not hold, nothing else on screen can be trusted.
  `normalizeTrace`, the real-API-first ordering and the fixture path for the
  three `DEMO_ADDRESSES` are unchanged.
- **Provenance language, never demo language.** Nothing user-visible says "demo
  data", "dummy" or "sample". A fixture is a *recorded trace*: captured from the
  chain on a stated date, committed, and re-verifiable from the response hashes
  in its packet. Code identifiers (`DEMO_ADDRESSES`, `public/mock/`) keep their
  names; only the copy changed.
- **`/operations` is the jury-question surface** and doubles as the officer's
  standing instructions: who runs it, where data sits, what a year costs, what
  breaks in the field, what is not built yet, and — stated plainly — which parts
  are AI-assisted and which are hand-specified. No attribution decision is made
  by a language model. Keep that row honest; one caught omission puts every
  other claim in doubt. The recorded case files live here too, and deliberately
  not on the landing page.
- **The landing page carries the argument, not the manual.** Detail an
  investigator wants once — how the pipeline works, how an exit is named — sits
  behind a `SectionDialog` row and opens over the page. Built on the native
  `<dialog>` element, so focus trapping, Escape and an inert background come
  from the platform rather than a dependency; note that Tailwind preflight
  zeroes the `margin: auto` a modal dialog centres itself with, which
  `app/globals.css` puts back. Content stays in the document when closed.
- **Grid and flex children need `min-w-0`.** A child defaults to
  `min-width: auto` and refuses to shrink below its content, so a wide table,
  a nowrap readout or a react-flow canvas pushes the whole page sideways on a
  phone instead of scrolling inside itself. `Panel` carries it; so must any new
  direct grid child. Three routes overflowed this way and it survived several
  design passes because nothing had measured it — the check is
  `document.documentElement.scrollWidth > clientWidth` at 390px, per route.
- **An unreadable wallet is not an empty one.** A throttled fetch and a wallet
  with no outgoing transfers are the same empty array. `TronGrid.didFail()`
  tracks the difference and the tracer excludes unread wallets from the "funds
  still at rest" finding. Telling an officer the money is sitting somewhere
  because we could not see is the one lie this tool must never tell.
- **The reported address is the subject of a case, never its finding.** Only
  wallets the money reached can be an exit, or tracing a known deposit address
  reports that the money "reached" the address it started at.
- **A link from the app reproduces the run it came from.** `traceHref()` in
  `lib/api.ts` builds `/trace/<address>?amount=…&since=…` from the trace being
  viewed, and the Permalink and Evidence packet buttons both use it, so a shared
  link and its packet show the same totals as the screen they were opened from.
  `readPinned()` in `lib/format.ts` reads those values on the page and drops
  anything malformed. The earlier link carried only the address, so a trace run
  with an amount or a date reopened on automatic settings and could show
  different figures — the thing an officer forwarding a case can least afford.
  A bare `/trace/<address>` still answers "what does this wallet look like now",
  on automatic settings; only a pinned link is a replay.
- **Demo mode removes the network, never the evidence** (`lib/demo.ts`,
  AGENTS.md §10). The frozen cases were computed by `lib/tracer.ts` from real
  transfers, and each carries the SHA-256 of every chain response it was built
  from, so any claim in one can be re-verified afterwards. Two rules govern it.
  **A frozen trace is never served for an address it does not belong to** — the
  lookup is an exact address match, and an address we hold nothing for goes to
  the chain like any other, failing honestly if the network is gone. **A frozen
  trace never claims to be live** — the route stamps `x-finex-provenance:
  recorded`, `lib/api.ts` reads that header, and the badge reads RECORDED TRACE.
  Note that `NEXT_PUBLIC_*` values are inlined by Next at *build* time even in
  server code, which is why the unprefixed `DEMO_MODE` is accepted too: it is
  read at runtime, so a built artefact can be switched on the night without a
  rebuild. `data/demo-cases.json` is imported statically, so regenerating it
  needs a rebuild.
- **Amount and fraud date are optional; any wallet with history produces a trail.**
  A blank amount is `"auto"` (everything that left the wallet); a blank date is
  `"auto"` (the window opens one second before the subject wallet's earliest
  transfer on record). The form used to default the date to *today*, and nothing
  before the fraud date is followed, so most wallets came back empty. That, a
  flat 30-second client timeout shorter than a slow live trace, and a required
  amount field together were the "backend shows no data" report. Only a value
  that was *given* and is malformed is refused.
- **Traces stream real progress** (`lib/trace-stream.ts`, `lib/progress.ts`). A
  request with `Accept: application/x-ndjson` gets one JSON line per tracer event —
  window resolved, hop reached, wallet read, attribution matched, scoring — then
  the result. The client gives up only after 60 s of *silence* (the server
  heartbeats every 10 s), never because a trace is long. Plain JSON callers, the
  freeze script included, are unaffected. The live log in `TraceLoader` is
  therefore real telemetry for live traces; the fixed-timer log survives only as
  the fallback for loads that do not stream, and its comment says so.
- **Deploys to Render from `render.yaml`.** A Render web service is a long-running
  Node process, which a streamed near-minute trace needs — a serverless function
  timeout would cut it off. Set `TRONGRID_API_KEY` in the dashboard: without it
  the public endpoint throttles Render's shared IP and the tracer, correctly,
  refuses to state a finding from a wallet it could not read.
- **One address at a time is a demo; a morning of them is the product** (`/queue`,
  `components/BulkTriage.tsx`). The pitch has always been "we tell I4C which of
  today's complaints still have recoverable money" — AGENTS.md §9 calls triage
  the differentiator — but every screen until now answered for a single wallet,
  so the claim was never performed. Bulk triage takes a pasted column or a
  dropped file, validates every address locally before any network call
  (base58check is free, and a mistyped address must never cost a chain read),
  then traces them **sequentially**. Sequential is not a shortcut: the chain
  client paces itself and a parallel fan-out would collect 429s, and a throttled
  read is indistinguishable from an empty wallet — the one thing this tool must
  not get wrong. The register reorders itself as each answer lands, in the same
  order as `CaseQueue`, so partial results are usable from the first one. A
  wallet that cannot be read is listed under "unreadable" with the reason rather
  than scored, and it does not stop the run. Export is a CSV of the morning's
  worklist. Expect roughly half a minute per address without a TronGrid key,
  which is why the screen carries a **Load the recorded cases** button: it fills
  the box with the addresses from `frozenAddresses()` — sourced from there
  rather than the JSON so the button can never offer an address demo mode would
  refuse. They are real wallets, so a live run is a real run; with
  `DEMO_MODE=true` the same batch answers from the frozen file in milliseconds,
  which is how a full queue is demonstrated when the network cannot be trusted.
- **Three seeds added from the tag scan, and one of them yielded nothing — which
  is the useful part.** The scan for an Indian VASP turned up tagged wallets the
  seed list did not have. **Flipster** and **Swapster** produced 28 deposit
  addresses each and **UEEx** 20, taking the derivation to **241 across 10
  exchanges from 15 seeds**. **FixedFloat produced zero**, and that is not a failed run: the
  heuristic looks for senders that sweep almost everything to one hot wallet
  repeatedly, which is what a custodial exchange issuing per-customer deposit
  addresses looks like. An instant swap service does not issue them, so there is
  nothing for the pattern to find. The data said what the tag could not.
  **The caveat that matters.** An explorer tag establishes whose wallet it is; it
  does not establish that the operator holds KYC records, and therefore does not
  establish that a restraint request naming a cluster there has an account behind
  it. Each new seed carries a `note` saying exactly that, and Swapster's says its
  tag does not even claim "exchange" — treat it as the weakest attribution in the
  set. Do not quietly promote any of these to the confidence the major exchanges
  carry.
  `cluster.mjs` gained `--from N` and `--merge` for this. It rewrites its output
  file, so adding one seed used to mean re-deriving all of them against a
  rate-limited public endpoint — and a throttled run returns *fewer* rows than
  the file it replaces, silently. Merge seeds the map from disk first, and the
  checkpoint writes then never stand in for rows the run was not asked to
  re-derive. **Back up `deposit-addresses.json` before any clustering run.**
- **New Case ends with a way to the evidence** (`InvestigateForm.tsx`). The
  last thing on the intake page is an Evidence row with *View evidence packet*,
  because the packet is the last step of a case. After a trace it opens the
  packet for the case on screen through `traceHref("report", …)`, pinned to that
  run's amount and window — the same rule the Permalink follows — so the packet
  cannot show different figures from the page it was opened under; verified by
  clicking through to 500.00 USDT on the recorded case. Before a trace it opens
  the packet for whatever wallet the form holds, with the amount and date typed
  so far, and the packet page runs that trace itself. With nothing valid entered
  it is shown disabled with a one-line hint rather than hidden, so the step is
  visible from the moment the page opens. It always names the wallet it will
  open. Derived with `useMemo` from the form and the result, never held in state.
- **A named wallet takes "the" mid-sentence** (`midSentence()` in
  `lib/narrative.ts`). The summary read "reached Binance hot wallet" whenever a
  trace ended at a ground-truth wallet — every live trace to a tagged exchange,
  and one recorded case. `entityPhrase` is written for a heading, so a plainly
  named wallet now gets "the" ("an MEXC" / "a OKX" is why the article is not
  guessed from the first letter); the "a likely …" hedge is untouched. The one
  stale recorded summary was regenerated from that case's own stored figures,
  not re-traced — the narrative is a pure function of the trace, so recomputing
  it needs no chain read, and the diff is that single line.
- **Wallet risk categorisation is the leads layer, not a second classifier**
  (`lib/leads.ts`). The problem statement asks for it; leads already class each
  wallet that matters — never moved, at rest, exit account, omnibus exit,
  chokepoint, sanctions stop, unresolved tail, rapid forward — with a severity
  tone and the figures behind it. A separate risk-category column was scoped and
  dropped as a duplicate; point the deck at leads.
- **The API is documented where an integrator looks** (`README.md` → API):
  every route with a working `curl` example, each one run against a server
  before it was written down. Demo mode answers a recorded address from its
  frozen file and ignores `amount`/`since` on the permalink — the README says
  so, because the example returns different figures there.
- **A CRITICAL finding is watched, because it is true only until the money moves**
  (`lib/watch.ts`, `app/api/watch/route.ts`, `lib/watchlist.ts`,
  `components/WatchAlerts.tsx`). "Funds at rest" is a claim with a timestamp and
  nothing told the officer when that timestamp stopped being true. Every CRITICAL
  trace — opened on its own or landing in bulk triage — puts the wallet holding
  the funds on a watch, and the Cases desk re-asks the chain one narrow question
  about each: *has it sent USDT since the case was read?* The problem statement
  asks for automated alert generation, and this is that, in the shape the
  constraints allow. **No database and a deployment that sleeps** mean nothing
  server-side can hold a list or run on a schedule, so the list lives in the
  officer's browser and the desk checks when it opens and every five minutes
  while it is open — and the screen says exactly that rather than implying an
  always-on service. The route is stateless and reads through the same
  `TronGrid` client and pacing as a trace.
  **Three answers, never two**: moved, still at rest, or *not checked*.
  `outflowsSince()` returns null when the chain did not answer and an empty
  array only when it answered that nothing left; `only_from` and
  `min_timestamp` were verified against live responses first (a future
  timestamp returns zero rows with `success: true`). Reporting an unreadable
  wallet as still at rest is the same lie as calling it empty, told about the
  wallet an officer is most likely to act on. The first live test hit exactly
  this — a rate-limited read came back "not checked", correctly.
  **It fired for real on its first run.** The recorded CRITICAL case
  `TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx`, captured 14 Sep holding 1,066.11 USDT
  and never having sent any, had by 17 Sep sent at least 365,201.90 USDT: one
  141,362.00 transfer and a transfer every thirty minutes to a second wallet.
  That case was selected by a script for being at rest, not reported by a
  victim, so it must never be described as fraud proceeds moving — only as a
  CRITICAL finding going stale and the watch catching it. Movement is grouped
  by destination (fifty rows of one address is noise), and when more left than
  was held the screen says the wallet has received funds since, because a judge
  will otherwise ask how 365k left a wallet holding 1k. Committed illustrative
  cases are never watched: they were never on TRON, so the answer would always
  be "still at rest" and would look like a working alert. **To demo it, open the
  recorded case with `DEMO_MODE` on** — traced live today it is no longer
  CRITICAL, which is the whole point.
- **A sentence that can carry an address needs `wrap-anywhere`.** The summary
  names a full 34-character address on some cases, which is unbreakable at
  min-content, and it pushed the trace page 5px sideways at 375px. Earlier
  sweeps missed it because the fixture case's summary contains no address — so
  sweep a CRITICAL case too, not only the fixture.
- **The convergence is drawn, not just stated** (`components/LinkGraph.tsx`).
  `findLinks` established the fact and the panel put it in words, but the claim
  this project most wants understood is a *shape*: separate victims, separate
  complaints, one accountholder at the end. A reader takes that from a drawing
  in about two seconds and from a paragraph in about twenty. Victim wallets
  left, the shared account right in brass, edge thickness by the victim money
  that reached it, one packet travelling each edge — the same device both other
  canvases use, and removed under `prefers-reduced-motion` by the same rule.
  Hand-drawn SVG, deterministic, no dependency; its hex literals belong in the
  same grep as `TraceGraph` and `BubbleMap` after any palette change. **The two
  labels sit centred under the node, not beside it** — an entity phrase set to
  the right runs straight out of the viewBox and is silently clipped, which is
  how the first version shipped "Likely MEXC deposit c".
- **One line at the head of a finished run says what the product claims**
  (`/queue`): complaints traced, how many still hold funds, USDT still
  reachable, shared accounts. The claim — *we tell you which of today's
  complaints still have money* — had no single place that stated it, and both a
  reader and a camera need one frame that does.
- **Verify a demo-shaped change against `next start`, not `next dev`.** The dev
  server drops client chunks after repeated rebuilds and the tab then falls back
  to a full page load, which looks exactly like the app navigating away on its
  own — an hour went into chasing that. A production build on another port
  settles it in one run, and `DEMO_MODE=true npx next start` needs no rebuild
  because that variable is read at runtime. It is also the honest rehearsal: 3
  of 3 traced in seconds from the frozen file, stamped `recorded`, no network.
  Kill the old process first — `next start` on a taken port fails with
  EADDRINUSE into its log and the **previous build keeps serving**, so the fix
  you just made appears not to have worked.
- **Complaints that share a wallet are one case** (`lib/links.ts`, surfaced in
  `/queue`). Triage answers "where is the next hour worth spending"; it does not
  answer what a cyber cell asks immediately afterwards — *are any of these the
  same people*. Fourteen complaints converging on one wallet are not fourteen
  cases, they are one network, and that is the form this fraud gets prosecuted
  in. Nothing new is read from the chain: every traced result already carries
  the wallets it passed through, so a link is the same wallet appearing in more
  than one of them.
  **What is deliberately not a link, and this is the whole design.** Two cases
  both ending at Binance is a fact about Binance, not a connection between them
  — same for a mixer or a sanctioned service, which everyone who uses them
  shares. Linking on those would relate almost every pair of cases and the
  feature would mean nothing. So `SHARED_INFRASTRUCTURE` excludes
  `exchange_hot`, `mixer` and `sanctioned`, and shared **accounts** are kept: an
  unlabelled intermediary both victims' money ran through, or one customer
  deposit address inside an exchange — the strongest link there is, because it
  is one accountholder. If a label kind is ever added, decide which side of that
  line it falls on before shipping it.
  It pays off on the committed data: three of the ten frozen cases converge on
  one MEXC customer deposit address, `TX1so33jdGd8JkYD7JVB6q1i4QUDhPB2MN`,
  27,930.22 USDT between them. The panel only renders when there is a link, and
  the register is unchanged above it.
- **Re-capture the frozen cases whenever the tracer's output gains a field.**
  The narrative shipped and all ten recorded cases still had none, so demo mode
  — the thing a pitch actually runs on — would have shown no summary at all.
  `node scripts/rescore-cases.mjs` re-ran them: dispositions unchanged, flags
  unchanged, 6/6 rules, narratives present. Back the file up first; the script
  refuses to write if any disposition drifted.
- **The investigator summary is assembled, not generated** (`lib/narrative.ts`).
  AGENTS.md §11 offers a hosted language model for this paragraph. It was not
  taken, and the reason is §11's own defensive line: the answer to "what if the
  model hallucinates the exchange name" is *"it can't — attribution is a
  deterministic lookup"*, and that answer is stronger when it covers the whole
  product rather than everything except the prose on the page. Under a heading
  that says **Summary**, in a document an officer signs, a paraphrase that can
  drift from the evidence six inches above it is a liability, not a feature.
  So the four sentences are built from the trace's own computed figures: what
  left and when, how fast the fastest hop was, where it ended, which rules
  fired, and what the disposition asks of the reader. Every entity name goes
  through `entityPhrase`, which is why that function moved to `lib/voice.ts` —
  it is a "use client" module no longer, so the tracer can share the one wording
  rule instead of a second copy drifting server-side. `components/ui.tsx`
  re-exports it, so every existing import is unchanged.
  Two things to keep: the last sentence states the **action**, never the finding
  again (`triageReason` restates the amount and entity that sentence three has
  already given in full), and `midSentence()` exists because `entityPhrase` is
  written for a heading — "Likely Bybit deposit cluster" dropped mid-sentence
  reads as a typo, and the hedge must stay exactly where the attribution rule
  put it. It carries a copy button on the trace screen because being pasted into
  a case file is the entire point of it. **No language model runs in this system
  at all**, and `/operations` now says so.
- **Inside a case, the case-shaped destinations follow the case** (`Navbar.tsx`,
  `components/CaseRail.tsx`). Pressing Intelligence or Evidence while reading one
  complaint used to land on every complaint on the system, which is the opposite
  of what the click meant. The nav now rewrites those two destinations to the
  open address — `/fund-flow?address=…` and `/report/…` — while **Cases and
  Triage stay unscoped on purpose**: they are the way back out, and Triage exists
  to work through the whole list.
  The first attempt showed *only* the open case and was wrong: it lost the
  ability to move to the next one without going back twice. The shape that works
  is the one `/fund-flow` already had — the case as the content, the register
  beside it, the open one marked. `CaseRail` gives `/report/[address]` the same
  thing, scrolls the open case into view (marked but scrolled out of sight is the
  same as unmarked), and carries `print:hidden` so a list of unrelated complaints
  never prints onto a filed packet. The active row is a brass left edge and brass
  text, not a 8% tint alone, which is easy to miss on charcoal.
  The case the nav is following is read from the **pathname**, never held in
  state, so a shared link lands in the same scope the sender was in and browser
  Back leaves it exactly the way it was entered. Only a checksum-valid address
  scopes anything.
- **Adding to the nav costs width, and the symptom is the page scrolling
  sideways.** Three separate overflows came out of this work, all found by
  sweeping widths rather than by looking: six designations plus Sign in overflow
  at `md` (the desktop row is now `lg`); the case chip plus Sign in overflow at
  `lg` (the chip is now `xl`, and stays in the menu below that); and the packet
  beside a 280px rail needs ~1230px before its 680px-minimum table stops being
  squeezed (that layout is `xl`). **Sweep every route across several widths after
  any nav or layout change** — 375 / 784 / 1100 / 1600 catches all three, and an
  offscreen iframe does the whole matrix in one call. Testing 375px alone passed
  every one of them.
- **The intake takes a transaction, not only an address** (`/api/tx/[hash]`,
  `lib/txlookup.ts`, `hexToTronAddress()` in `lib/tron.ts`). The screen used to
  say "enter the wallet exactly as it appears on the complaint", and that
  assumption does not survive contact with a real case: a defrauded person
  reports a phone number, a UPI ID, a bank account — never a wallet, which they
  were never shown. In the common Indian pattern they were induced to buy USDT
  and withdraw it, so the artefact that exists is a **transaction**, which their
  own exchange can produce for an officer. Pasting a 64-hex hash now reads that
  transaction's USDT Transfer event and traces the wallet it paid, stating what
  it resolved before anything is traced — an officer has to see that the wallet
  we are about to follow is the one their transaction paid. A transaction that
  moved no USDT says so; it is never guessed at. The chain returns event
  parameters as 20-byte hex, so `lib/tron.ts` gained a base58 **encoder** beside
  its decoder; it was verified by round-tripping a real event back to
  `TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ`, which is one of the recorded cases.
- **The trace states how cold the trail is.** The urgency this borrows — a
  freeze window measured in hours — comes from the bank-fraud process. Crypto
  complaints do not arrive inside one, so how long ago the money last moved is
  what decides whether any of it is actionable, and it was previously left for
  the reader to work out from two timestamps. Aged against
  `provenance.generatedAt`, never `Date.now()`: a recorded case must age from
  its own capture and read the same next year, and a clock read during render is
  a hydration mismatch and a lint failure besides.
- **The freeze request carries FIR and NCRP acknowledgement numbers.** Without
  them the document reads as a template rather than something belonging to a
  case on record. They are blanks, like every other field in section 07 — the
  tool cannot know either number, and it still prints **no statute**, because
  CrPC was replaced by BNSS in 2024 and this repo has not verified the
  numbering. Do not add a section number without a law officer confirming it.
- **Six nav items plus Sign in do not fit at the `md` breakpoint.** Adding Help
  pushed the row 107px past the viewport at ~784px, and the symptom is the whole
  page scrolling sideways rather than the nav visibly wrapping. The desktop nav
  is now `lg`; the tablet band uses the same menu the phone does. `/reports` had
  the same shape of bug independently — 43rem of fixed grid columns plus five
  gaps needs ~850px and `md` only offers 769 — and is also on `lg` now. **Check
  more than one width.** The earlier sweep tested 375px only and passed both of
  these; the current check is ten routes × seven widths (375 / 600 / 784 / 900 /
  1100 / 1280 / 1600), run in an offscreen iframe so it costs one call.
- **A help screen, written in plain words** (`/help`). Every other screen speaks
  in the register of a bureau instrument, which is right for a finding an
  officer signs and wrong for someone opening the tool for the first time. The
  help page documents **what exists** — one row per screen, four steps to trace
  a wallet, what the three dispositions mean, what each button gives you, and
  what the tool cannot do — in short sentences with no term the reader has not
  been given. Three rules: if a line needs reading twice, rewrite it; when a
  screen is added, add its row; and **the rows mirror the navigation** — same
  sections (Casework, Method), same names, same order. The navigation was
  renamed to intents and Help went on calling screens "Cases", "Triage" and
  "Trace" for names the menu no longer used; a check comparing the two files'
  name/href pairs now passes exactly. Linked from the nav and the footer.
- **No Indian VASP is publicly tagged, and this is now evidenced rather than
  asserted** (`scripts/hunt-indian-vasp.mjs` → `data/vasp-scan.json`).
  AGENTS.md §6 wants an Indian exchange among the seeds and says why: Western
  tools under-label Indian VASPs, so naming one is the strongest thing this
  project can say to an MHA audience. The first pass checked the top 500
  holders. This scanned **2,500** and found **15 distinct address tags in total**
  — Tronscan simply tags very few accounts — and **not one Indian exchange**
  among them. The scan file lists every tag seen, so "none is available" is now
  a claim with a list behind it. The standing instruction is unchanged: do not
  invent one. If an Indian VASP wallet is ever sourced elsewhere and verified on
  a public explorer, it is one row in `data/hot-wallets.json` and one re-run of
  `cluster.mjs`.
  The scan did surface seeds worth having that are not in the seed list:
  **FixedFloat**, **Swapster** and **Flipster** are no-KYC or instant-swap
  services, which is the laundering-relevant category the mixer list is empty
  for. Adding them is sourced work, not invention.
- **The wallet card answers the other half of the question** (`/wallet/[address]`,
  `lib/wallet.ts`, `components/WalletOrigin.tsx`). Everything else in the tool
  looks forward — the money left the victim, where did it go. An investigator
  clicking a node asks the opposite thing immediately: *what is this address,
  and who put money into it*. The card profiles one wallet from its own
  history: age, USDT in and out, what came in and never left, and the
  counterparties on both sides ranked by value with every one run through
  `lookup()`. `AddressChip` carries a link to it, so every address anywhere in
  the app is now one click from its own origin. It doubles as an independent
  view of the clustering claim — open a derived deposit address and you see the
  sweep pattern directly: unrelated payers in, one tagged exchange wallet out,
  twenty times.
  **Two guards, and the second is the interesting one.** A wallet the chain did
  not answer for states nothing at all, per the existing rule. And a wallet
  **cannot send USDT it never received** — so when the outflows we read exceed
  the inflows we read, that is not a fact about the wallet, it is proof that
  inflows are missing from our read, whatever the page cursor claimed. The
  paging limit is one way a history comes back short; this is the other, and it
  is the one the cursor does not report. Either way the profile marks itself
  partial, the age is shown as "at least <date>" rather than a day count, and
  the totals are never offered as the whole picture. `TSu8wTwNtp6MKDMJaYZ16G5727Axcp8RQy`
  is the worked example: 4,984.21 in against 5,175.20 out, so it reads PARTIAL
  HISTORY rather than claiming the wallet is 734 days old.
  `GET /api/wallet/[address]` is a fourth endpoint where AGENTS.md §5 specifies
  three, on the record as a deliberate deviation: the three it names all answer
  "where did the money go", and none answers "what is this address".
- **Age is measured from the read, not from render.** `Date.now()` in a render
  is both non-deterministic between server and client and a lint failure here;
  the wallet card ages `firstSeen` against `provenance.generatedAt`, which is
  deterministic and is also the more honest reference — the figure means "as at
  the read", which is exactly what the provenance line under it says.
- **Three of the six behavioural rules were unreachable, and the trace itself was
  why** (`lib/risk.ts`, `lib/tracer.ts`, `lib/trongrid.ts`). The rules scored the
  finished `TraceResult`, but that result is already pruned: the tracer follows
  the **five largest outflows per wallet**, so counting edges could never exceed
  five and `HIGH_FANOUT` (which triggers above five) could not fire at all.
  `PEEL_CHAIN` was worse — a peel *is* a run of small withdrawals, and "top five
  by value" discards exactly those, so the rule searched the one place the
  evidence had been removed from. Both were looking at the pruned picture. The
  fix is not to loosen a threshold: the tracer now hands `scoreRisk` an
  `Observed` map of what it actually read per wallet, uncapped, and those two
  rules score that while the trace stays pruned. `TraceNode.outflowCount`
  already carried the true pre-cap figure and is the fallback for a trace scored
  without the tracer's record. **Proof this was real and not theoretical:** the
  recorded case `TTQd8Bo1nhKEVgkKJVP3SRYZ1nDNStckvj` has a wallet that split
  funds seven ways and flagged neither rule; it now fires both, and the trace
  screen shows 5 of 6 signals where it showed 3. `NEW_ADDRESS` was a different
  fault — an overstatement. It reads `firstSeen` as an opening date, but
  `firstSeen` is the oldest transfer *we read*, so on a wallet whose history ran
  past `MAX_PAGES` it would call a years-old address freshly created;
  `TronGrid.wasTruncated()` now marks those and the rule skips them. It is also
  silent when no fraud date was reported, because the window is then derived
  from the subject's own first transfer and "before the reported fraud" would
  name a date nobody reported. **Re-score after any change here**
  (`node scripts/rescore-cases.mjs`): the frozen cases carry whatever the rules
  said the day they were captured, and a case file that disagrees with the code
  that produced it is the one thing an evidence tool cannot ship. The script
  refuses to write a case whose disposition drifted.
- **The number on the front page opens the dataset it was counted from**
  (`/attribution`, `components/AttributionRegister.tsx`). AGENTS.md §7 makes the
  clustering count the deliverable and §15 makes "where do your labels come
  from" a question we answer out loud — but both were assertions, with the
  evidence sitting in a JSON file nobody opens. The register is the exhibit:
  the 15 explorer-tagged seeds with how many addresses each yielded, then every
  derived deposit address with its sweep count, its confidence, its evidence
  string and the seed it was swept into, searchable and filterable by exchange,
  each row one click from the public explorer. Three of the four landing-page
  figures now link here. Two properties matter and should survive any edit:
  **every figure is counted from the committed files at render time**, never
  typed into prose, so a number cannot drift from the file under it; and the
  page states where the method is wrong (a merchant settling to one exchange
  looks identical to a customer deposit address) rather than only where it
  works. Note the derivation is lopsided — one Binance seed produced 21 rows
  and the other Binance seeds produced none — which the seeds table shows
  plainly instead of averaging it away.
- **A freeze request is offered only where one can be actioned** (`freezable()`
  in `lib/api.ts`). Reaching *an* exit is not reaching a freezable one: a mixing
  service has no customer account to restrain and a sanctioned entity is not
  ours to write to. The first pass gated the button on `terminal` being
  non-null, which put a restraint demand in an officer’s hand on every COLD
  case. The gate is the terminal label’s kind — `exchange_deposit` or
  `exchange_hot` — and both the trace page and the triage register use it.
- **The register runs from most to least suspicious** (`CaseQueue.tsx`):
  CRITICAL, then SUSPICIOUS, then CLOSED, and within each the largest sum at
  stake first, with the most recent fraud breaking ties. Severity comes from the
  disposition because that is what the status chips already say on screen, so
  the order and the colour of the list agree. A closed case can involve the
  worst actor on the list — a sanctioned entity — and still sit last, because
  there is nothing left to act on; that is a deliberate reading of "suspicious"
  as "worth the next hour", and the obvious alternative if it is ever wanted is
  sanctioned contact first.
- **`/api/cases` is deliberately unimplemented.** There is no case database.
  Serving illustrative complaint records through it would flip the register's
  badge to "Live trace" while claiming chain-read data it is not.
- **Containers must earn themselves.** `Panel` takes `framed={false}` for the
  common case — a label, a hairline, and the content. Only a canvas, a scrolling
  table or the document sheet gets a border. Do not card-ify a screen.
- **Layout is asymmetric on purpose.** No equal three-column grids of cards; the
  trace page runs a wide finding against a narrow figure column, and the landing
  page leaves real space to the right of the measure.
- **Data typography.** Figures are mono, light, tabular, large, with the
  fractional part dropped to faint (`StatCard`), sized down by string length so a
  long figure cannot overflow.
- **Attribution voice is a safety rule, not a style choice.** `entityPhrase()` in
  `ui.tsx` is the only place wording is decided: a clustering heuristic yields
  "Likely Binance deposit cluster", never "this wallet is Binance". Ground-truth
  and sanctions sources may state the entity plainly. Every attribution carries a
  confidence and a source tier. Do not write entity names into JSX directly.
- **One status vocabulary**: CRITICAL / SUSPICIOUS / CLOSED on screen, mapped from
  the frozen contract's HOT / WARM / COLD in `TRIAGE_META`. The contract keeps its
  names; the interface never shows them.
- **Progressive disclosure in the signals panel.** Count and rule names first;
  "VIEW EVIDENCE" reveals the reasons and the addresses. An investigator wants to
  know which rules fired before reading why.
- **A committed case is never answered by the chain** (`heldLocally` in
  `lib/api.ts`). The three illustrative addresses were never on TRON. While no
  trace service existed the API call failed and the committed file was used, so
  the graph drew; the moment the service landed it began *succeeding* on them,
  and a synthetic address honestly has no transfers — so an empty one-wallet
  answer displaced every case the register, the fund-flow screen and the trace
  page were built around. Asking the chain about an address that was never on it
  cannot return anything but nothing, so those three are served from their files
  without a chain read. Every other address still goes to the service first.
  This is the failure mode to check first if a graph ever renders empty again.
- **Graph node size is banded by kind, then scaled by taint** (`BubbleMap`):
  subject 46px, exchange 32–40px, unlabelled 16–24px, background under 5% taint
  8–12px. Size is always the victim's money, never arbitrary.
- **The deposit address is the loudest element in the app.** In `TraceView`'s
  terminal card it is set larger than any heading. That is the product.

- **The interface names no data provider.** This is a tool for professional
  investigators, not a showcase for the stack behind it: no screen says TronGrid
  or Tronscan. The telemetry gutter reports `FEED LIVE` / `FEED DEMO`, the
  explorer link is labelled "Open in block explorer", and the loader says
  "on-chain". Chain and asset (TRON · USDT TRC-20) stay visible — an investigator
  needs to know the scope. Provider names belong in this file and the README,
  never in the UI.
- **The canvas has no chrome row of its own.** `TraceCanvas` takes an optional
  `view` prop; when the host passes it, the `ViewToggle` lives in the panel
  header and the canvas renders graph + gutter only. The legend went into the
  gutter: node cards already name their own kind, so all that was left to state
  is the sub-ten-minute edge rule and, in bubble view, the size/ring encoding.
- **The loading sequence in `TraceLoader` is display copy, not telemetry.** It
  runs on a fixed timer and observes nothing. The file says so in a comment;
  keep that comment.
- **Three canvas views behind one toggle** (`components/TraceCanvas.tsx`), and
  the third exists because the first two answer the wrong questions. Flow says
  what shape the case is, Bubbles says where the weight went; neither says
  *when* the money moved or *how much survived each hop*, and both figures were
  already sitting in the `TraceResult` unplotted. **Graph** (`TraceChart.tsx`)
  plots them: a timeline of every transfer, positioned by time and sized by
  value with the sub-ten-minute ones in amber, over a taint-by-hop decay. Drawn
  in plain markup — bars positioned by percentage — because `@xyflow/react` is
  the only dependency allowed and percentages are responsive for free. It shares
  the one selection, so a transfer clicked here highlights that wallet in the
  other two views and in the tables.
- **Two of those views are canvases** (`components/TraceCanvas.tsx`): Flow
  (`TraceGraph.tsx`, react-flow) and Bubbles (`BubbleMap.tsx`, hand-drawn SVG, no
  dependency). They share one selection, so clicking a wallet in either keeps it
  selected in the other and in the tables. The bubble layout is deterministic —
  one ellipse ring per hop, wallets spaced evenly in depth-first order, each ring
  rotated by 0.31 of a slot. Two earlier attempts failed and are worth not
  repeating: a radial tree put every node on one ray (only children inherit the
  parent's angle), and a half-slot parity offset put single-node rings back on the
  same axis.
- **`@xyflow/react`** is the only dependency added, which AGENTS.md §3 allows. The
  flow layout is computed by depth (column) and index (row) in `TraceGraph.tsx`,
  not by a layout engine. In both views, transfers forwarded in under ten minutes
  are drawn amber — the "automated laundering" signal is visible before any text
  is read.
- **React Flow's attribution stays visible.** It is MIT-licensed and asks for it
  on the free tier; `globals.css` tones it down rather than hiding it.
- **The login screen has no password field.** A prototype has no business
  collecting a credential; real sign-in would be departmental SSO. The screen says
  so in writing.
- **No INR conversion anywhere.** It would need an FX rate we cannot source
  honestly. Everything is USDT.
- **Timestamps are UTC and absolute.** No "3 hours ago" — it breaks hydration and
  two officers reading one packet must see the same time.

---

## 4. External facts, verified from this machine (8 Sep 2026)

Do not re-guess these; they were checked against live endpoints.

- **USDT TRC-20 contract**: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`, **6 decimals**,
  confirmed from a TronGrid response (`token_info.decimals`).
- **TronGrid works with no API key** for
  `GET https://api.trongrid.io/v1/accounts/{address}/transactions/trc20`.
  Response shape is `{data: [{transaction_id, block_timestamp, from, to, value,
  token_info}], meta: {fingerprint, links.next}}`. `value` is a string in base
  units — divide by 1e6.
- **Address tags**: `https://apilist.tronscanapi.com` returns **401** without a
  key, but `https://apilist.tronscan.org/api/account?address=…` still returns
  `addressTag` (e.g. "Binance-Cold 1"). `…/api/token_trc20/holders?sort=-balance
  &contract_address=<USDT>` returns tagged top holders — that is how to build
  `data/hot-wallets.json`. `/api/search` is deprecated (410).
- **Tagged exchange wallets already found** in the top 500 USDT holders (use these
  as clustering seeds): Binance-Hot 3/4/5/6/7/8/9/10/11 (Hot 7 =
  `TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf`), OKX Hot Wallet 8
  `TLaGjwhvA8XQYSxFAcAXy7Dvuue9eGYitv`, Bybit `TU4vEruvZwLLkSfV9bNw12EJTPvNr7Pvaa`,
  Kraken Hot `TG2CMGxnTPgQ6V58kiKd7wbyN8ewtAmY76`, Kucoin 4
  `TUpHuDkiCCmwaTZBHZvQdwWzGNm5t8J2b9`, Gate `TBA6CypYJizwA9XdC7Ubgc5F1bxrQ7SqPt`,
  MXC `TEPSrSYPDSQ7yXpMFPq91Fb1QEWpMkRGfn`, Bitget 9
  `TJ7hhYhVhaxNx6BPyq7yFpqZrQULL3JSdb`, Bitfinex
  `TXFBqBbqJommqZf7BV8NNYzePh97UmJodJ`, Coinone
  `TDoyjmPJHzRFmYfCRLRsPhKjLETwd9fKr9`.
  **No Indian VASP (CoinDCX / WazirX / Mudrex) appeared in the top 500** — do not
  invent one; if it cannot be sourced, say so.
- **OFAC SDN**: `https://www.treasury.gov/ofac/downloads/sdn.xml` redirects (use
  `curl -L`), ~29 MB, and contains **202** `Digital Currency Address - TRX`
  entries. That is the real source for `data/risk-lists.json`.

---

## 5. Environment gotchas

- The user's terminal is **Windows PowerShell 5.1**: `&&` is a parser error there.
  Give one command per block, or chain with `;`.
- **Next.js 16**: `params` and `searchParams` are Promises and must be awaited in
  pages; route handlers use `RouteContext<'/path/[id]'>`. The bundled docs in
  `node_modules/next/dist/docs/` are the authority, per `AGENTS.md`.
- **React 19.2 lint** (`react-hooks/set-state-in-effect`) fails the build on a
  synchronous `setState` inside an effect. The pattern used here instead: tag
  loaded data with the key it belongs to (`useTrace` in `TraceLoader.tsx`) and
  derive "loading" from a mismatch. Copy that pattern rather than fighting the rule.
- `app/AGENTS.md`'s first block is rewritten by `next dev` on every run. Commit it
  with your work instead of trying to remove it.

---

## 6. Commands

```
npm run dev      # http://localhost:3000
npm run build    # must stay clean
npx tsc --noEmit # must stay clean
npx eslint .     # must stay clean
node scripts/make-mocks.mjs public/mock   # regenerate fixtures

# The safety net (AGENTS.md §10). Dev server must be running.
node scripts/freeze-cases.mjs             # recapture all three dispositions
node scripts/freeze-cases.mjs HOT         # recapture one, leave the others
node scripts/rescore-cases.mjs            # re-run the frozen cases after a rule change
node scripts/hunt-new-address.mjs         # look for a real case exercising NEW_ADDRESS
node scripts/add-case.mjs <address> "why" # freeze one named wallet into the case file
node scripts/calibrate-risk.mjs           # measure how often each rule fires on unreported wallets
node scripts/hunt-indian-vasp.mjs         # re-check the explorer tags for an Indian exchange
NEXT_PUBLIC_DEMO_MODE=true npm run dev    # serve the frozen cases, no network
```

---

## 7. One deviation from AGENTS.md, on the record

§4 reserves `app/**` and `components/**` for the frontend owner and tells backend
authors never to touch them. The whole UI in this repo was nonetheless built in
one pass at the user's explicit instruction. If the frontend owner has parallel
work, merge carefully — that is the file set to check first.
