# A national-level judge's review of FineX — 4 Oct 2026, after deploy `602ec80`

Written as a devil's advocate on the SIH evaluation criteria, against the live
site and the finale deck. The target is 9.5/10; the gap list is in priority order.

## Scores today

| Criterion | Score | Why |
| --- | --- | --- |
| Novelty | 9.0 | Names the customer deposit account, not just "Binance"; triage by recoverability; a derived (not bought) attribution dataset including Indian exchanges. Nobody else in the 247 shows that. |
| Technical depth | 9.0 | Three chains, two taint models, clustering, an isolation forest, a hash-chained audit log, own-node support, CSP and rate limits. |
| Feasibility | 9.0 | Deployed, live chain reads on screen, 100 tests, a 72-check production sweep. |
| Clarity of the deck | 7.5 | Dense; the strongest India fact (80 deposit addresses at CoinDCX, WazirX, CoinSwitch) and the three chains are not in the figure row; small type. |
| User experience for an Indian officer | 7.5 | English-only main screens (Hindi only on Help); a dark, dense console a station-level officer may find heavy; no guided first case. |
| Impact and India fit | 8.5 | INR at a live Indian rate, 1930, digital-arrest typology, FIU-IND; but NCRP / SAHYOG are designed, not connected, and no state view. |
| Evidence and legal fit | 8.0 | Hashes, fingerprint, QR check; but no BSA s.63 certificate and no legal-basis choice, which an MHA reader expects. |
| Credibility | 7.0 | The GitHub link in the deck is private (404 to an evaluator); the demo video shows the September interface. |

**Overall: about 8.3 / 10.**

## What a judge would say first

1. "I clicked your GitHub link and got a 404." — fatal to the credibility of
   every claim that says "check it yourself".
2. "Your deck still reads as a TRON tool with a few extras." — the figure row is
   all TRON; Ethereum, Polygon and the Indian exchanges are in body text only.
3. "Your video is not the product I just opened."
4. "Where would the officer's legal basis go?" — the freeze request prints no
   statute on purpose, but offers no structured place for one either.
5. "Can a constable in Lucknow use this in Hindi?"

## Gap list to 9.5 (do in this order)

| # | Change | Owner | Effort | Lifts |
| --- | --- | --- | --- | --- |
| 1 | Make `reemrasheed2007/crypto-fraud-tracer` public, or point both decks' GitHub link at the public mirror `mirzadev12/crypto-fraud-tracer` (its `main` is identical, `602ec80`) | repository owner / user | 2 min | Credibility 7 → 9 |
| 2 | Paste `docs/pitch/05-portal-text-finale.md` into the portal (valid now: the site is live) and upload the Finale PDF | user | 10 min | Clarity, Impact |
| 3 | **Done 4 Oct:** the Finale deck's figure row reads 565 deposit accounts across 3 chains · 16 exchanges from 37 seeds · 334 OFAC · 80 at Indian exchanges · 33/0 · 0 licences; slides 2–5 updated for three chains, live data, advisory ML and security | Plan A | done | Clarity 7.5 → 8.5 |
| 4 | Legal-basis picker on the freeze request and an optional BSA s.63(4) certificate block, offering only `docs/research/2026-10-04-india-context.md`'s verified sections, with the old/new-law choice | Plan A | 2 h | Evidence 8 → 9 |
| 5 | Hindi on the navigation, landing, case-file headings and packet section titles (`?lang=hi`), marked machine-drafted | Plan A | 3 h | UX 7.5 → 8.5 |
| 6 | Re-record the 60-second demo (`docs/pitch/record-demo.js`) on the live build | Plan A | 1 h | Credibility |
| 7 | State and UT tiles on batch triage; accessibility statement and website-policies pages (GIGW) | Plan A | 2 h | Impact, UX |
| 8 | The hero trace "reads itself" once; the fingerprint settles character by character | Plan A | 1.5 h | UX polish |

Items 1–3 are worth more than 4–8 together.
