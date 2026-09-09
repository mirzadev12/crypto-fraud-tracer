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
| Seeds | `data/hot-wallets.json` | 11 explorer-tagged exchange wallets, each re-verified live, each with a source URL. |
| Sanctions | `data/risk-lists.json` | 202 TRON addresses from the OFAC SDN list, 29 entities. Mixers and community lists are empty **on purpose** — no citable source, and the file says so. |
| Clustering | `scripts/cluster.mjs` → `data/deposit-addresses.json` | **165 deposit addresses across 7 exchanges**, 11 seeds, 280 API calls, 8 minutes. That is the number for the slide. |
| Attribution | `lib/labels.ts` | 378 labels in one Map, §9 priority order, honest source tiers. |
| Rules | `lib/risk.ts` | Six rules, named thresholds, reason strings written as evidence. |
| Tracer | `lib/tracer.ts` | BFS, five limits, taint, dwell, triage. |
| Routes | `app/api/trace`, `app/api/trace/[address]` | Live, `force-dynamic`, checksum-validated server-side. |

Verified end to end against the live chain: 8 wallets, depth 2, WARM at an
explorer-tagged exchange wallet, taint 100% → 13.1% → 0.5%, rules firing on real
transfers. The UI needed no change — its badge flipped to **Live trace** on its
own, which is the integration contract in §2 doing its job.

### Still not done

`/api/cases` (deliberately — see §3), `data/demo-cases.json` and the demo-mode
flag from AGENTS.md §10, and the optional narrative from §11.

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
- **The hero visual is the product, not an ornament** (`components/HeroTrace.tsx`).
  A schematic of a trace resolving: subject wallet, hops carrying a falling
  share of the victim's money, a branch dropped as dust, and an exit marked as a
  deposit cluster — drawn in the same language the real canvases use, inside a
  framed panel with a header strip. It replaced a dithered abstract plate, which
  looked like texture rather than like blockchain and said nothing about the
  tool. It carries **no addresses and no amounts**: every figure on it is a
  taint percentage or a rule the pipeline actually applies (`< 10 min`,
  `dust · dropped`), and its caption says in writing that it is a schematic.
  Putting an invented address on the front page is the one thing this interface
  cannot afford to look like it does. Pure markup — no state, no effects, no
  dependency; the motion reuses `fx-flow` and `fx-settle`, which are already
  switched off under `prefers-reduced-motion`.
- **The number is on the front page, not in a dialog.** AGENTS.md §7 says the
  deliverable of the clustering work is a number we can quote; the figures band
  under the hero states it — 165 deposit addresses, 7 exchanges, 202 sanctioned
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
- **A permalink is "what does this wallet look like now"**, not a replay of one
  officer's parameters. `GET /api/trace/[address]` looks back a year and adopts
  everything that left the address as the reported amount, so taint figures come
  out in real USDT; `?amount=` and `?since=` narrow it. The frozen numbers from
  the original run live in that case's evidence packet, and the two can legitimately
  differ.
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
- **Two canvas views behind one toggle** (`components/TraceCanvas.tsx`): Flow
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
```

---

## 7. One deviation from AGENTS.md, on the record

§4 reserves `app/**` and `components/**` for the frontend owner and tells backend
authors never to touch them. The whole UI in this repo was nonetheless built in
one pass at the user's explicit instruction. If the frontend owner has parallel
work, merge carefully — that is the file set to check first.
