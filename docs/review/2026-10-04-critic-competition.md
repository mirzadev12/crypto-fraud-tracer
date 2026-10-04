# Competition review for FineX, SIH26183, 4 October 2026

Scope: what the other teams on PS SIH26183 do, what they leave alone, and what FineX should
say louder or add before the deadline (5 October).

Evidence level: public README text, one HTTP GET per listed demo URL, FineX's own record
(CONTEXT.md sections 11 and 12, git log, the live site). **No rival code was run.** Everything
said about a rival is "its README says", not "it does".

---

## 0. Bottom line

1. **The field traces and draws.** The typical entry is Ethereum-first, with a graph, a 0-100 risk
   score, a PDF, an "AI/ML" claim, a freeze notice citing Section 91 CrPC, and an NCRP/SAHYOG box
   that is simulated. What happens after the trace (who sends what to whom, whether they act,
   whether it survives a challenge) is almost untouched.
2. **One rival is genuinely strong: Exchequer** (`sidhy4rth/Exchequer`, live on Railway). It names
   probable deposit addresses, drafts letters to exchanges and to Tether, reads Tether's freeze list
   from the chain, screens six governments' lists, hashes provider responses, correlates cases, and
   publishes a validation that admits its own rules do not separate fraud wallets from ordinary
   busy ones. **FineX's "we name the customer account" is therefore not unique. Stop saying
   "nobody else does".** What is unique is the desk workflow, TRON depth, Indian-exchange coverage
   and self-verifying evidence (section 5).
3. **Five differentiators to say loudly** (section 7): triage at desk scale; the account, in India;
   evidence that checks itself; law as it stands, verified only; deterministic, sovereign and real.
4. **Three features no rival has, each under 2 hours** (section 8): (A) channel readiness, i.e. can
   this desk actually reach this exchange, and how long does onboarding take; (B) a proportionality
   check, i.e. whose other money is in the account being restrained; (C) a "prepare for court"
   sheet generated from the case. Recommended build order: A, C, B.
5. **Three exposures** (section 6): the live site is 3 commits behind HEAD; there is no letter to
   Tether for money at rest (Exchequer has one); the live deployment reads the chains unkeyed, so an
   evaluator's quick traces can be slow or throttled.

Framing that follows from the evidence: **rivals trace a wallet; FineX runs a desk.** The trace is
the commodity. The last mile (queue, request, channel, safeguard, witness box) is the product.

---

## 1. What was surveyed, and how far to trust it

- `gh search repos` for "SIH26183" and "26183", plus the eight named repos, gave **22 relevant
  public repos**. Of these, **14 have a substantive README**, 2 are thin or off-topic, and 6 are
  empty or placeholders. (`prakyath108/SIH26183` is an empty repository; `shubhamkrverma031-rgb/
  SIH26183` has no README and holds only agent skill files; `hanish07-CEO/Crypto-TraceAI` has code
  but no README; three more are under 200 bytes.)
- About 250 teams submitted. These 22 are under 10% of them, and they are the teams that tagged a
  public repo with the PS number. Stronger teams may be private. **Read the counts below as
  directional.**
- Eight repos list a demo URL. On 4 October seven answered HTTP 200 and **ORION's returned 404**.
  A 200 shows a page exists, not that the product works.
- Several rivals were still pushing on 3-4 October (ChainNetra updated 4 Oct, ORION and Cyclops
  3 Oct). Expect more polish, not less.

---

## 2. The field in two tables

### Table A: reach and data

| Entry | Chains traced (per README) | Demo URL, 4 Oct | Data behind it |
| --- | --- | --- | --- |
| **Exchequer** (sidhy4rth) | Ethereum, BSC, Polygon, Arbitrum, Tron | Railway, 200, `/health` ok | Real. 25,508 exchange addresses claimed (25,038 loaded on Ethereum per live `/health`), 11,192 risk labels. Tron: only 41 tagged addresses |
| **ChainNetra** (Shlok-kapade) | TRON, Ethereum, Bitcoin | none listed (Docker) | Live mode or committed fixtures, switchable |
| **GARUDA** (sandeepkaringu2-bot) | BTC, ETH, TRON | Vercel, 200 | Live hops. The team itself calls deposit-address attribution a pilot using demo clusters |
| **MONOMER** (debuuuuuu) | Ethereum and L2s, BTC, SOL. **No TRON mention at all** | Vercel, 200 | Public RPC with a simulated fallback; the demo case is built on synthetic burner clusters |
| **TraceChain** (FT-snow) | BTC, ETH, BSC, TRON, NFTs | Vercel, 200 | Live, with a deterministic sandbox fallback that is labelled "simulated" |
| **BlockTrace** (vishalmudhirajpokala) | TRON, ETH, Polygon, BTC; BSC needs a key | Vercel plus Render API, 200 | Real providers. Says "inconclusive" when unsure. Names exchanges only if a curated entity file is supplied |
| **ORION** (Anupam1707) | Multi-chain claimed, bridge matching | Vercel, **404** | Not stated |
| **Cyclops** (UNownisF9) | ETH, TRON, BTC | Vercel, 200 (frontend; API docs link points at localhost) | Mock trails as fallback; classifier trained on 1,050 synthetic rows; self-labelled prototype |
| LostEmperor08 | Ethereum only, 1-2 hops | none | Live Etherscan with a cached fallback |
| Himanshu-Harsh | ETH, BTC fixtures | none (Docker) | Seeded fixtures with placeholder addresses; offline by design |
| DRAVYA (AnubhavGitHub07) | Ethereum; others "architected" | Vercel, 200 | Synthetic dataset, stated |
| DecipherX (Arya282) | BTC, ETH, TRON, SOL | none | Live public endpoints; desktop app |
| ChainTrace-I4C (theyugster) | Bitcoin, Elliptic++ subset | none | Synthetic 5,000-transaction subset; no TRON |
| CryptoTrace (nikhiltailor7388) | Not stated | none | Not stated; carries a "not an official tool" disclaimer |
| prakyath108, shubhamkrverma031 | empty / no project | - | - |
| **FineX** | TRON, Ethereum, Polygon USDT; OFAC screening of 20 assets | Render, 200, commit `6c2b3e4` | Real. 14 recorded wallets with response hashes; register re-read from the chain every 6 h |

### Table B: what comes out of the trace

| Entry | ML or LLM | Legal text in the output | NCRP / SAHYOG | Evidence integrity | Triage | India-specific |
| --- | --- | --- | --- | --- | --- | --- |
| **Exchequer** | None (rules; validated on 40 fraud wallets vs 48 controls; reports no separation) | Draft letters to the exchange and to Tether; no statute cited; notes foreign designations carry no automatic force in India | Not mentioned | SHA-256 per provider response; report content hash | None: one trace per case, plus a cross-case endpoint | CoinDCX (29 wallets, Ethereum), Delta. States WazirX and ZebPay could not be sourced |
| **ChainNetra** | LightGBM role classifier with SHAP; learned search policy | Section 91 CrPC letters | Batch NCRP input claimed | SHA-256 of raw responses; append-only audit | "M7" urgency equation described (amount x P(exit is a VASP) x freshness / ETA); no output shown | None found |
| **GARUDA** | Transparent 0-100 score | SAHYOG-style draft naming CrPC 91, PMLA 17, IT Act; English and Hindi | NCRP ID field | SHA-256 hash-chained audit log | Ranks VASP endpoints by recoverable rupees | Indian VASP directory with nodal contacts, rupees, Hindi brief |
| **MONOMER** | Groq Llama-3 copilot with tool calling | Badge cites "65B BSA / CrPC 91"; text cites CrPC 91 and BNSS 94 | Ingestion gateway showing sample reference numbers | Court-style dossier | Alert centre (P0-P2) | FIU-IND registry, subpoena schedule |
| **TraceChain** | None stated | BSA certification workflow ("formerly s.65B"); freeze letters | None | SHA-256 digest plus provenance | None; Live Watch polls every 60 s | None |
| **BlockTrace** | None | PDF report | None | Claims traceable to provider responses | Risk score shown with a triage disclaimer | None |
| **ORION** | XGBoost, anomaly score, max-flow/min-cut | Calls BNSS s.107 an "emergency freeze"; BSA s.63 reports | Ingestion claimed | BSA s.63 report | None | FIU-IND registry claimed |
| **Cyclops** | Random forest on synthetic rows | Section 91 notice | Simulated citizen filing (encrypted JSON) | PDF chain of custody; AES-128 fields; audit log | None | 30 hardcoded VASPs with FIU-IND status; rupee formatting |
| LostEmperor08 | None | Section 91 CrPC directive | CSV batch of 50+ wallets | CSV export | "Freeze potential" KPI | None |
| Himanshu-Harsh | None (weighted formula) | PDF report | None | Evidence log, RBAC, audit | None | None |
| DRAVYA | None | Report endpoint | "Architected"; states it makes no government API calls | - | Alerts endpoint | - |
| DecipherX | Rule-based 0-100 | PDF and JSON | None | SHA-256 on exports | None | None |
| ChainTrace-I4C | Random forest, PageRank/HITS on Bitcoin data | BNSS s.94 | None | - | - | Simulated KYC |
| **FineX** | No model decides anything; one advisory isolation forest | Officer-chosen, Gazette-verified sections (BNSS 94, 105, 106, 107; BSA 63); blank s.63(4) certificate in HEAD | NCRP-export sheet intake; no integration claimed | SHA-256 per response; findings fingerprint; QR check link; hash-chained audit verified by a script outside the app; independent verifier (33 confirmed, 0 mismatched) | CRITICAL / SUSPICIOUS / CLOSED; batch; by state; one request per exchange | 80 deposit addresses at CoinDCX, WazirX, CoinSwitch; FIU-IND register copy; contacts for 17 exchanges; INR at a live rate; 1930; Hindi help |

---

## 3. The common pattern (counts out of 14 substantive READMEs)

- **Ethereum-first, "multi-chain" in the pitch.** 7 trace TRON per their README (Cyclops,
  ChainNetra, TraceChain, GARUDA, Exchequer, BlockTrace, DecipherX). At least 3 never touch it
  (LostEmperor08, MONOMER, ChainTrace-I4C). So TRON alone is not an edge; **depth on TRON is**.
- **A headline AI/ML or LLM claim: 5.** Cyclops, ORION, ChainNetra, MONOMER, ChainTrace-I4C. The
  training data is synthetic (Cyclops) or Bitcoin's Elliptic set (ChainNetra, ChainTrace-I4C),
  neither of which matches USDT on TRON. Nobody states a measured outcome on real Indian cases.
- **Synthetic, simulated or fixture data in some role: 7.** DRAVYA, TraceChain (labelled), Himanshu-
  Harsh, ChainNetra (a mode), Cyclops, MONOMER, ChainTrace-I4C. Fallback-to-mock so "the demo never
  fails" is the common design.
- **NCRP / SAHYOG appear in 7 READMEs, and in none as a verified connection.** DRAVYA says
  outright it calls no government API; MONOMER shows sample acknowledgement numbers.
- **A freeze notice that cites a statute: 8.** **5 of those 8 print Section 91 CrPC** (LostEmperor08,
  ChainNetra, Cyclops, GARUDA, MONOMER, the last alongside BNSS 94). CrPC was replaced by BNSS on
  1 July 2024, and FineX's own research note reads CrPC s.91 as now BNSS s.94. ORION, TraceChain and
  ChainTrace-I4C cite the new regime.
- **Hashing or an audit log: 7.** This is table stakes now. It stops being a differentiator on its
  own.
- **A limitations paragraph: about 7.** Also common. The difference is measured versus asserted.
- **The unit of work is one wallet; the output is a picture and a PDF.** Only LostEmperor08 (CSV of
  50+ wallets, Ethereum, with a cached fallback) and ChainNetra (batch input, triage equation, but
  fixtures when not live) gesture at a queue.

---

## 4. Blind spots: what almost nobody does

### What actually stops a freeze, and who addresses it

| Blocker | Who addresses it in the field | FineX |
| --- | --- | --- |
| Money moved before anyone looked | MONOMER alert centre, TraceChain 60 s watch, BlockTrace webhook, DRAVYA alerts endpoint | Watch plus server push, three-valued (moved / at rest / not checked) |
| The account is not named | Exchequer (labels plus inference), ChainNetra (deposit-reuse), GARUDA (pilot) | 565 derived, method published, calibrated |
| The request bounces: wrong channel, missing condition, stale law | GARUDA (static nodal directory). Five rivals cite repealed CrPC | 17 contacts with conditions, verified legal-basis picker. **Gap: nothing checks readiness** |
| **The desk has no account on the exchange's portal; approval takes weeks** | **Nobody** | Not built (feature A) |
| **The order is challenged as too broad: whose other money is in the account** | **Nobody** | Not built (feature B) |
| The evidence is attacked in court | Hashes are common. TraceChain and ORION mention BSA paperwork. **Nobody prepares the witness** | Fingerprint, QR, verifier, blank s.63(4). **Witness prep not built** (feature C) |
| Volume buries the case | LostEmperor08, ChainNetra (claimed) | Working batch, by state, one request per exchange |
| USDT sits in a private wallet, no exchange to write to | Exchequer drafts a letter to Tether | Status check only, no letter (parity gap, section 6) |
| Investigation targets leak through the lookup itself | **Nobody** | Own-node support: no third party learns which wallets are under investigation |

### The seven blind spots, with evidence

1. **Treating the workload as a queue.** 2 of 14 gesture at it; neither shows a working ranked
   output on real data.
2. **Current-law accuracy in the request.** 5 of 8 statute-citing rivals still print CrPC s.91.
   ORION's headline "emergency freeze" under BNSS s.107 conflicts with FineX's Gazette-based
   reading, which is that s.107 is a court process on a police application, not a police freeze
   (`docs/research/2026-10-04-india-context.md`, lines 40-58). A law officer should confirm either
   reading; the point is that FineX alone declines to print a section it has not read.
3. **Wrongful or excessive restraint.** No README mentions it. (ChainNetra's "proportional
   haircut" is a taint model, a different thing.)
4. **Channel and onboarding reality.** GARUDA's directory and escalation matrix are the nearest, and
   they are static documents. No per-desk readiness.
5. **Preparing the officer for the witness box.** TraceChain and ORION address admissibility
   paperwork. None addresses cross-examination.
6. **Investigation privacy and sovereignty.** MONOMER routes its investigation through a hosted LLM
   copilot (Groq); BlockTrace uses Supabase auth; TraceChain uses Convex auth; most deploy on Vercel
   with public explorers. None observes that even a public-data lookup names the wallet under
   investigation.
7. **Independent verification.** Rivals hash. None ships a check link or QR, a findings-level
   fingerprint, or a verifier that imports nothing from the app.

---

## 5. The closest rival: Exchequer

**Where it is stronger than FineX** (README and live `/health`, 4 Oct):

- Label scale: 25,508 exchange addresses claimed, including 24,018 Bitget and Binance customer
  deposit addresses, plus 11,192 risk labels.
- Reads Tether's blacklist events from the contract, and claims 10,352 frozen addresses indexed.
- Screens six governments' sanctions and seizure lists, mixer pools and stolen-funds tags.
- Five chains, including BSC and Arbitrum; FineX has three.
- Drafts a letter to Tether as well as to the exchange.
- A validation section that measures its rules on 40 fraud wallets and 48 controls, finds no
  separation, and says so. It also keeps ADRs and a code tour. This is serious work.

**Where its README stops:**

- No NCRP or SAHYOG, no Indian statute in the output, no rupees, no Hindi.
- No queue, no batch, no state view: "one complaint gives one trace".
- PDF is on its roadmap; output is text and JSON.
- Only 41 labelled addresses on TRON, where UNODC says the money moves, and no precomputed TRON
  deposit addresses. FineX has 241 across 10 exchanges.
- **WazirX and ZebPay are stated as not sourced.** FineX reaches WazirX through the gas-funder route
  (23 addresses plus one derived wallet, flagged heuristic), CoinDCX (29) and CoinSwitch (28).
- No audit chain, no officer identity, no outcome tracking, no per-exchange contact conditions.
- Follows one level after a swap, the top 10 counterparties, and the newest 200 transfers per
  address; it says so.

**Implication for FineX.** Side by side, an evaluator sees Exchequer as a sharper instrument for one
wallet and FineX as an instrument for a day's complaints. Lean into that. Do not claim label scale.
Claim method, honesty and workflow.

---

## 6. FineX as it stands

From CONTEXT.md sections 11 and 12, `git log`, and the live site on 4 Oct:

- **Live site is commit `6c2b3e4`** (`/api/health`: `demoMode:false`, `chainAccess:"public"`). Landing
  figures match the files: 565 deposit addresses, 16 exchanges, 458 sanctioned, three chains.
- **HEAD is three commits ahead**: `3d4786c` (optional blank BSA s.63(4) certificate), `50b25a6`
  (hero motion), `5686a37` (plan). The certificate is part of the "law as it stands" story and is
  not live yet. Whether to redeploy is the owner's call.
- **CONTEXT.md is stale on two points**, which can mislead the next session: section 3 says "No INR
  conversion anywhere" but `f57861f` added INR at a live, sourced rate; sections 8 and 12 say the
  live site is untouched but it is now serving the branch.
- **The internal judge review says "Nobody else in the 247 shows that"** about naming the customer
  deposit account. Exchequer, ChainNetra and GARUDA (pilot) contradict it. Change the wording
  wherever it was copied into the deck, landing page or pitch script.
- **Exposed:** (a) no Tether request letter for money at rest, while `IssuerFreeze` only checks the
  status and the Tether doc says the issuer is the one party that can still stop it; (b) label
  counts are small next to Exchequer's; (c) unkeyed chain access means roughly half a minute per
  trace and possible throttling on an evaluator's first clicks; the 14 recorded cases are the safe
  path; (d) main screens are English-only.

---

## 7. Five differentiators to state loudly

Pitch line for the top of the deck: **"Others trace a wallet. FineX runs a desk."**

Each entry gives one line for the landing page and deck, why rivals do not match it, and the proof
to point at.

### 1. Triage at desk scale
- **Line:** "Paste the morning's NCRP sheet: every complaint ranked by whether its money can still be
  frozen, grouped by state, one request per exchange."
- **Why it is rare:** 2 of 14 gesture at a queue; none shows the ranked output on real data.
- **Proof:** `/queue` batch run, the by-state tiles, the combined per-exchange request, the CSV.
- **Placement:** landing page, directly under "Every case, one of three" (the batch route is not
  mentioned on the landing page today); deck figure row.

### 2. The account, in India
- **Line:** "565 customer deposit accounts derived from public data on three chains, 80 of them at
  CoinDCX, WazirX and CoinSwitch, each labelled heuristic with its sweeps shown."
- **Why it is rare:** rivals hand-type Indian VASP directories; the closest rival says WazirX
  could not be sourced and has 41 TRON labels.
- **Proof:** `/attribution`, the FIU-IND register copy, the gas-payer check, the one conflict row
  (`0xe66EA309...`) that is printed rather than hidden.
- **Do not say:** "nobody else names the account", or anything that reads confidence as accuracy.

### 3. Evidence that checks itself
- **Line:** "Every packet carries a fingerprint and a QR. Anyone can re-derive the findings from the
  chain, and the audit log verifies with a script that imports nothing from the app."
- **Why it is rare:** hashing is common (7 of 14); a check link, a findings-level fingerprint and an
  independent verifier are not described by any README.
- **Proof:** `scripts/verify-case.mjs` (33 confirmed, 0 mismatched), `scripts/verify-audit.mjs`, the
  QR on the packet, the blank s.63(4) certificate (HEAD).

### 4. Law as it stands, verified only
- **Line:** "The freeze request cites only sections we read in the Gazette: BNSS 94, 105, 106 and 107,
  and BSA 63. Nothing prints unless the officer chooses it."
- **Why it is rare:** 5 of 8 statute-citing rivals still print CrPC s.91. FineX also warns when the
  fraud predates 1 July 2024 and states that a law officer should confirm and that none of the
  sections is itself a freeze order.
- **Proof:** `components/LegalBasisPicker.tsx`, `lib/legal-basis.ts`, `tests/legal-basis.test.mjs`,
  the research note.
- **Use in public as:** a generic line ("CrPC s.91 was replaced by BNSS s.94 on 1 July 2024"). Keep
  the "5 of 8 rivals" count and the ORION point for private Q and A. Do not name rivals on slides.

### 5. Deterministic, sovereign and real
- **Line:** "No model decides anything, no case is invented, and no third party need learn which
  wallets are under investigation: point every chain read at your own node."
- **Why it is rare:** 7 of 14 lean on synthetic or simulated data; MONOMER puts an LLM in the loop;
  none addresses lookup leakage.
- **Proof:** `/operations` rows 02, 05 and 06, `lib/endpoints.ts`, `/api/health` `reads`, the 14
  recorded wallets with response hashes, the badge on every figure (live, recorded, as of).
- **Keep honest:** one advisory isolation forest does run; the line is "no model decides", not "no
  ML".

---

## 8. Three features nobody has, buildable today

Selection test: absent from all 14 READMEs; not already in FineX (checked by search of `lib`,
`components`, `app`, `data`, `docs/features`); reuses data and patterns FineX already holds; no
change to the frozen `lib/types.ts`; honest under the standing rules.

Ranked by evaluator impact: **A, B, C**. Recommended build order, lowest risk first: **A, C, B**
(A and C make zero chain reads; B adds one).

### A. Channel readiness: "Can this desk actually send it?"

**On screen.** In the "How to send this request" panel, and in the batch's one-request-per-exchange
panel, each exchange gets a status for this desk plus the next step. Example lines (the contact
facts are from `data/le-contacts.json` as read on 25 Sep; counts such as "3 of 7" are layout
placeholders, not data):

- "MEXC: no access recorded. Its own page says LE system access takes 15-20 business days to
  approve (read 25 Sep). Apply today."
- "CoinSwitch: send from a gov.in or nic.in address (its own page, read 25 Sep)."
- "MEXC, Gate.io, Bitfinex: the order must state the duration of the restriction."
- "KuCoin: does not accept a digital signature or seal."
- A banner on `/queue`: "3 of today's 7 exits are at exchanges where this desk has no recorded
  access: MEXC, KuCoin, Bitget. Start onboarding now."

**Why nobody has it.** Rivals stop at "here is a draft letter". GARUDA's nodal directory and
escalation matrix are static text. None tracks whether the desk can reach the recipient.

**Why MHA cares.** The PS Expected Solution lists "enhance coordination with VASPs" and "improve
freezing of proceeds of crime". The commonest reason a request goes nowhere is that nobody on the
desk was registered on the exchange's portal when the case arrived. This turns that into a visible
checklist, and an exported file lets I4C see the onboarding gap across desks.

**Build sketch (about 2 h).**
- Add structured keys to the entries in `data/le-contacts.json` whose facts are already in the
  free-text `notes` (lead time, duration required, sender domain, seal accepted, portal account
  required). Keep `source` and `checked` beside every fact and show the date.
- Desk access flags (none / applied on a date / active) in browser storage, following
  `lib/outcome-store.ts`; export and import with the outcomes file so desks combine.
- A small chip component in the panel above, plus the `/queue` banner. No chain reads, so it works
  in demo mode and offline.

**Guardrails.** Facts only as the exchange's own page stated them on the stated date; re-read the 17
pages before the finale. Never claim SAHYOG handles VASP freezes.

### B. Proportionality: "Whose other money is in this account?"

**On screen.** A screen-only block above the freeze request, and a limitations line in the packet,
for a case that ends at a customer deposit address. The figures below are invented to show the
layout; they are not data and must never be typed into the interface:

> This address received 18,240 USDT from 41 payers between 14 Mar and 2 Oct. The money traced from
> this complaint is 1,131.72 USDT, 6.2% of that. Most of what this account received is not from
> this case. The request asks the exchange to restrict and review; it does not allege the whole
> account is proceeds.

Bands (all fractions of what we read, never a verdict): the case is most of the inflow; mixed; a
small share. When the history is partial it says "at most" or "not computed", never a guess. When
the read fails it says "not checked" (the three-answer rule).

**Why nobody has it.** No README mentions wrongful or excessive restraint. Every rival optimises for
catching, none for the cross-examination question "you restrained an account where this case is 6%
of the money".

**Why MHA cares.** Over-restraint is the failure that draws challenge in court and complaints from
legitimate account holders. A tool that measures it before the request goes out reads as mature,
not soft. Before quoting any I4C or court position on partial restraint, check the primary source;
the research note does not cover it.

**Build sketch (about 2 h).**
- `lib/wallet.ts`: `WalletProfile` has `receivedUsdt`, `historyComplete` and a capped `fundedBy`
  (top 8). Add a distinct-payer count from the same pass.
- In `components/FreezeRequest.tsx`, when the terminal is `exchange_deposit`, call the existing
  wallet route for the terminal address (chain-aware) and compute the share against the value traced
  to the account. State the window used.
- Pure function plus a test: zero inflow, traced above received (which proves history is missing),
  partial history, unreadable.

**Guardrails.** Skip for an exchange hot wallet (omnibus). The band wording describes, it does not
decide. Confidence is not accuracy applies here too.

### C. "Prepare for court": the witness sheet, built from the case

**On screen.** A section at the end of the packet page (print on request, not part of the filed
document): about ten anticipated questions, each answered from this case's own numbers, with the
limit stated beside the answer.

| Question | Answered from |
| --- | --- |
| How do you know this is the victim's money? | The taint model used, the amount it gives, and a link to re-run under the other model |
| Who says this is the exchange's account? | Source tier, sweep count, "confidence means the amount of sweep evidence, not a probability", gas-payer result |
| Is any wallet on the path unread? | The unread or partial list; findings exclude them |
| Has anything changed since? | Fingerprint, check link, number of response hashes, the audit entry and whether the officer ID is stated or verified |
| Could this be a look-alike address? | The address-poisoning signals |
| Did software decide this? | "No model decides; one advisory model ranks unusual wallets" |
| What did you not check? | The limits already printed in the packet |
| When was it read? | `generatedAt` in UTC and IST, and the pinned "as of" |

**Why nobody has it.** TraceChain and ORION address admissibility paperwork. None readies the
investigating officer for the questions defence counsel will ask of the tool.

**Why MHA cares.** The last hurdle for any restraint is surviving challenge. This makes honest
uncertainty operational, and it pairs with the s.63(4) certificate already added.

**Build sketch (about 2 h).** A pure function `lib/witness.ts`, built like `lib/narrative.ts`, so it
cannot drift from the evidence; one component; a test that every figure in the sheet appears in the
trace. No statutes asserted, no legal advice, no language model.

### Alternates if one of the above is rejected

- **Verification kit download (about 2 h).** A single self-contained script with the case's
  transactions inlined, so a forensic examiner re-reads each hash from their own node. Do not do
  this in the browser: it would force a CSP exception, contradicting "the browser talks only to this
  server".
- **Tether request letter (about 1 h). Parity, not novelty**, but the only freeze route for money at
  rest, which FineX itself says in `docs/features/02-tether-freeze-check.md`. Do this first if an
  evaluator is likely to have seen Exchequer.
- **Morning brief (about 1.5 h).** One A4 for the SP: counts, top three actions with contact and
  clock, the unreadable ones. Useful but incremental over the CSV worklist.

### Deadline risk

The deadline is tomorrow. Each addition risks a regression in a codebase with a roughly 100-test
suite and a 72-check production sweep (figures from the internal judge review) and a deployed
instance. If time allows only one or two, take A and C. Ship nothing
that has not passed `tsc`, `eslint`, the tests and the production sweep.

---

## 9. Claims to avoid, and the safer wording

| Claim | Problem | Say instead |
| --- | --- | --- |
| "Nobody else names the deposit account" | Exchequer, ChainNetra and GARUDA (pilot) do in some form | "We derive ours from public data, publish the method, and print the one conflict we found" |
| "Only TRON-native tool" | 7 of 14 rivals trace TRON | "Depth on TRON: 241 derived deposit accounts at 10 exchanges" |
| "No AI" | One advisory isolation forest runs | "No model decides anything" |
| Naming rivals or "5 of 8 cite repealed law" on a slide | Sample is small and README-level | Keep it for Q and A. On slides say CrPC s.91 became BNSS s.94 on 1 July 2024 |
| "WazirX deposit addresses identified" without qualification | The route is gas-funder heuristics, not an explorer tag | "23 addresses plus a derived wallet, labelled heuristic" |
| "Real-time" with no number | Unkeyed reads are about 30 s per trace | State the measured time or say "within a minute" |
| Confidence as accuracy | Standing rule; calibration found no ordering | "Confidence is the amount of sweep evidence" |
| Anything about SAHYOG and VASP freezes | Standing rule | NCRP-sheet intake; no integration claimed |
| Recorded or illustrative cases as fraud proceeds | Standing rule | "Chosen by script from public data" |

---

## Appendix A: repos surveyed

| Repo | Updated | Language | Note |
| --- | --- | --- | --- |
| sidhy4rth/Exchequer | 28 Sep | Python | Railway demo; strongest rival |
| Shlok-kapade/sih26183-chainnetra | 4 Oct | Python | ML plus triage claim; Docker |
| sandeepkaringu2-bot/GARUDA-I4C-Crypto-Fraud-Portal | 2 Oct | TypeScript | SAHYOG-style notices; Hindi |
| debuuuuuu/SIHcrypto26183 (MONOMER) | 29 Sep | TypeScript | NCRP/SAHYOG UI; LLM copilot |
| FT-snow/tracechain | 8 Sep | TypeScript | Four chains; Live Watch |
| vishalmudhirajpokala/sih26183-blockchain-trace | 27 Sep | JavaScript | Five chains; honest "inconclusive" |
| Anupam1707/SIH26183 (ORION) | 3 Oct | TypeScript | Demo URL 404 |
| UNownisF9/cyclops-sih26183 | 3 Oct | JavaScript | Prototype disclaimers |
| LostEmperor08/SIH26183 | 16 Sep | JavaScript | Ethereum only |
| Himanshu-Harsh/SIH26183 | 25 Aug | Python | Fixtures, RBAC |
| AnubhavGitHub07/SIH-26183 (DRAVYA) | 13 Sep | JavaScript | Synthetic, stated |
| Arya282/sih-DecipherX-26183 | 6 Sep | HTML | Electron app |
| theyugster/elysians_26183 | 9 Sep | Python | Bitcoin Elliptic++ subset |
| nikhiltailor7388/CRYPTO-TRACE- | 9 Sep | Python | Prototype disclaimer |
| xarjunpatil/..., yoyostuu/sih26183backup | Sep | - | Thin or off-topic template |
| prakyath108/SIH26183, shubhamkrverma031-rgb/SIH26183, hanish07-CEO/Crypto-TraceAI, MeghBhut/..., Purnendu2718/SIH-26183, saiapoorv038/... | - | - | Empty or no README |

## Appendix B: evidence log (README line numbers as fetched 4 Oct)

- Exchequer: at-a-glance counts, lines 46-48; Indian exchanges, lines 561-566; validation, lines
  622-650; limitations, lines 701-733; roadmap (PDF), final section; live `/health` 4 Oct:
  `exchange_labels_loaded` 25038, `risk_labels_loaded` 11192.
- ORION: lines 15 and 28 (BNSS s.107 "emergency freeze", BSA s.63).
- MONOMER: lines 8 and 56 (CrPC 91, BNSS 94); zero mentions of tron, trx or trc.
- Cyclops: lines 24 and 79 (prototype disclaimer; Sec.91 notice).
- ChainNetra: lines 88-90 (triage, evidence, Section 91 CrPC letters), 148-151 (urgency equation).
- LostEmperor08: lines 12 and 60 (Section 91 CrPC).
- GARUDA: line 37 (CrPC 91, PMLA 17, IT Act); readiness table (deposit attribution "Pilot").
- TraceChain: line 136 (BSA workflow, "formerly s.65B").
- FineX: `/api/health` on 4 Oct (`commit` 6c2b3e4); `git log 6c2b3e4..HEAD`; research note
  `docs/research/2026-10-04-india-context.md` lines 40-58; `docs/plans/2026-10-04-judge-review.md`;
  `docs/features/02` and `14`; `data/le-contacts.json` (17 entries, `exchange`, `found`,
  `channels`, `notes`, `source`, `checked`).
- Not found in the repo by search: any Tether request letter, any proportionality or
  innocent-exposure text, any witness or cross-examination content, any per-desk channel readiness.
