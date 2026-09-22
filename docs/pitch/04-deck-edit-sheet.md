# Deck edit sheet — SIH 2026 idea presentation, PS 26183

Prepared 23 September 2026 against the current deck (`ppt sih.pdf`, 6 slides,
exported from `SIHfineX.pptx`) and the repository at commit `5e7e3d9`.

**Every figure below was re-counted from the committed files today. Every link
was opened and returned 200.** Nothing here is taken from an earlier draft.

---

# PART A — the three fixes that move the score

Do these first. Each is an edit to an existing slide in Canva: text you type or
replace, plus one image. **Nothing is redesigned, nothing moves, no slide is
added.** Together they take the deck from roughly 7/10 to 8.5–9.

---

## A1 · Put the working tool on slide 6

**Why:** right now a screener cannot reach the live system from the deck at all.
The GitHub line has no URL and the deployment is not mentioned. A working,
verifiable system is the rarest thing at idea stage and it is currently invisible.

**In Canva:** Uploads → drag in `qr-finex.png` (in `docs/pitch/`, also sent to
you). Drop it on slide 6 at about 4 × 4 cm, bottom-right, clear of the reference
list. Then type beneath it, in the body font already on that slide:

```
Open the working tool
crypto-fraud-tracer.onrender.com
Three recorded cases open straight from the front page.
```

**Replace** the existing line "Github repository / crypto-fraudtracer-source code
& documentation" — which carries no link — with:

```
Source code        github.com/reemrasheed2007/crypto-fraud-tracer
Live deployment    crypto-fraud-tracer.onrender.com
```

**Reserve the space for the narrated video** so it does not get squeezed in later:

```
Demo video (58 s) — ________________________________
```

**Check the link is awake before you submit.** Render's free plan sleeps after
inactivity, so a cold click waits about 50 seconds and a screener may just close
the tab. Either get the API key and an uptime pinger set on `/api/health`, or put
the video link first and the site second.

---

## A2 · Put the measured numbers on slide 5

**Why:** slide 5 carries no figures at all — every line is an adjective
(accelerates, supports, prioritizes). "Impact" is a scored criterion and you have
real, checkable numbers sitting unused.

**In Canva:** add one strip of six figures across the top of slide 5, above the
existing impact columns. Leave those columns exactly as they are.

```
241        customer deposit addresses derived
10         exchanges covered, from 15 public seeds
202        OFAC-sanctioned TRON addresses
6 of 6     behavioural rules fire on real recorded cases
33 / 0     transactions confirmed on an independent re-read / mismatched
₹0         in commercial data licences
```

Small caption under the strip:

```
Counted from the committed repository. The re-read imports nothing from the tracer, so a bug in the tracer cannot make the check pass.
```

**One correction in FUTURE PROSPECTS on the same slide.** "Real-Time Monitoring"
is listed as future, but it is built. Replace that entry with:

```
Real-time monitoring — built: a wallet still holding funds is re-checked and the officer is alerted when the money moves. Next: monitoring that runs server-side, without the desk open.
```

---

## A3 · Rebuild the references on slide 6

**Why:** this is the slide that is supposed to show sourcing, and today it
carries two URLs tagged `?utm_source=chatgpt.com`, a TRON link described as
"Ethereum", a vendor's marketing page — and it is missing the two sources that
actually underwrite the work.

**Delete** the TRM Labs entry. **Replace** the list with these five, keeping your
existing numbering style:

```
1. Smart India Hackathon 2026 — Problem Statement SIH26183
   Ministry of Home Affairs / I4C
   https://www.sih.gov.in/sih2026PS

2. UNODC (2024) — Casinos, Money Laundering, Underground Banking and
   Transnational Organized Crime in East and South-East Asia, p. 20:
   USDT on TRON "has become a preferred choice". This is why the tool is TRON-first.
   https://www.unodc.org/roseap/uploads/documents/Publications/2024/Casino_Underground_Banking_Report_2024.pdf

3. OFAC Specially Designated Nationals list, US Department of the Treasury —
   the source of the 202 sanctioned TRON addresses carried in the tool.
   https://sanctionslist.ofac.treas.gov/Home/SdnList

4. TronGrid API documentation, TRON — TRC-20 transfer data used for every trace.
   https://developers.tron.network/reference/trongrid-v1-api-overview

5. NCRP and SAHYOG — the platforms the problem statement asks this system to
   integrate with.
   https://cybercrime.gov.in   ·   https://sahyog.mha.gov.in
```

Two of these are load-bearing and absent today: **OFAC** is where your 202
sanctioned addresses come from, and **UNODC** is a UN agency stating that your
chain choice is the correct one. That UNODC line is the strongest sentence
available to you on this slide.

Keep the "KEY RESEARCH INSIGHT" block; it works. If you want it sharper:

```
Public blockchain data → traceable fund movement → a named account an exchange can freeze.
```

---

# PART B — quick corrections (five minutes)

1. **Slide 2 — delete the note-to-self.** The last bullet ends: *"Investigation
   Dashboard — Visualizes fund flow, risk, attribution confidence and case
   status. **make suitable infograph to suit it.**"* Delete that final sentence.
   It reads as an unfinished document.
2. **Slide 3 — the architecture diagram claims databases you do not have.** It
   shows "Case Database", "Transaction Database" and "Evidence Repository". There
   is no database, and *"no database"* is one of your strongest answers on cost
   and deployability. If the diagram is still editable in Canva, rename those
   boxes to **"Committed JSON datasets"**, **"Chain reads (cached)"** and
   **"Evidence packets"**. If it is a flat image, leave it — but know the answer
   if asked: those are files in the repository, not a database.
3. **Slide 4 — replace "problem 3: Jury doubt on validation".** That is a risk
   about your audience, not your system. Use a real one:

```
problem 3: Public API rate limits
Mitigation: one shared adaptive pacer (250 ms, 100 ms with a key, doubling on every refusal). A wallet we could not read is reported as unreadable, never as empty.
```

---

# PART C — the fuller pass

Everything below is the detail behind Parts A and B: the verified figures, the
tested links, slide-by-slide wording, the problem statement's own capability
list, and the claims that must never appear.

---

## 1. Verified numbers — use these and no others

| Figure | Value | Counted from |
|---|---|---|
| Customer deposit addresses derived | **241** | `data/deposit-addresses.json` |
| Exchanges covered | **10** | Binance, Bybit, Kraken, KuCoin, Gate.io, MEXC, Bitget, Flipster, Swapster, UEEx |
| Explorer-tagged seed wallets | **15** | `data/hot-wallets.json` |
| OFAC-sanctioned TRON addresses | **202** | `data/risk-lists.json` |
| Attribution labels in total | **458** | 15 + 241 + 202, no overlaps |
| Real cases frozen with response hashes | **10** | `data/demo-cases.json` (1 CRITICAL, 5 SUSPICIOUS, 4 CLOSED) |
| Behavioural rules, and how many fire on real cases | **6 of 6** | `lib/risk.ts`; all six appear in the frozen cases |
| Independent re-read of case transactions | **33 confirmed · 0 mismatched · 0 missing** | `scripts/verify-case.mjs`, 18 Sep run (17 unreadable — a throttled unkeyed run) |
| Clustering re-tested on the chain | **40 sampled · 31 readable · 31 still meet the rule** | `data/clustering-calibration.json` |
| Rule base rates | peel-chain 16, fan-out 15, sanctioned contact 0 — **out of a 17-wallet sample** | `scripts/calibrate-risk.mjs` |
| Tagged accounts scanned for an Indian VASP | **2,500 · none found** | `data/vasp-scan.json` |
| Added runtime dependencies | **1** (`@xyflow/react`) | `package.json` |
| Commercial data licences | **0** | — |

**The clustering rule, stated exactly:** an address that sweeps into one tagged
exchange wallet **at least twice**, forwarding **90% or more** of everything it
receives, is treated as a customer deposit address at that exchange.

---

## 2. Links — all tested today

| Purpose | URL | Status |
|---|---|---|
| Problem statement listing | https://www.sih.gov.in/sih2026PS | 200 |
| UNODC 2024 — USDT on TRON | https://www.unodc.org/roseap/uploads/documents/Publications/2024/Casino_Underground_Banking_Report_2024.pdf | 200 |
| OFAC SDN list | https://sanctionslist.ofac.treas.gov/Home/SdnList | 200 |
| TronGrid API docs | https://developers.tron.network/reference/trongrid-v1-api-overview | 200 |
| NCRP | https://cybercrime.gov.in | 200 |
| SAHYOG | https://sahyog.mha.gov.in | 200 |
| Source code | https://github.com/reemrasheed2007/crypto-fraud-tracer | 200 |
| Live deployment | https://crypto-fraud-tracer.onrender.com | 200 |

**The UNODC citation is exact.** Page 20, footnote 27: USDT on the TRON
blockchain "has become a preferred choice". Cite it as *UNODC (2024), Casinos,
Money Laundering, Underground Banking and Transnational Organized Crime in East
and Southeast Asia, p. 20*. Do not paraphrase it into something stronger.

**Warning about the deployment link.** It runs on Render's free plan, which
sleeps after inactivity: a screener clicking it cold waits roughly 50 seconds
and may well close the tab. Either put the 58-second screen recording beside it
as the primary link, or have the Render dashboard owner keep the instance awake
(an uptime pinger on `/api/health`) before the deck goes in.

---

## 3. Slide 1 — Title

Matches the portal already. Confirmed against the live listing: PS ID **26183**,
theme **Blockchain & Cybersecurity**, category **Software**, title word-for-word.
Team ID **BC-07**, team **FineX** are present.

**No change.**

---

## 4. Slide 2 — Proposed Solution

**Remove:** "make suitable infograph to suit it."

**Replace the solution line with:**

> FineX turns a victim-reported wallet — or the transaction hash their own
> exchange can produce — into the **customer deposit account inside the receiving
> exchange**, and states whether the money can still be reached.

**Replace the four "competitive edge" bullets with these five:**

- **It names the account, not just the exchange.** The deposit address an
  exchange can actually restrain — 241 of them derived from public data alone.
- **Triage, not just tracing.** Every complaint comes back CRITICAL (funds still
  at rest), SUSPICIOUS (a freezable exit named) or CLOSED (mixer or sanctioned),
  so a cyber cell knows where the next hour goes.
- **Explainable by design.** Six behavioural rules, each stating in plain words
  why it fired. No model names an exchange or sets a disposition.
- **Complaints that share an account are one case.** Convergence is detected
  across a batch — three of our ten recorded cases meet at one MEXC deposit
  address.
- **Evidence, not a screenshot.** Each case produces a packet carrying the
  SHA-256 of every blockchain response behind it, plus a drafted restraint
  request.

**Intake, in one line (add if the layout allows):** a wallet address, a
transaction hash, or a pasted column of either — singly or in bulk.

---

## 5. Slide 3 — Technical Approach

The tech stack block is accurate; leave it. Update the process flow captions so
the thresholds are visible — this is the slide where "complexity" is scored.

| Step | Caption to use |
|---|---|
| Traversal | Depth ≤ 3 · top 5 outflows per wallet · transfers under 1% dropped · only what left after the money arrived |
| Taint | Haircut (default) and FIFO, stated side by side |
| Attribution | Priority: sanctioned → exchange hot wallet → deposit address. Every label carries a confidence and a source tier |
| Clustering | ≥ 2 sweeps into one tagged wallet · ≥ 90% of inflow forwarded → 241 addresses, 10 exchanges, 15 seeds |
| Scoring | SHORT_DWELL · HIGH_FANOUT · PEEL_CHAIN · ROUND_AMOUNTS · NEW_ADDRESS · SANCTIONED_CONTACT |
| Output | Evidence packet (SHA-256 per response) · freeze request · CSV worklist · watchlist |

**Add one line under the flow:** progress is streamed per hop as the trace runs
(NDJSON), so the officer watches real telemetry, not a fake progress bar.

**Image slot:** use `docs/pitch/screenshot-case-finding.png` — a real screenshot
from the live deployment showing the deposit address, its 95% confidence, the
HEURISTIC tier and the taint figures. (`screenshot-fund-flow.png` and
`screenshot-case-queue.png` are there too if a second image fits.)

---

## 6. Slide 4 — Feasibility & Viability

Pair every risk with its mitigation. Keep the existing arch layout; replace the
three problem/mitigation pairs with these six (drop the weakest if space is tight).

| Risk | Mitigation, as we actually handle it |
|---|---|
| Public API rate limits | One shared adaptive pacer for the whole server — 250 ms between calls, 100 ms with a key, doubling on every refusal. A wallet we could not read is reported as unreadable, never as empty |
| Mixers and bridges end the trail | We record the entry and stop. The case closes as CLOSED. We never guess past a bridge |
| Attribution is a heuristic, not proof | Every label carries a confidence and an evidence tier. Re-tested against the chain: 40 sampled, 31 readable, all 31 still meet the rule. Only the exchange can confirm the accountholder — the packet says so |
| Some rules are weak | Measured, not assumed: on a sample of **17 unreported wallets**, peel-chain fired on 16 and fan-out on 15, so those two are known to be weak signals on their own |
| No Indian VASP is publicly tagged | 2,500 tagged accounts scanned, none found. We do not invent one; adding a verified Indian exchange is one row of data and one re-run |
| Cost and deployment | Public endpoints, no licence, no database. Self-hosted by the agency; case data never leaves it |

---

## 7. Slide 5 — Impact & Benefits

Keep the impact framing, but anchor it with the measured figures. **No accuracy,
speed or coverage percentage that we have not measured.**

**Use these:**

- 241 customer deposit addresses across 10 exchanges, derived from 15 public
  seeds — at ₹0 in data licences.
- 202 OFAC-sanctioned TRON addresses carried; 458 labels in all.
- 10 real cases captured with the hash of every blockchain response, covering
  all three dispositions.
- All 6 behavioural rules fire on real recorded cases.
- Independent re-read of every transaction those cases rest on: 33 confirmed,
  0 mismatched, 0 missing.

**Future prospects — correct one line.** "Real-Time Monitoring" is listed as
future, but the watch is built: every CRITICAL case puts the wallet holding the
funds on a watch and the desk re-checks it. Say instead: *"Built: CRITICAL
wallets are re-checked while the desk is open. Next: server-side continuous
monitoring and alerting."*

---

## 8. Slide 6 — Research & References

Replace the list with these, in this order:

1. **Smart India Hackathon 2026 — Problem Statement SIH26183**, Ministry of Home
   Affairs / I4C. https://www.sih.gov.in/sih2026PS
2. **UNODC (2024), Casinos, Money Laundering, Underground Banking and
   Transnational Organized Crime in East and Southeast Asia**, p. 20 — USDT on
   TRON "has become a preferred choice".
   https://www.unodc.org/roseap/uploads/documents/Publications/2024/Casino_Underground_Banking_Report_2024.pdf
   *(This is why the tool is TRON-first. It is the strongest citation on the slide.)*
3. **OFAC Specially Designated Nationals list**, US Treasury — the source of the
   202 sanctioned TRON addresses carried in the tool.
   https://sanctionslist.ofac.treas.gov/Home/SdnList
4. **TronGrid API documentation**, TRON — TRC-20 transfer data used for tracing.
   https://developers.tron.network/reference/trongrid-v1-api-overview
5. **NCRP** (https://cybercrime.gov.in) and **SAHYOG** (https://sahyog.mha.gov.in)
   — the platforms the problem statement asks the system to integrate with.
6. **Source code and documentation:**
   https://github.com/reemrasheed2007/crypto-fraud-tracer
   **Live deployment:** https://crypto-fraud-tracer.onrender.com

Drop the TRM Labs entry unless there is room — it is a vendor's marketing site
and adds nothing a judge can check.

---

## 9. The problem statement's own list — put this somewhere in the deck

PS 26183 names these capabilities. Each needs an honest status. This table fits
slide 3 or 5 as a compact band; it is the single highest-value addition, because
an I4C evaluator reads their own list.

| Capability the PS asks for | Status |
|---|---|
| Automated VASP / exchange identification | **Built** |
| Suspect wallet tracing | **Built** |
| Real-time analysis | **Built** — recorded case in milliseconds; a live wallet in about half a minute on the public endpoint |
| Fund-flow visualisation | **Built** — flow, cluster and timeline views |
| Exchange wallet clustering | **Built** — 241 addresses, 10 exchanges |
| Pattern detection (peel chains, rapid forwarding, structuring) | **Built** — six rules |
| Mixer detection | **Partly** — a path touching a sanctioned service closes the case; a dedicated mixer list is empty because no citable public source was found |
| Standardised investigation reports | **Built** — evidence packet and restraint request |
| Automated investigative recommendations | **Built** — ranked leads naming the next wallet |
| Dashboards | **Built** — case queue, bulk triage, attribution register |
| Complaint intake | **Built** — wallet or transaction hash, singly or in bulk |
| API integrations | **Built** — six documented endpoints |
| Wallet risk categorisation | **Built** — exit, chokepoint, at rest, sanctions stop, unresolved tail |
| Automated alert generation | **Built** — CRITICAL wallets are watched and re-checked while the desk is open. **Finale:** server-side scheduled monitoring |
| Cross-chain / multi-chain | **Finale** — TRON first, because that is where USDT fraud proceeds move. A chain adapter with USDT on Ethereum traced end to end. Bridges are recorded as a hard stop today, never guessed past |
| NCRP / SAHYOG integration | **Finale / After SIH** — intake already takes what a complaint contains. Finale: a documented intake API that takes an NCRP complaint record and returns the trace and a restraint request carrying its acknowledgement number. After SIH: the live connection, once I4C grants access |
| AI/ML-assisted risk detection | **By design, not built** — rules decide every finding, because an attribution an officer acts on must hold up in court. ML's role is ranking, not deciding: a model trained on I4C-confirmed cases orders the queue and never names an exchange or sets a disposition |
| Scalable blockchain indexing | **After SIH** — today, on-demand chain reads with per-address caching. At scale, a self-hosted TRON full node indexing token transfers locally: no third-party API, no rate limits, and case data never leaves the agency |

---

## 10. Never put these on a slide

- That SAHYOG handles VASP freezes. Cite the problem statement's own request for
  SAHYOG integration instead.
- The rule base rates without the words "sample of 17 wallets".
- Confidence as accuracy. It measures how much sweep evidence was seen.
- That the tool proves who owns an account. Only the exchange can confirm that.
- Any speed, accuracy or coverage percentage that does not appear in section 1.
