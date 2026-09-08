# Working context — read this before touching the code

Companion to `AGENTS.md`. `AGENTS.md` is the plan; this file is the state of the
repo and the decisions already made, so a new session does not re-derive them.

Last updated: 8 September 2026.

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
| Components | `components/**` | Shell, graph, trace view, case queue, evidence packet, primitives in `ui.tsx`. |

### Not done — the backend, exactly as AGENTS.md describes it

`lib/trongrid.ts`, `lib/tracer.ts`, `lib/labels.ts`, `lib/risk.ts`,
`scripts/cluster.mjs`, `data/*.json`, and the three API routes. Nothing in the UI
needs to change when they land.

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

- **Dark theme only.** Committed on purpose; triage colour carries meaning and a
  light theme washes it out. Tokens are in `app/globals.css` (`@theme inline`):
  `bg`, `surface`, `surface-2`, `line`, `ink`, `muted`, `faint`, `brand`, and the
  triage trio `hot` / `warm` / `cold`.
- **Triage colour scale**: HOT red, WARM amber, COLD slate. A heat scale, not the
  brand cyan — cyan stays a UI accent so it never competes with a triage call.
- **`@xyflow/react`** is the only dependency added, which AGENTS.md §3 allows.
  Layout is computed by depth (column) and index (row) in `TraceGraph.tsx`, not by
  a layout engine. Edges forwarded in under ten minutes are drawn amber and
  animated — the "automated laundering" signal is visible before any text is read.
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
