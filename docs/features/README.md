# Features added on `feat/ethereum` (for the grand finale)

Each built feature has its own note: what it does, how to use it, how it was
verified, and its limits. The numbers follow the priority list agreed on
25 Sep 2026. None of this is on the submitted site: that is `main` at
`15cc0a6`, which matches the deck and the video.

## Built

| # | Feature | In one line | Note |
| --- | --- | --- | --- |
| 01 | Ethereum tracing | USDT on Ethereum traced like TRON; CoinDCX, WazirX and CoinSwitch named | [01](01-ethereum-tracing.md) |
| 02 | Tether freeze check | Has the issuer already frozen this address? A second route to freezing | [02](02-tether-freeze-check.md) |
| 03 | Complaint-sheet intake | A CSV of complaints, each traced with its own NCRP number, amount, date and state | [03](03-complaint-sheet-intake.md) |
| 04 | One request per exchange | Many complaints ending at one exchange become one letter to it | [04](04-one-request-per-exchange.md) |
| 05 | Zero-value guard | Spoofed zero-USDT transfers can no longer trigger rules or hide an at-rest wallet | [05](05-zero-value-guard.md) |
| 06 | Address-poisoning warning | The wallet card flags look-alike dust and poisoning sprays | [06](06-address-poisoning-warning.md) |
| 07 | Tamper-evident packet | A fingerprint of the findings, a check link and a QR code on every packet | [07](07-tamper-evident-packet.md) |
| 08 | Ethereum attributions measured | Re-tested with their own rule, and checked against who paid their gas; one conflict found and flagged | [08](08-ethereum-confidence-measured.md) |
| 09 | Checks on every push | CI: tests, types, lint, build, and demo mode serving every recorded case | [09](09-checks-on-every-push.md) |
| 12 | More Indian exchanges | CoinSwitch added (28 addresses, 2021); no other Indian VASP wallet is publicly tagged | [12](12-more-indian-exchanges.md) |
| 13 | Tracing backwards | A wallet's payers, and the exchanges that funded them, one hop back | [13](13-tracing-backwards.md) |
| 14 | Where to send it | Each exchange's own law-enforcement channel and conditions, above every freeze request | [14](14-law-enforcement-contacts.md) |
| 15 | Recording outcomes | What each exchange did with a request, counted by exchange | [15](15-recording-outcomes.md) |
| 16 | By state | A batch counted by state or union territory | [16](16-by-state.md) |
| 17 | Hindi help | The help page in Hindi, marked for native-speaker review | [17](17-hindi-help.md) |
| 18 | Alerts when the desk is closed | The server checks the watch every five minutes and sends a browser notification when a wallet moves; no provider, no key, no dependency | [18](18-alerts-when-closed.md) |
| 19 | Case file, sign-in and audit log | A case file shared by every officer on the server, built only from runs the server traced; who did what, stated or verified by a gateway; a hash-chained audit log anyone can check | [19](19-case-file-and-audit-log.md) |
| 11 | Polygon tracing | USDT on Polygon traced on the same engine, opt-in per case so a `0x` address never changes chain by accident; 103 deposit addresses from Polygon's own tags; a recorded Polygon case | [11](11-polygon-tracing.md) |
| 21 | Reading the chain from the agency's own nodes | Four settings keep every chain read in-house, so no third party learns which wallets are under investigation; never a silent fallback to public | [21](21-own-nodes.md) |
| 22 | Instant replay | A link pinned to a run this server already read is answered from memory, not a second chain read; queue rows carry their run; a recorded case's own pinned link answers from the file outside demo mode too | [22](22-instant-replay.md) |
| 23 | A reported address that is itself the answer | A victim who paid straight into an exchange deposit address or hot wallet gets that address as the exit, named as itself and not followed; a listed address is still followed onward | [23](23-reported-deposit-address.md) |
| 24 | Prepare for court | Nine questions counsel will ask, each answered from the case's own record with what the answer does not establish; outside the filed packet | [24](24-prepare-for-court.md) |
| 25 | Channel readiness | Each exchange's stated conditions as a checklist, this desk's portal access kept in the browser, and a batch line naming exchanges it cannot yet reach | [25](25-channel-readiness.md) |
| 26 | Request to Tether | Money at rest with no exchange on the trail drafts a freeze request to the issuer of USDT; Tether's channel is recorded as not found | [26](26-request-to-tether.md) |
| 27 | Account share | How much of a named deposit account's inflow this case is: a share, an upper bound, or nothing | [27](27-account-share.md) |
| 28 | The critics' fixes | Stable case references, "traced (none reported)" labels, the pending-on-1-July-2024 question, rule base rates beside the rules, a copy truth pass, and the three review reports | [28](28-critics-fixes.md) |

Notes 22 to 28 were built on `finale/refine`, after the critics' reviews of 4 Oct
2026 (`docs/review/`); the others on `feat/ethereum`.

## Not built yet, and why

| # | Item | Why not yet |
| --- | --- | --- |
| 1 | Merge into `main` and deploy | The submitted site stays as submitted: the deck and video describe it |
| 10 | BNB Chain | No keyless data source (checked 25 Sep 2026): Blockscout has no BSC (404), Routescan does not support it, Etherscan's free tier refuses the chain, Ankr needs a key. It needs a paid key |
| 20 | Following money across bridges | Checked 26 Sep 2026: Allbridge Core, the bridge carrying USDT between Ethereum and TRON, last took USDT into its Ethereum pool on 19 Jul 2026, and much of that came from MEV bots; USDT0, Tether's own cross-chain USDT, goes to chains FineX does not read. A follower is per-bridge decoding for traffic that barely exists. A bridge stays a named stop — and both are now recognised as bridges, which they were not before (note 01) |

## Checks, as of the last push

- 83 unit tests, and CI green on every push.
- All 14 recorded cases (10 TRON, 3 Ethereum, 1 Polygon), re-derived from the chain,
  give the same fingerprints.
- End-to-end checks on production builds for each feature (see each note).
- 8 routes × 4 widths with no sideways scroll, and no console errors.
