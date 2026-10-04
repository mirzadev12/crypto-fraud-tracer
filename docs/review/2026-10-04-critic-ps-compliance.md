# FineX against PS SIH26183: strict compliance review

Reviewer lens: a national-level judge asking "does the product do exactly what the problem statement asks, with no flaw and no overclaim?"
Date: 4 Oct 2026. Build reviewed: the live site at `https://crypto-fraud-tracer.onrender.com`, which `/api/health` reports as commit `6c2b3e4` (branch HEAD is `50b25a6`, one commit ahead: motion polish only). Nothing in the repository was changed except this file.

---

## 1. Verdict

- **Overall 7.9 / 10** (the team's own review says 8.3). About **8.4** is reachable today with the fixes in section 8 and the two outside-the-code actions in section 9.
- The PS states **40 separately checkable requirements** (background pain points, "the system should", "key features may include", "should support", "expected solution", "should further support"). Result: **18 met, 15 partly met, 7 not met.** Five of the seven are declared honestly on `/operations`. Two are missing from the list that page says maps "the problem statement's own list": automated pattern recognition for fraud typologies, and privacy-enhancing mechanisms.
- **Every figure the site counts re-counts exactly** from `data/` (565 / 16 / 37 seeds / 80 / 458 / 241 / 221 / 103 / 14 cases). The input handling is clean. The "not built" list is unusually candid. This is a strong submission with a small number of copy-level overclaims and one functional gap in the PS's simplest scenario.
- **Outright false or contradicted statements found** (details in sections 4 and 5):
  1. The simplest real case fails the headline claim. If the reported address is itself an exchange deposit address, FineX names the exchange's hot wallet, not the deposit address (probed live).
  2. `/help`: "When money goes into a swap or a bridge, the trace stops there." True on Ethereum and Polygon only. TRON, the primary chain, has no contract detection.
  3. Landing, Help and the portal text describe CLOSED as "the path enters a mixing service". The mixer list is empty on every chain; COLD fires only for OFAC-listed addresses.
  4. Landing defines CRITICAL as "sitting at an address with no outgoing transfers". The register's own CRITICAL wallet traces live as "the trail is still moving".
  5. "About half a minute" per live trace. Measured 12 s to 179 s; the developer page's own example took 100 s.
  6. `/operations` 08: "No Indian VASP is in the seed list." The Ethereum seed list contains CoinDCX (x2), WazirX and CoinSwitch (x2).
  7. `/operations`: "where a line says built, a case file on this deployment shows it." No recorded case ends at a bridge, yet cross-chain identification is marked Built.
  8. The public GitHub link does not exist: `reemrasheed2007/crypto-fraud-tracer` is 404 to an anonymous visitor, and the site links no repository at all although two pages tell people to "open an issue on the project's repository".

---

## 2. Method and limits

Read: the PS verbatim (CONTEXT.md 8.1), the team's own judge review, all nine requested pages plus `/openapi.json`, `/api/register`, `/api/status`, `/api/rate`, `/api/health`. Recounted every landing figure from `data/`. Read the code paths that decide the claims (`lib/tracer.ts` `decide()` and `caseIdFor()`, `lib/contracts.ts`, `lib/legal-basis.ts`, `lib/anomaly.ts`, `components/AnomalyPanel.tsx`, `app/api/cases/route.ts`, `render.yaml`). Tested the live API: read-only GETs and one POST-shaped bad input (no writes, no deletes).

Not verified, and so not scored on: the finished case-file screen (leads panel, INR display, freeze request layout). The Browser pane was shared and another session navigated the tab away twice, so I judged the case file from the API JSON and source instead. Also not seen: the finale deck, the PDF, the demo video, the 72-check sweep, the Hindi toggle beyond `/help`.

---

## 3. Requirement by requirement

Status: **Met**, **Partly**, **Not met**. "Declared" means `/operations` already says so.

### A. Background: what the system must remove

| # | PS wording | Status | Evidence | Flaw or gap |
|---|---|---|---|---|
| A1 | Reported wallets are often non-custodial, burner or intermediary | Met | Forward BFS, 3 hops, top 5 outflows, haircut or FIFO taint (`lib/tracer.ts`). Sample TJjc21...: 12 wallets, 21 transfers, 38 response hashes | Caps prune wide laundering; the rules read the unpruned view, so flags still fire |
| A2 | Identify the exchange or VASP quickly | Met, caveat | 16 exchanges, 565 deposit accounts, 3 chains. Sample: "likely Bybit customer deposit address TMt8PX...zhc3, 0.95, 21 sweeps" | "Quickly" is 12 s to 179 s keyless (appendix A). Attribution is a heuristic and says so |
| A3 | Delays in freezing, evidence preservation, tracing, recovery | Partly | Freeze request to the exchange's law-enforcement channel (14 of 17 found), Tether blacklist check (`/api/issuer`), packet, watch | No filing channel; outcomes live in the officer's browser; effect on delay not measured |
| A4 | Multi-chain transfers | Partly | Three chains each traced alone; bridge entry stops the trace on Ethereum and Polygon | TRON has no bridge or contract detection (`lib/trongrid.ts` has no `contractInfo`). Following across chains is Declared not built |
| A5 | DeFi protocols | Partly | Ethereum and Polygon: DEX, router or pool contract stop, named from the explorer tag (`lib/contracts.ts`) | **TRON follows a DEX router as if it were a wallet**, walking other people's money; `/help` says the opposite. One contract stop exists among the 14 recorded cases (a DEX) |
| A6 | Mixers and tumblers | **Not met** (OFAC stop only) | `data/risk-lists.json`: mixers 0, community 0. No Ethereum or Polygon mixer list. All 5 COLD recorded cases end at OFAC-listed wallets (4 ISIL Khorasan, 1 Behzad Mesri) | Landing, Help, portal text say CLOSED = "enters a mixing service". An Ethereum mixer pool would be a contract stop and triage HOT, not COLD (`categorize()` has no mixer class) |
| A7 | Bridges | Partly | Ethereum and Polygon: tag containing bridge / OFT / adapter gives "the trail left Ethereum" | No recorded case shows it; none on TRON. `/operations` marks the row Built |
| A8 | Privacy-enhancing mechanisms | **Not met** | Other-chain addresses (Monero etc.) are screened by exact match only | Not mentioned on `/operations` at all |
| A9 | Case types: investment, task-based, sextortion, ransomware, phishing, darknet | Partly | "Type of scam" dropdown, printed on packet and freeze request | An officer-entered label ("does not change the trace"). Ransomware, sextortion and darknet usually move BTC or XMR, which is screened, not traced |

### B. "The system should"

| # | PS wording | Status | Evidence | Flaw or gap |
|---|---|---|---|---|
| B1 | Ingest addresses reported through complaint systems | Partly | Paste, CSV complaint sheet (ack no., wallet or tx, amount, date, state), transaction-hash intake (`/api/tx`), OpenAPI | No NCRP connection. Column names are the team's loose guess at an export (`docs/features/03`: "reads a CSV export, not the NCRP system") |
| B2 | Automatically perform blockchain tracing | Met | `POST /api/trace`, streamed progress, permalinks | |
| B3 | Identify associated exchanges or VASPs | Met | As A2, plus the Indian desk (CoinDCX, WazirX, CoinSwitch) | PS says "nearest". `decide()` picks the exit with the **largest tainted value**, not the fewest hops |
| B4 | Detect fund movement patterns | Met, weak signal | Six rules with plain-English reasons | Own base rates: peel-chain fires on 16 of 17 and fan-out on 15 of 17 wallets nobody reported (sample of 17). Sample case prints "split across 229 wallets" and "42 small withdrawals" as laundering evidence |
| B5 | Generate actionable intelligence | Met | Triage reason, ranked leads, narrative, freeze request, packet | Leads and anomaly scores are computed in the browser; the API's `TraceResult` carries neither |

### C. "Key features may include"

| # | PS wording | Status | Evidence | Flaw or gap |
|---|---|---|---|---|
| C1 | Transaction graph analysis | Met | Flow, bubble, timeline views; shared selection | |
| C2 | Clustering of exchange wallets | Met | `scripts/cluster*.mjs`, 565 rows, "31 of 31 re-read still meet the rule" | Self-consistency, not accuracy. Independent gas-payer check: 105 agree, 63 untagged, 1 conflict (Coinbase vs Cobo Custody) |
| C3 | Detect intermediary laundering wallets | Met, weak signal | Rules plus advisory isolation forest | As B4 |
| C4 | Identify cross-chain fund movement | Partly | A4 and A7 | Marked Built "with a case file that shows it"; none does |
| C5 | SAHYOG and NCRP integration | **Not met** (Declared) | `/operations` 08; `/developers` "designed around these routes but is not live" | |
| C6 | Automated alert generation | Met | `/api/watch`, `/api/alerts`, 5-minute server loop, Web Push | Demo host has no persistent disk (`render.yaml` has no disk, no `FINEX_STATE_DIR`); the server watch list resets on deploy |
| C7 | Risk categorisation of wallets | Partly | Leads classify the wallets that matter (exit, chokepoint, at rest, sanctions stop, tail) | Not a field on each node in the API; unlabelled minor wallets get no class |

### D. "Should support multiple ecosystems and provide"

| # | PS wording | Status | Evidence | Flaw or gap |
|---|---|---|---|---|
| D1 | Multiple blockchain ecosystems | Met, scoped | USDT on TRON, Ethereum, Polygon; 20 assets screened | USDT only. Native BTC, ETH, TRX not traced; BNB Chain not read (no keyless source, Declared) |
| D2 | Real-time tracing | Partly | Streaming trace with real progress | 12 s median, 179 s slowest. `/developers` example took 100 s. Site says "about half a minute" |
| D3 | Automated investigative recommendations | Met | Leads, `triageReason`, "which wallet to open next" | |
| D4 | Analytics dashboards for agencies | Partly | Queue ordered by recoverability, batch canvas (flow, exits, weight), by-state tiles, exchange outcome counts | Views are per pasted batch or per browser; no agency-level trend over time or across officers |

### E. "Expected solution"

| # | PS wording | Status | Evidence | Flaw or gap |
|---|---|---|---|---|
| E1 | Real-time intelligence generation | Partly | See D2 | |
| E2 | Automated VASP identification | Met | | |
| E3 | Tracing of suspect wallets | Met | | **Core-scenario gap** (section 4, O1): a reported address that is itself an attributed deposit address loses its label |
| E4 | Cross-chain transaction analytics | **Not met** (Declared) | `/operations` "Cross-chain tracing" | |
| E5 | Fund-flow visualisation | Met | | |
| E6 | Integration with LEA systems | **Not met** (Declared) | API only; no SSO beyond a trusted header | API has no authentication ("No key is needed") |
| E7 | Standardised investigation reports | Met | Packet, findings fingerprint v1, QR check link, optional blank BSA s.63(4) certificate | Format is the team's own; no I4C template exists to cite |
| E8 | Reduce response time | Partly, unmeasured | No before-and-after figure anywhere (correctly: none claimed) | A judge will ask "how much faster than manual" |
| E9 | Improve freezing of proceeds | Partly | Freeze request, issuer blacklist check, contact desk | FineX freezes nothing; outcome log is browser-local |
| E10 | Enhance coordination with VASPs | Partly | Per-exchange channel and conditions (CoinSwitch: gov.in or nic.in senders only; WazirX: 90-day preservation, order or warrant for disclosure) | 3 exchanges not contactable (FixedFloat, Swapster, UEEx); data read 25 Sep |
| E11 | Strengthen digital evidence collection | Met | SHA-256 per response, `verify-case.mjs` (33 confirmed, 0 mismatched), hash-chained audit log | Audit log and case file sit on an ephemeral disk on the demo host |

### F. "Should further support"

| # | PS wording | Status | Evidence | Flaw or gap |
|---|---|---|---|---|
| F1 | API integrations | Met | OpenAPI 3.1, 20 operations on 16 routes, curl example each | Unauthenticated. `app/api/cases/route.ts` has no 401 or 403 path; the actor is a stated officer ID |
| F2 | Scalable blockchain indexing | **Not met** (Declared) | Own-node environment variables only | |
| F3 | AI/ML-assisted risk detection | Partly | Seeded isolation forest, 8 features, advisory, no accuracy claimed | Trained on 29 rows from the 14 recorded cases (the panel says so; `/operations` does not). Not in the API |
| F4 | Automated pattern recognition for fraud typologies | **Not met** | See A9 | **Not on `/operations`**, which claims to cover the PS's own list |

**Tally: Met 18, Partly 15, Not met 7.** Declared on `/operations`: A6, C5, E4, E6, F2. Silent: A8, F4.

---

## 4. Where the site claims more than it does (ranked)

| # | Sev | Claim and where | Reality and evidence |
|---|---|---|---|
| O1 | High | Landing hero and portal: FineX "names the customer deposit address the money landed in" | Probe on the live API: a derived MEXC customer deposit address (`TQFmtJ6F...BxZWwS`) used as the **reported** address returns WARM, terminal = **MEXC hot wallet**, `depositAddress: null`, and the root labelled "Victim-reported address". The deposit-address attribution is overwritten, and the freeze request would name a wallet the exchange cannot freeze. This is the simplest real case (victim told to pay an exchange deposit address) |
| O2 | High | `/help` 05: "When money goes into a swap or a bridge, the trace stops there and says so" | Only `lib/ethclient.ts` implements `contractInfo`. TRON, the main chain, follows a router's outflows as a wallet. `/operations` 08 admits no TRON bridge recognition, so the pages disagree |
| O3 | High | Landing, Help, portal: CLOSED = "the path enters a mixing service" | `mixers` has 0 rows (TRON), no Ethereum or Polygon mixer data, 0 mixer nodes in the 14 recorded cases. `/operations` itself says the list is empty on purpose |
| O4 | High | Landing: CRITICAL = "sitting at an address with no outgoing transfers" | Live trace of the register's HOT wallet `TDii6...` returns "No exit was identified within three hops and the trail is still moving". `/operations` lists the same wallet as "funds at rest, never sent" (true on 14 Sep only) |
| O5 | High | Help step 3 and Investigate: "about half a minute"; `/operations` row "Real-time tracing: Built" with "a recorded case answers in milliseconds" | Measured keyless: 99.98 s for `/developers`' own example (with other requests running), 162.7 s for TDii6, median 12 s and slowest 179 s across the 14 reference re-reads. The "milliseconds" figure is a file read, not tracing |
| O6 | Med | `/operations`: "Nothing here is aspirational: where a line says built, a case file on this deployment shows it" | Cross-chain identification is marked Built; no recorded case ends at a bridge (the single contract stop is a DEX), and it does not exist on TRON |
| O7 | Med | Portal text: "Nothing on screen is hardcoded" | Label tables are JSON, recorded cases are frozen, the case lists on `/operations` and `/investigate` are static. An absolute claim a judge can falsify in one click |
| O8 | Med | Landing and portal: "a freeze window is measured in hours"; "hundreds of complaints arrive a day"; portal: foreign tools "under-label" Indian exchanges | CONTEXT.md says the hours window is borrowed from bank-fraud practice and crypto complaints do not arrive inside one. The team's own cited NCRP figure is 19,18,865 complaints in 2024 (about 5,000 a day), so "hundreds" is both unsourced and understated. The under-labelling claim has no benchmark |
| O9 | Med | "80 deposit accounts at Indian exchanges" (landing, portal, deck) | All 80 are on **Ethereum**: 0 on TRON, 0 on Polygon. 28 of the 80 are CoinSwitch addresses active April to June 2021 (the attribution page says so). 52 (CoinDCX 29, WazirX 23) were active in Sept 2026. The product says TRON is where the money moves, and TRON has no Indian exchange |
| O10 | Low-Med | Landing: "Most tools stop at the exchange" | AGENTS.md's own premise is that commercial vendors sell this dataset. Say "most open tools" |
| O11 | Low | Landing: "Rules, not a model" next to a capability row that says AI/ML is Built | Consistent in spirit (the forest is advisory) but reads as a contradiction. "Rules decide; one advisory model ranks" |
| O12 | Low | `/operations` 06 "strict Content-Security-Policy" | Live CSP has `script-src 'self' 'unsafe-inline'`. Strict about origins, not about injection |
| O13 | Low | Operations/Policies: audit log, case file, alert watch presented as durable evidence | Demo host has no persistent disk; `/api/status` shows `traces.today = 14`, exactly the boot-time reference reads, so the log restarted with today's deploy. Not disclosed on the site |

---

## 5. Internal contradictions (the same fact, two answers)

1. **Indian VASPs in the seed list.** Landing and `/attribution`: CoinDCX, WazirX, CoinSwitch among the Ethereum seeds. `/operations` 08: "No Indian VASP is in the seed list." True for TRON only.
2. **Which chains are traced.** Landing and capability row: TRON, Ethereum, Polygon. `/operations` 04 and 08 say "TRON and Ethereum" and omit Polygon.
3. **Case references.** `/operations` lists `FX-2026-6568` for `TJjc21...` and `FX-2026-9749` for `TUGHe9...`; `/api/register` has `FX-2024-6568` and `FX-2025-9749`. Cause: `caseIdFor()` takes the year from the fraud date, which differs between the frozen run and an auto-window live run. One wallet, two IDs. The suffix is `hash % 10000`, so at "hundreds of complaints a day" a collision inside one year is near certain.
4. **CRITICAL.** Landing says at rest; live HOT says still moving; `/operations` says "never sent" (see O4).
5. **CLOSED.** Landing says mixer; `/operations` says the mixer list is empty (see O3). A valid but unused address also returns CLOSED ("No USDT transfer has ever been recorded"), a third meaning.
6. **Real-time.** `/operations` row says Built; Help says about half a minute; measurement says 12 to 179 s.
7. **"The rest are illustrative."** `/operations` says the register's other entries are illustrative. `/api/register` returns exactly 14 rows, all `origin: reference`; there are no others.
8. **Grammar.** "Thirteen are built ... one were decided against."
9. **Feedback channel.** `/policies` 05 and `/accessibility` 03 say "open an issue on the project's repository". No link on either page, and the repository named in the team's records is private.

---

## 6. What would make an MHA evaluator distrust it, and what earns trust

**Distrust triggers (fix before judging):**
- The repository link 404s, or does not exist on the site (credibility).
- A contradiction between the landing definition and the first live result they open (CRITICAL).
- A first live trace that runs longer than a minute with no explanation of why (the elapsed timer helps; the copy sets a 30 s expectation).
- COLD examples that are all ISIL Khorasan terror-finance wallets (4 of 5), not mixers and not Indian fraud typologies; and a register of script-selected reference wallets that shows "reported amount" and "fraud date" columns. The Policies page disclaims this ("not victim reports"), but I could not check how the queue row labels them.
- A tamper-evident audit log on a disk that resets on deploy, and an unauthenticated case-file DELETE route, on an "evidence" tool.
- Absolute phrases ("Nothing is hardcoded", "Nothing here is aspirational") next to counter-examples.

**Trust earners (verified, keep):**
- Every landing figure recounts exactly (appendix B).
- Bad input is refused cleanly (appendix C).
- The "not built" list names the hard things (NCRP, SAHYOG, indexing, cross-chain) with a plan.
- The legal module offers only sections I recognise as correctly described (BNSS 94, 105, 106, 107; BSA 63; none described as a freeze), prints no statute by default, and uses the 1 July 2024 midnight-IST commencement.
- The contact desk is specific and India-aware (CoinSwitch nodal desk, WazirX preservation window), each with source and read date.
- Security headers match the claims (HSTS, nosniff, DENY, referrer, permissions, CSP).
- The AI statement is candid, and the isolation forest discloses its own baseline in-panel.
- 103 tests; a verifier that imports nothing from the tracer.

---

## 7. Scores

| Criterion | Score | Reason |
|---|---|---|
| Novelty | 8.5 | Derived (not bought) deposit-account attribution including Indian exchanges via the gas-funder route, triage by recoverability, Tether freeze check, backward tracing, tamper-evident packet. Hero line "most tools stop at the exchange" is arguable against commercial tools |
| Technical depth | 8.5 | Three chains on one engine, two taint models, hand-written Keccak, QR, Web Push and hash-chained log, 103 tests. Held back by two near-constant rules, a 29-row ML baseline, no TRON contract/DEX/mixer handling, and the core-scenario gap |
| Feasibility | 8.0 | Deployed and reading live chains. But keyless (`chainAccess: public`) latency of 12 to 179 s, no persistent state on the host, and the integrations the PS names (NCRP, SAHYOG) need access only I4C can grant |
| Clarity | 7.5 | The argument is clear and the page candid, but the headline definitions (CRITICAL, CLOSED) and several numbers disagree between pages |
| UX for an Indian officer | 7.0 | Streaming progress, IST, INR at a live rate, 1930 footer, state grouping. English-only apart from Help; dense dark console; multi-minute waits |
| Impact and India fit | 8.0 | FIU-IND, CoinDCX, WazirX and CoinSwitch desks, BNSS and BSA, digital-arrest label. But all Indian-exchange coverage is on Ethereum, none on TRON; BTC-borne typologies untraced |
| Evidence and legal fit | 8.5 | Hash per response, fingerprint, QR, optional s.63(4) certificate, careful legal picker. Regime switch keyed on fraud date; case ID unstable and non-unique; log not durable on the demo |
| Credibility | 7.0 | Unusually honest in many places, undercut by a 404 repository, no repo link on the site, and the contradictions in sections 4 and 5 |
| **Overall** | **7.9** | Mean of the eight (63.0 / 8). Projected 8.4 after the fixes below |

---

## 8. Fixes that raise the score, ranked by gain per effort

Each is one developer, under about 2 hours, in code or copy. Score lifts are my estimates.

| Rank | Fix | Where | Why a judge cares | Effort | Lift |
|---|---|---|---|---|---|
| 1 | **Latency copy to measured.** Replace "about half a minute" with "10 seconds to about 3 minutes on the public endpoint (14 reference wallets on 4 Oct: median 12 s, slowest 179 s); seconds with a key and a warm cache". Rename the row "Near-real-time tracing". Add a notice in the loader after 45 s ("This wallet has a long history; reading continues") | `app/help/page.tsx` (+ Hindi strings), `app/investigate/`, `app/operations/page.tsx`, `components/TraceLoader.tsx` | "Real-Time" is in the PS title. The first slow trace should be expected, not discovered | 15 min | Clarity +0.3, Credibility +0.3 |
| 2 | **Disposition copy truth pass.** CRITICAL: "No exit reached. The money is still at rest, or still moving and not yet attributable after three hops." CLOSED: "The path reaches a sanctioned address (OFAC SDN) or a labelled mixer. No mixer list ships yet." Change "Rules, not a model" to "Rules decide. One advisory model only ranks." Fix the Help swap-or-bridge sentence to "on Ethereum and Polygon; on TRON a swap contract is not detected" | `app/page.tsx` (disposition section and chain note), `app/help/page.tsx` 03 and 05, Hindi strings | The first screen must match the first live result; two of the three headline dispositions are mis-described | 20 min | Clarity +0.4, Credibility +0.3 |
| 3 | **`/operations` truth pass.** Add rows "Automated pattern recognition for fraud typologies: not built, officer-entered label, plan" and "Privacy-enhancing mechanisms: out of scope, screened only" (the counts are computed). Move "Identification of cross-chain fund movement" to a partial row (Ethereum and Polygon bridge stop, none on TRON, no recorded case). Make 08's Indian-VASP sentence chain-specific. Name Polygon in 04 and 08. Fix "one were". Drop "The rest are illustrative". Relabel TDii6 "funds at rest when recorded on 14 Sep". Print case IDs from the same source as the register, or drop them | `app/operations/page.tsx` | This is the jury-question surface and promises a map of the PS's own list. A caught omission puts every other claim in doubt (the page's own words) | 25 min | Clarity +0.3, Credibility +0.5 |
| 4 | **Repository link and feedback channel on the site.** Footer link, `/policies` 05, `/accessibility` 03, `/developers`, all pointing at the public mirror `mirzadev12/crypto-fraud-tracer` (HTTP 200) | footer component, `app/policies/page.tsx`, `app/accessibility/page.tsx` | "Open an issue on the project's repository" currently has nowhere to go; GIGW expects a working feedback route | 15 min | Credibility +0.3 |
| 5 | **Pitch copy.** Remove "Nothing on screen is hardcoded" (say "the register and the figures are computed from the server's reads and the committed data files"). Replace the freeze-window and "hundreds a day" sentences with the cited MHA figure and "for bank accounts the window is hours; for crypto, how long ago the money last moved decides". Drop or evidence "foreign tools under-label". Split 80 into "52 active in Sept 2026 and 28 historical (2021), all on Ethereum". Change "(sanctioned or mixer)" to "(sanctioned)". Reword "most tools stop" to "most open tools" | `docs/pitch/05-portal-text-finale.md`, and the deck wherever it repeats these | A judge falsifies an absolute in one click | 20 min | Credibility +0.4 |
| 6 | **Make a reported deposit address the exit.** If `lookup(root)` is an exchange deposit or hot label, set `terminal` to the reported address with `depositAddress` = itself, keep triage WARM, and use a reason like "The reported address is itself a likely MEXC customer deposit address (confidence 0.95, 31 sweeps); a freeze request naming it is viable". Keep the forward trace as supporting detail. Add a unit test. The 14 recorded roots are unlabelled, so the existing regression gate is unaffected | `lib/tracer.ts` (`decide()`), narrative and leads wording, `tests/` | It is the PS's simplest scenario and the product's one-sentence thesis. A judge will try a known deposit address in the first minute | 60 to 90 min | Technical depth +0.3, Impact +0.3 |
| 7 | **Persistence disclosure.** One sentence in `/operations` 02 and `/policies` 01: "On this demonstration host the audit log, case file and alert list are not kept across deploys; a deployment sets `FINEX_STATE_DIR` to a persistent disk." Optional, same sitting: refuse `DELETE /api/cases` unless the caller's actor matches the saver | `app/operations/page.tsx`, `app/policies/page.tsx`, optionally `app/api/cases/route.ts` | A tamper-evident log that silently resets is exactly what a security-minded judge probes | 10 min (45 min with the guard) | Credibility +0.2 |
| 8 | **Legal regime control.** Add "FIR or complaint registered on or after 1 July 2024?" to the legal-basis picker and make `regimeOf(fraudDate)` only the default hint. My reading of BNSS s.531(2)(a) is that old procedure is saved for what was *pending* on 1 July 2024, which an FIR date answers and a fraud date does not. Confirm with a law officer before shipping | `lib/legal-basis.ts`, the freeze request component, `tests/legal-basis.test.mjs` | Evidence-and-legal-fit is a scored axis, and a May-2024 fraud reported in 2026 would be shown old-law sections | 45 min | Evidence +0.4 |
| 9 | **Base rate beside the weak rules.** On PEEL_CHAIN and HIGH_FANOUT show "fires on 16 and 15 of 17 unreported wallets (sample of 17)" in the signals panel | `lib/risk.ts` (flag metadata), the signals panel component | The sample case prints "229 wallets" as laundering evidence. Showing the base rate converts a weakness into the maturity the team's own pitch relies on | 45 min | Technical depth +0.2, Credibility +0.2 |
| 10 | **Typology and asset honesty.** Under "Type of scam" add: "Entered by the officer; FineX does not detect scam type. Bitcoin and Monero flows, common in ransomware and darknet cases, are screened, not traced." On batch triage add: "Column names are matched loosely; I4C's export format has not been seen" | New-case form component, `components/BulkTriage.tsx` | Closes PS items A9, B1 and F4 by stating them | 20 min | Clarity +0.2 |
| 11 | **Unique, stable case reference (optional).** Drop the year from `caseIdFor()` (or take it from the first trace), widen the suffix to six characters from a SHA-256 of chain and address. Read `lib/fingerprint.ts` and `scripts/check-demo.mjs` first; the IDs in `data/demo-cases.json` and `public/mock/cases.json` would change | `lib/tracer.ts`, the two data files | Two IDs for one wallet and a 10,000-value space are poor for an evidence reference | 30 to 45 min | Evidence +0.1 |
| 12 | **Stretch: TRON contract detection** (a TronGrid account-type read, or a short sourced router/pool list as `kind: "contract"` labels), so a DEX router stops a TRON trace as it does on Ethereum. Must keep the 10-of-10 TRON regression gate identical | `lib/trongrid.ts`, `lib/tracer.ts`, `data/` | Closes A5 and part of A4 on the chain that matters. Higher risk on the last day; do it only after 1 to 10 | about 2 h | Technical depth +0.2 |

Do not start today (over budget or blocked): full Hindi navigation, landing and packet (about 3 h); NCRP or SAHYOG integration (needs I4C access); supervised ML (no outcomes to train on); BNB Chain (no keyless source).

Projected after 1 to 10 plus section 9: Credibility 8.5, Clarity 8.5, Feasibility 8.5, UX 7.5, Evidence 9.0, Impact 8.3, Technical depth 8.7, Novelty 8.5. Mean 8.4.

---

## 9. Outside the code (the team must do these)

| When | Action | Why |
|---|---|---|
| Now, 2 min | Make `reemrasheed2007/crypto-fraud-tracer` public, or point both decks, the portal fields and the video description at `mirzadev12/crypto-fraud-tracer`. Anonymous check on 4 Oct: the first returns 404, the second 200 | Single biggest credibility fix: Credibility 7.0 to about 8.5. Without it "check it yourself" fails |
| Now, 10 min | Set `TRONGRID_API_KEY` in the Render dashboard (free key; entered by a teammate, never committed). Confirm `/api/health` then shows `"chainAccess":"keyed"` | Live tracing is keyless today (`chainAccess: public`), which is what produces the 100 to 180 s traces and the risk of an "unreadable wallet" result in front of a judge |
| After fixes 1 to 5 | Re-record the 60-second demo on the current build; re-export the deck and PDF; re-paste the portal text; re-count every typed figure first | The video shows the September interface (the team's own review) |
| Before freezing figures | Optionally re-run `node scripts/refresh-sanctions.mjs` on the Windows machine. `/api/status` shows the OFAC list published 18 Sep and retrieved 24 Sep. Counts may change (334, 458, 1,043) and ripple into the deck and portal text | A stale-by-ten-days sanctions list is visible in the status line. Only do it if you can update every typed number the same day |
| Before filing any packet | Have a law officer confirm the legal-basis list and the old-versus-new rule. Re-verify the exchange contact pages (all read 25 Sep) | FineX already says a law officer should confirm; make that true before the finale |
| Render settings | Leave `plan` and `DEMO_MODE` as the standing rules say. For the finale, `DEMO_MODE=true` is the safe fallback for the recorded cases only; a judge's own address still goes live | Network risk on the day |

---

## Appendix A. Measurements (4 Oct 2026, all keyless)

| Test | Result |
|---|---|
| `GET /api/trace/TJjc21...` bare, live (three other requests and a browser trace in flight) | 99.98 s; `x-finex-provenance: live`; 47 API calls; 38 response hashes. WARM, 5,200 USDT (9.4% of 55,242) to a likely Bybit deposit address, four rules fired |
| Same wallet in the browser | Still reading at 37.3 s (1,087 transfers, 7 chain calls) before the shared pane was navigated away |
| `GET /api/trace/TDii6...` | 162.7 s. HOT, "trail is still moving", one rule fired |
| `GET /api/trace/TXq2...` | 3.2 s (warm) |
| `GET /api/trace/<unused valid TRON address>` | 2.5 s. CLOSED, "No USDT transfer has ever been recorded" |
| Reference-loop gaps from `/api/register` `readAt` (13 intervals, seconds) | 10.3, 10.3, 10.6, 10.7, 10.7, 11.4, 12.0, 59.2, 64.9, 70.6, 81.1, 108.2, 178.7. Median 12.0; 6 of 13 at or above 59 |

## Appendix B. Figure reconciliation

| Figure on the site | Recount |
|---|---|
| 565 deposit addresses | 241 TRON + 221 Ethereum + 103 Polygon |
| 16 exchanges | Distinct union across the three chains = 16 |
| 37 seeds (deck) | 15 + 12 + 10 |
| 80 at Indian exchanges | CoinDCX 29 + WazirX 23 + CoinSwitch 28, all Ethereum; 0 on TRON, 0 on Polygon |
| 458 sanctioned on the chains traced | 334 TRON + 124 EVM-format |
| 1,043 screened across 20 assets | 334 + 709 |
| 14 recorded cases | HOT 2, WARM 7, COLD 5. Node kinds: sanctioned 8, exchange deposit 6, exchange hot 2, contract 1, mixer 0, unlabelled 29 |
| 17 capabilities (13 + 1 + 3) | Consistent with the list shown |
| About 100 tests | 103 `test(` or `it(` calls in `tests/` |

## Appendix C. Hostile inputs

| Input | Result |
|---|---|
| TRON address with a flipped last character | 400 "Checksum does not match" in 0.28 s |
| `<script>alert(1)</script>` as address | 400 "A TRON address starts with 'T' and an Ethereum address with '0x'." |
| `{}` | 400 "address is required." |
| Valid but unused TRON address | 200 CLOSED with a plain reason; honest |
| Derived MEXC deposit address as the reported address | 200 WARM at the MEXC **hot wallet**, `depositAddress: null` (the O1 gap) |

## Appendix D. Security headers on the live home page

HSTS (2 years, includeSubDomains), `x-content-type-options: nosniff`, `x-frame-options: DENY`, referrer-policy `strict-origin-when-cross-origin`, a permissions-policy, and a CSP of `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; ... connect-src 'self'`.
