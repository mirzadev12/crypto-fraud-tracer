# FineX — Final Tech Stack

Every figure here is counted from the committed repository (21 September 2026).

---

## In one line

One Next.js application. No database, no machine learning, no second service.
Public blockchain data in — a named exchange account and a disposition out.

---

## Technologies used

- **Next.js 16.3.4 (App Router) + React 19.2.8 + TypeScript 5** — interface and API in one deployable
- **Tailwind CSS 4** — the entire interface layer
- **Node.js 22**, deployed as a long-running web service on Render
- **TronGrid public API** — TRON mainnet, USDT TRC-20, read with native `fetch`
- **Public label sources** — explorer address tags, OFAC SDN sanctions list
- **JSON datasets committed to the repository** — no database
- **Rule-based scoring** — no ML model and no language model anywhere in the system
- **One third-party UI dependency** (`@xyflow/react`); every other visual is hand-drawn SVG
- **SHA-256 chain-of-custody** on every API response, using Node's built-in crypto

---

## The stack, layer by layer

| Layer | What we use | Why this |
|---|---|---|
| Language | TypeScript 5 | One language for interface, API and offline scripts |
| Framework | Next.js 16.3.4, App Router | Pages and API routes ship as a single process |
| UI runtime | React 19.2.8 | — |
| Styling | Tailwind CSS 4 | No component library to licence or fight |
| Graph rendering | `@xyflow/react` 12 — the only added dependency | Bubble map, link graph, batch canvas and timeline are hand-drawn SVG |
| Chain access | TronGrid public REST API, native `fetch` | No SDK; runs with no key, a free key only raises the rate limit |
| Asset scope | USDT TRC-20 on TRON (`TR7NHq…gjLj6t`, 6 decimals) | Verified against a live response, not assumed |
| Attribution data | 15 tagged exchange wallets + 241 derived deposit addresses + 202 OFAC addresses | 458 labels in one in-memory map at startup |
| Storage | JSON files in `data/`, committed to git | Nothing to provision, migrate or lose; the dataset is reviewable in the repo |
| Scoring | Six deterministic rules | An asset-freezing tool cannot hand a court a black box |
| Case summary | Assembled from the trace's own computed figures | No language model runs in this system at all |
| Metadata images | `next/og`, generated at build | Icons and link-preview card count their figures from `data/` |
| Offline tooling | 11 Node ESM scripts in `scripts/` | Clustering, case capture, re-derivation, calibration, verification |
| Hosting | Render web service, free plan, from `render.yaml` | A live trace streams for up to a minute; a serverless timeout would cut it off |
| Configuration | `TRONGRID_API_KEY`, `DEMO_MODE`, reported by `GET /api/health` | The deployment can be interrogated from outside the dashboard |
| Quality gates | `tsc --noEmit`, ESLint 9, production build | Kept clean on every commit |

---

## Architecture

```
  Officer's browser
        │
        ▼
  Next.js application
    route handlers  →  tracer  →  chain client (cache · pacing · SHA-256)
                          │                        │
                          │                        ▼
                          │              TronGrid public API
                          │              (TRON · USDT TRC-20)
                          ▼
                  attribution map  ←  data/*.json (committed)
                  15 seeds · 241 deposit addresses · 202 sanctioned
        │
        ▼
  Case file · Evidence packet (hashed) · Freeze request · CSV queue
```

Read-only. No database. No model.

**Six endpoints:** trace (POST), trace permalink (GET, replays one run exactly),
transaction lookup, wallet profile, watch check, health.

---

## Figures

| Figure | Value | Source |
|---|---|---|
| Customer deposit addresses derived | **241** | `data/deposit-addresses.json` |
| Exchanges covered | **10** | distinct exchanges in that file |
| Seed wallets | **15** | `data/hot-wallets.json`, each with a source URL |
| Sanctioned addresses carried | **202** | OFAC SDN list, TRON entries |
| Total attribution labels | **458** | 15 + 241 + 202, no overlaps |
| Real cases frozen with response hashes | **10** | `data/demo-cases.json` |
| Behavioural rules | **6** | `lib/risk.ts` |
| API endpoints | **6** | `app/api/**` |
| Added runtime dependencies | **1** | `package.json` |
| Commercial data licences | **0** | — |
| Annual running cost as deployed | **₹0** | Render free plan, TronGrid free tier |

---

## State these precisely

- Confidence measures **how much sweep evidence was seen**, not accuracy.
- The tool **names a deposit address; only the exchange can confirm who holds it**.
- **No Indian exchange is publicly tagged** — we scanned 2,500 tagged accounts and
  the scan is committed.
- **No integration with NCRP or SAHYOG** exists; it is listed as not built.
