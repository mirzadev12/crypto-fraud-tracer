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

## Not built yet, and why

| # | Item | Why not yet |
| --- | --- | --- |
| 1 | Merge into `main` and deploy | The submitted site stays as submitted: the deck and video describe it |
| 10 | BNB Chain | No keyless data source (checked 25 Sep 2026): Blockscout has no BSC (404), Routescan does not support it, Etherscan's free tier refuses the chain, Ankr needs a key. It needs a paid key |
| 11 | Polygon | Feasible (Blockscout serves Polygon keylessly), but little reach: of the Indian exchange wallets the explorer tags on Polygon, one CoinDCX wallet ever moved USDT, last in Oct 2025, and the WazirX and CoinSwitch ones none. A `0x` address is valid on both chains, so every link, route, watch entry and recorded case would have to carry the chain — too much risk for that reach |
| 20 | Following money across bridges | Each bridge needs its own decoder and a reader for the destination chain. Today a bridge is a named stop, and the trace says so |
| 21 | Self-hosted nodes | An infrastructure and cost decision for I4C |

## Checks, as of the last push

- 69 unit tests, and CI green on every push.
- All 13 recorded cases (10 TRON, 3 Ethereum), re-derived from the chain,
  give the same fingerprints.
- End-to-end checks on production builds for each feature (see each note).
- 8 routes × 4 widths with no sideways scroll, and no console errors.
