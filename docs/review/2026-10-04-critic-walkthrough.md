# FineX — I4C evaluator walkthrough (first impressions, consistency, polish)

Reviewed 4 Oct 2026, 13:30–13:50 UTC, against https://crypto-fraud-tracer.onrender.com.
Deployment under review: commit `6c2b3e4` (`/api/health`); repo HEAD is `50b25a6`, one commit ahead ("Motion: the hero trace…"), so that commit was not reviewed.

**Method.** `curl` on 21 URLs (all HTTP 200; unknown routes give a branded 404), the JSON APIs, `/openapi.json`, then a browser pass on the client-rendered screens (landing, queue, one trace, one freeze request). Every figure was recounted from `data/` with a script. README, `/openapi.json` and the site were compared route by route.

**Not seen.** The finished case-file screen for the TJjc21 trace never completed within ~2 minutes (see P0-1). The evidence-packet screen was still loading when I stopped, so only the freeze request was read in full.

**Side effects of the review.** My requests started live traces of `TXq2kp…kkGex` (curl and browser) and `TJjc21…wXHYQ` (browser). They show as "TRACED HERE" rows and audit entries on the live register. No repo file was changed except this report.

---

## 1. Verdict in one paragraph

The substance is strong and unusually honest: figures on the landing page are counted from the data files, the OpenAPI counts match the developer page, security headers and the "no cookies" claim check out, errors are explicit (a mistyped address returns "Checksum does not match — the address is likely mistyped"), and the limits are stated on `/operations`, `/policies` and `/accessibility`. What would cost the team points is not missing features but **three trust problems and a cluster of contradictions**. The live site runs in its slowest configuration, so the first click can be a two-minute spinner. The main queue presents a script-selected reference set as "Today's complaints … still actionable ≈ ₹1.25 crore". The freeze request prints values the tool inferred as "AMOUNT REPORTED" and "DATE OF FRAUD". Around those sit a dozen small contradictions that an evaluator who reads two pages will find (ML vs "rules, not a model", mixer vs OFAC-only, two case IDs for one wallet, a stale README).

## 2. Ranked issues

Rank = how much it would cost the team in a judge's eyes. Each item gives where, the exact text or behaviour, and the fix.

### P0 — fix before a judge touches the site

#### P0-1. The live site runs unkeyed with demo mode off, so opening a case from the queue is a minutes-long live trace
- **Where:** `/api/health` → `{"demoMode":false,"chainAccess":"public","ethereumAccess":"public"}`. The dashboard "Open" links are bare `/trace/<address>` (read from the DOM: `/trace/TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ` etc., no `since`/`asof`), so each one starts a fresh auto-window live trace.
- **Observed:**
  - `/trace/TJjc21…` (queue row 3, 55,242 USDT, Bybit) was still reading at **117 s**: "WALLETS READ 6 · HOP 3 · TRANSFERS SEEN 3089 · CHAIN CALLS 22", no result yet.
  - The register's own `readAt` stamps (from `/api/register`) show the 14 background re-reads took 11:44:58 → 11:55:37 UTC, about 11 minutes. Individual reads took about 108 s (TJjc21), 81 s (TUGHe9), 70 s (TDii6) and 179 s (TQGFsq).
  - While a heavy trace was running (mine, or another visitor's), a one-hop packet and freeze page sat at "hop 0 · 1 wallet queued" for 8 s or more, and the freeze letter took ~30 s to render. Shared pacing means one visitor's trace queues the next visitor's.
  - Contradicting copy: `/operations` "Real-time tracing — A recorded case answers in milliseconds" (true only with demo mode on), `/help` "Wait about half a minute", `/investigate` "Each opens as it was read on 14 September 2026, so it shows the same case today".
- **Why it costs:** the judge has five minutes. A spinner of this length on the first or second click reads as broken, however honest the live log is.
- **Fix, in order:**
  1. In the Render dashboard, not `render.yaml` (standing rule): set `TRONGRID_API_KEY`, and `DEMO_MODE=true` for the judging window.
  2. Have the register keep the `TraceResult` each reference re-read already computes, and open recorded rows from it instantly. Offer "Re-run live" as an explicit button.
  3. Build the queue's Open links with `traceHref` (pinned `since`/`asof`), as the `/operations` sample links already do.
  4. Set `FINEX_REFERENCE=off` during judging so the 11-minute background pass does not share the unkeyed budget.
  5. Put an expected duration on the loader for large wallets, plus a cancel.

#### P0-2. The queue calls a reference set "Today's complaints" and totals it as "Still actionable ≈ ₹1.25 crore"
- **Where:** `app/dashboard/page.tsx:14` ("Today's complaints, ordered by whether the stolen funds can still be reached."), `components/CaseQueue.tsx:198` (KPI "Still actionable"), `/reports` ("One packet per complaint"), `/api/register`.
- **Observed on the live queue:**
  - KPI "STILL ACTIONABLE 126,078.40 USDT across 9 of 15 cases in the register ≈ ₹1.25 crore at CoinDCX ₹99.25".
  - Rows carry "REPORTED" dates of 10 Nov 2021, 22 Dec 2024, 23 Feb 2025 and 24 Sep 2026.
  - The HOT row FX-2026-6619 reads "Reported 4 Oct 2026 · 4,974.60", today's date and two hours before the read. CONTEXT records that this wallet had moved ~365k USDT since the September capture.
  - `/policies` admits "The recorded cases are real wallets selected by a script, not victim reports"; the queue itself does not.
- **Why it costs:** an I4C evaluator reads the rupee figure as a claim about real complaints. A 2021 CoinDCX exit counted as "actionable" and "freeze request viable" also strains the triage pitch.
- **Fix:**
  - Rename the register "Reference register — real wallets chosen by script, not complaints", with a visible chip.
  - Caption the KPI "across the reference set".
  - Count "still actionable" only when the money moved within a stated window, or relabel it "Exit identified (any age)".
  - Change the `dashboard/page.tsx` and `reports` descriptions.
  - Replace the "Reported" column with "Window opens" for auto and reference rows.

#### P0-3. The freeze request prints inferred values as "AMOUNT REPORTED" and "DATE OF FRAUD"
- **Where:** `/freeze/TXq2kpXz13Z16b2Fjq58NerQTmU7gkkGex`, section 03 "The reported fraud". The trace behind it was run with "amount auto · window auto" (the loader says so), the path `/help` tells officers to take ("Leave amount and date empty").
- **Observed:** "DATE OF FRAUD 8 Sep 2026, 19:04 UTC · 9 Sep, 00:34 IST", "AMOUNT REPORTED 7,630.48 USDT". Nobody reported either: `reportedAmountUsdt` and `fraudDate` come back from an unparameterised `GET /api/trace/<address>` as the tool's own derivation.
- **Why it costs:** this is the one document an officer signs and sends to an exchange. A legal reviewer will treat "reported" as a statement about the complaint.
- **Fix:**
  - When amount or date was auto, print "Amount traced from the wallet (not reported)" and "Window opens at the wallet's first transfer on record".
  - Leave "Date of fraud" for the officer to fill in section 07.
  - Apply the same labels to the evidence packet and the queue's "Reported" column.

### P1 — contradictions a judge can find by reading two pages

#### P1-4. "Rules, not a model" versus an ML model that runs
- **Where:** `app/page.tsx:292` "Rules, not a model. … Every score here is a rule that can be defended line by line." README line 259 "Rules, not machine learning — every score must be defensible to a judge." against `/operations` (`app/operations/page.tsx:130, 206, 265`): "One machine-learning model does run … an isolation forest … ranks the unlabelled wallets", and capability row "AI/ML-assisted risk detection" listed as built.
- **Fix:** one honest sentence everywhere: "Rules decide every finding. One advisory ML ranking (an unsupervised isolation forest) orders unlabelled wallets and never names an exit or sets a status." Update README and the landing page. The public `AGENTS.md` §3 still says "No ML libraries — rules only"; say "no ML library — hand-written" if that is true.

#### P1-5. CLOSED is described as "enters a mixing service", but no mixer is on any list
- **Where:**
  - `app/page.tsx:212` "The path enters a mixing service. Nothing can be followed deterministically past that point".
  - `/help` "It went into a mixing service or a sanctioned address".
  - `components/CaseQueue.tsx:194` KPI hint "Trail enters a mixer or sanctioned address".
  - Against `/operations` §08 "A TRON mixer list and a community abuse list are empty, on purpose".
- **Observed:** all five real CLOSED examples end at OFAC-listed ISIL KHORASAN or Behzad MESRI. The sixth CLOSED row on the live queue is an empty wallet (see P2-12). The problem statement names mixers and tumblers explicitly, so the copy implies a capability the page admits it lacks.
- **Fix:** reword to "enters an OFAC-listed address (mixer detection covers listed services only; none is listed yet)". Or add a sourced mixer list and say so.

#### P1-6. One wallet, two case IDs and two sets of numbers
- **Where:** `/operations` lists FX-**2026**-6568 (TJjc21) and FX-**2026**-9749 (TUGHe9). `/api/register`, the queue, the audit log and `/report` say FX-**2024**-6568 and FX-**2025**-9749.
- **Cause:** the ID year follows the fraud date. The committed capture used 14 Sep 2026; the live re-read uses the auto window (first transfer on record). The committed fallback `public/mock/cases.json` still carries the 2026 IDs.
- **Same pattern for FX-2026-6619 (TDii6):** `/operations` says "funds at rest, never sent" and its sample link replays 14 Sep, while the queue shows "Reported 4 Oct 2026, 4,974.60".
- **Fix:** derive `caseId` from the address (and chain) only, not from the window. Generate the `/operations` list from `/api/register`.

#### P1-7. The first viewport does not say what problem FineX solves, for whom, or what comes out
- **Measured at 1366×768:**
  - H1 "Follow the money. Find the exit." (48 px, top 170 px).
  - One sentence: "Most tools stop at the exchange. FineX carries the trail one step further — to the customer deposit cluster …".
  - Two buttons, a hero diagram, then four figures: 565 / 16 / 458 / 0.
- **Missing above the fold:** victim, complaint, freeze, I4C, NCRP. The three outcome names appear only after scrolling to section 01. "Customer deposit cluster" and "disposition" are unexplained. "458 Sanctioned addresses on the chains traced" and "0 Commercial data licences required" have no context.
- **Fix:**
  - Add a subhead under the H1: "Paste the wallet a victim reported. FineX tells a cyber cell which exchange account holds the money, whether it can still be frozen, and drafts the request."
  - Show the three outcome chips in the hero.
  - Say "account" where it says "cluster".
  - Caption the four figures in plain words.

#### P1-8. README is stale and partly contradicts the site
- **Line 5:** "TRON or Ethereum wallet addresses". Polygon is missing.
- **Line 251:** "The same `0x` address on BNB Chain, Polygon or another EVM network is not read". This contradicts README line 99, `/help` and the whole site, where Polygon is read when `chain=polygon`.
- **Line 259:** "Rules, not machine learning" (see P1-4).
- **Lines 19–20:** the headline counts 241 + 221 and omits Polygon's 103. The site says 565 across 16 exchanges.
- **API table:** documents 12 paths. `/openapi.json` has 16. Missing: `/api/tag/{address}`, `/api/register`, `/api/status`, `/api/rate`. There is no mention of `/openapi.json` or `/developers`.
- **HOT/WARM/COLD versus CRITICAL/SUSPICIOUS/CLOSED:** README and `/developers` use the first set, the whole UI uses the second, and neither explains the mapping.
- **Sample row:** README quotes `TSu8wTwNtp6MKDMJaYZ16G5727Axcp8RQy` as "20 sweeps observed, 100% of inflow forwarded to Binance-Hot 7". The data row's evidence ends "(first 400 transfers examined)" and has `windowTruncated: true`. The README invites the reader to "check it", so quote the caveat or pick an untruncated row.
- **Fix:** edit those lines and add the four routes plus a one-line status mapping.

#### P1-9. `/developers` promises "a working curl example for each", but about six cannot work as printed
- **Where:** the page description says "with a working curl example for each".
- **Observed:** `POST /api/cases`, `DELETE /api/cases`, `POST /api/watch`, `POST /api/alerts` and `DELETE /api/alerts` print `curl -X <verb> …` with no body or `content-type`. README documents required JSON bodies for these (`{address, fingerprint}`, `{items:[{address,since}]}`, `{subscription, items}`, `{id}`, `{endpoint}`). **`/openapi.json` declares no `requestBody` for any of them** (checked), so an integrator cannot learn the shape from the spec. `GET /api/tx/<transaction hash>` is a placeholder. No operation in the spec carries an `example`. I did not run the state-changing calls.
- **Fix:** add `requestBody` schemas and `-d` examples, or soften the sentence to "an example for the read routes".

#### P1-10. `/operations` has stale or wrong sentences
- "Thirteen are built …, **one were** decided against …, three are not built" (count-1 grammar, generated at `app/operations/page.tsx:362`).
- "14 entries in the register were captured … **The rest are illustrative**: valid addresses generated for this repository" (`:412`). The live register and the fallback `public/mock/cases.json` hold only the 14 real rows, so there are no illustrative rows left to refer to.
- §04 and §08 say "traces USDT on TRON and on Ethereum, each on its own" and "pointed at the agency's own TRON or Ethereum node", and omit Polygon. The capability row and §02 include it.
- The capability row "Automated exchange and VASP identification" cites 241 + 221 (= 462) and omits Polygon's 103, so it does not sum to the landing page's 565 across 16 exchanges.
- §07 "It is two plain data files — data/hot-wallets.json … and data/risk-lists.json". The repo now also has `data/eth/*`, `data/polygon/*`, `sanctions-multichain.json`, `fiu-ind.json` and `le-contacts.json`.
- §05 "AGENTS.md §11 offers a hosted model for that paragraph" (`:126`) is an internal planning-doc reference in user-facing text.
- **Fix:** each is a one-line edit; use `count(n, noun)` from `lib/format` for the pluralised sentence.

#### P1-11. The repository cannot be found from the site
- **Where:**
  - `app/policies/page.tsx:109` "To report a defect or a wrong attribution, open an issue on the project's repository."
  - `app/accessibility/page.tsx:85` "open an issue on the project's repository".
  - `/operations` "written down in the repository".
- **Observed:** none of the 15 pages' link lists contains a repository URL.
- **Fix:** link `https://github.com/mirzadev12/crypto-fraud-tracer` (the `mine` remote) in the footer and in those sentences. Confirm it is public first.

### P2 — polish

12. **Empty-wallet row reads CLOSED yet "Funds at rest · 0.00".** Live queue row FX-2025-0452 (`TKmgsf…tcP3K`), a trace that appeared during my review and was not mine. The status is CLOSED, the destination cell (`CaseQueue.tsx:335`) says "Funds at rest", the amount is 0.00, and "Reported 4 Oct 2025" is exactly one year back. "Funds at rest" is the CRITICAL phrase, and the CLOSED tile says "mixer or sanctioned", which this is not. Fix: show "No USDT activity" there, and keep the tile caption accurate. Also, any visitor's trace joins the shared register and the headline totals; consider a "traced by visitors" filter or per-session visibility.
13. **"MXC" versus "MEXC" in the evidence line.** 26 TRON MEXC rows in `data/deposit-addresses.json` read "…forwarded to MXC" (the explorer tag). The freeze request to MEXC prints it under "Likely MEXC deposit cluster": "35 sweeps, 100% of inflow forwarded to MXC". Fix: render "forwarded to MEXC (explorer tag "MXC")" at label time in `lib/labels.ts`, or fix the strings.
14. **"Load the 13 recorded cases"** (`BulkTriage.tsx:329`) against "14 … recorded" elsewhere. The Polygon case is excluded because a bare `0x` reads as Ethereum. Say "13 TRON and Ethereum recorded cases", or let batch intake carry a chain. The input label (`:285`) "TRON or Ethereum wallet addresses" also omits Polygon.
15. **Case rail order differs from the queue.** On `/report/…` the rail lists CRITICAL 0xda4E (700) before TDii6 (4,974.60), and SUSPICIOUS is not sorted by amount, while the queue sorts by amount descending. CONTEXT says the rail follows the queue's order.
16. **Legal-basis dropdown (freeze request §07).** It lists BNSS s.94, s.106, s.107, s.105 and BSA s.63. s.105 is shown on screen as "Recording of search and seizure through audio-video electronic means", a procedural provision rather than a power to restrict or preserve. The page already says a law officer must confirm; ask that officer about s.105 and the ordering.
17. **Login card.** Leads with "Ministry of Home Affairs · I4C" / "Investigator login", with a small "Prototype" tag. Add "Not an official MHA site" on the card itself. The footer has it, but this is the screen that looks most like a government login.
18. **Security copy.** `/operations` §06 says "A strict Content-Security-Policy". The header allows `script-src 'self' 'unsafe-inline'`, and `x-powered-by: Next.js` is sent. Say "restrictive" or tighten. All other claims check out: HSTS, nosniff, X-Frame-Options DENY, referrer and permissions policy, no `Set-Cookie`.
19. **Small items.**
    - The audit log tags the system actor "FineX scheduled re-read" as "stated, not verified"; label it "system".
    - `/api/tag/{address}` is titled "A TRON address's public explorer tag" but its parameter says "TRON (T…) or EVM (0x…)".
    - `/robots.txt` and `/sitemap.xml` return 404.
    - `/attribution` is a 956 KB HTML page with 614 links.
    - The footer "Reading the chains…" is the only text in the server HTML of `/dashboard`, `/trace`, `/report` and `/fund-flow`, so no-JS views and link previews are empty.
    - CONTEXT.md (public in the repo) still says "No INR conversion anywhere" (the site now converts at CoinDCX's rate and says so in `/policies`) and "7 endpoints, 12 scripts" (now 16 routes; `scripts/` holds 18 files).

## 3. Figure reconciliation (recounted from `data/`)

| Figure | Counted from data | Shown where | Status |
|---|---|---|---|
| TRON deposit addresses | 241 across 10 exchanges, 15 seeds | Home, Ops, Attribution, README | consistent |
| Ethereum deposit addresses | 221 across 9 exchanges, 12 seeds; 80 Indian (CoinDCX 29 + WazirX 23 + CoinSwitch 28) | Home, Ops, Attribution, README | consistent |
| Polygon deposit addresses | 103 across 5 exchanges, 10 seeds | Home, Attribution | missing from the Ops capability row and README |
| All chains | 565 addresses, 16 distinct exchanges | Home | consistent; the Ops row sums to 462 |
| OFAC | TRON 334 (44 entities) + EVM 124 = 458; multichain 709; 1,043 over 20 assets | Home (458), Attribution (334, 124), Developers ("20 assets") | consistent |
| Labels | 590 / 358 / 237 (`/api/status`) | API only | TRON 15+241+334 and Polygon 10+103+124 match. Ethereum is 12+221+124 = 357, plus 1 derived WazirX wallet = 358; that +1 is not stated where a judge sees the total |
| Recorded cases | 14 (10 TRON, 3 Ethereum, 1 Polygon) | Ops "14", register 14 (+1 visitor trace) | the queue button says 13 (P2-14) |
| Capabilities | 13 built, 1 decided against, 3 not built = 17 | Ops | counts correct; grammar bug (P1-10) |
| API surface | 20 operations on 16 paths | `/developers` and `/openapi.json` agree | README documents 12 paths (P1-8) |
| Tests | no count printed anywhere on the site | none | nothing to reconcile; `tests/` holds 25 `*.test.mjs` files |

## 4. What already works (keep it)

- All 21 URLs fetched return 200. `/no-such-page` gives a branded 404. A mistyped address gets a clear 400 with a reason.
- The landing numbers are computed from `data/` and recount exactly. The Hindi help page carries its own "machine-assisted translation" notice.
- The audit chain reports intact (14 entries), and the headline claims on `/policies` and `/accessibility` check out.
- The freeze request is the strongest page seen: exchange-specific channel and conditions, a 30-day default note for MEXC, FIR and NCRP blanks, a findings fingerprint with a check link, and "FineX does not decide the legal basis".
- Limits are stated plainly and repeatedly: "not listed is not a clearance", "confidence is not a probability", "an unread wallet is never reported as empty".
- The ₹ figure is labelled with its source (CoinDCX, ₹99.25) and the 99.25 × 126,078.40 arithmetic is right.

## 5. If there is time for only three things

1. Set the key, turn demo mode on, and make the queue's Open instant for recorded rows (P0-1).
2. Relabel the register as a reference set, and print "not reported" on inferred amounts and dates (P0-2, P0-3).
3. One pass for the contradictions: the ML sentence, the mixer sentence, the case-ID year, the README Polygon line, and the repository link (P1-4, 5, 6, 8, 11).
