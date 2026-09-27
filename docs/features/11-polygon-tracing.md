# Polygon tracing

## What it does

USDT on **Polygon PoS** is now traced like USDT on TRON and Ethereum: the same
engine, the same five limits, the same rules, taint, triage, evidence packet,
freeze request, watch and alerts. Polygon was founded in India, Indian
exchanges support it, and on 27 Sep 2026 its USDT was busy: 1,250 transfers in
about five minutes.

**One rule governs all of it: Polygon is said, never guessed.** A `0x` address
is valid on Ethereum and on Polygon, and it is a different wallet history on
each. An exchange that credits one network need not credit the other. So:

- **A bare `0x` address still means Ethereum everywhere.** Every existing
  link, recorded case, watch entry and saved case behaves exactly as before.
- **Polygon is opt-in and carried explicitly.** New case offers a **Network:
  Ethereum | Polygon** choice for a `0x` address. Everything downstream carries
  `chain=polygon`: the trace routes, permalinks, the evidence packet and its
  check link, the freeze request, fund flow, the wallet card, the navigation's
  case links, the watch and alerts, and the case file and audit log.
- **Every screen that shows a Polygon case says so,** and every address chip on
  it opens Polygon's pages. The explorer link goes to PolygonScan, and the wallet
  card is Polygon's. An Ethereum case on the same address is a separate case.

**Attribution is Polygon's own, not borrowed:**

- **10 exchange wallets tagged on Polygon's explorer**, each tag read from live
  rows: CoinDCX, Binance, OKX, Bybit, Gate.io and MEXC.
- **103 customer deposit addresses across 5 exchanges** (Binance 29, OKX 27,
  MEXC 22, Gate.io 16, Bybit 9). They were derived with the same sweep rule as
  Ethereum (`scripts/cluster-eth.mjs --chain polygon`, 8.4 minutes, no key, no
  throttling).
- **CoinDCX gave none, honestly.** Its Polygon wallets are tagged but quiet
  since 2025, and none of their few senders met the rule. The gas-funder route
  does not apply: CoinDCX's deposit funders have sent nothing on Polygon.
- **An Ethereum label never carries over.** An Ethereum deposit address is not
  thereby a Polygon one.
- **OFAC listings do carry over,** because a sanctioned person controls the
  same key on every EVM chain.

**Tether's freeze check works on Polygon.** Polygon's USDT is now Tether's
USDT0. Its freeze list is `isBlocked(address)`, verified on the contract and
against public Polygon nodes.

**One recorded Polygon case** runs in demo mode. `0x577d132eF3cCE50B38D768670ACdaC26680902D4`
paid 31 USDT into a derived Binance deposit address and comes back SUSPICIOUS,
with a freeze request viable. It was selected by script
(`freeze-eth-cases.mjs WARM --chain polygon`), not reported by a victim.

## How to use it

1. **New case:** paste a `0x` address, choose **Polygon** under Network, and
   run the trace.
2. **Or open a link directly:**
   `/trace/0x577d132eF3cCE50B38D768670ACdaC26680902D4?chain=polygon`. The same
   parameter works on `/report`, `/freeze`, `/wallet`, `/api/trace`,
   `/api/wallet` and `/api/issuer`.
3. **In-house reads:** `POLYGON_BLOCKSCOUT_URL` and `POLYGON_RPC_URL` keep
   Polygon's reads on the agency's own servers, on the rules of note 21.
   `/api/health` reports `polygonHistory` and `polygonNode`.

## How it was built without disturbing the other chains

- **One client, Ethereum unchanged.** The Ethereum client became one client
  over a per-network description: base URL, token, block time and its own
  rate-limit budget. `EthClient` keeps Ethereum's exact values, and
  `PolygonClient` is the same code on Polygon.
- **Polygon's as-of search brackets.** Polygon's block time has changed over
  the years, so reading "as of" a moment finds the block by bracketing between
  two known blocks instead of assuming a fixed interval. It is tested against a
  stand-in explorer whose block time changes midway.
- **Sentences name the chain.** Those that said "the trail left Ethereum" now
  name the chain the case is on.
- **Recorded cases are keyed by chain.** A Polygon case never answers for
  Ethereum, and an Ethereum case never for Polygon.
- **Watch and alert entries are keyed `polygon:0x…`** for Polygon, so the same
  string on Ethereum is never reported as moved or told.

## Verified

- **Unit tests, `tests/polygon.test.mjs` (5):**
  - labels stay on their chain; OFAC listings carry over;
  - a recorded Polygon case answers only on Polygon, and is not offered to batch
    triage;
  - every link out of a Polygon case says Polygon, and no other link changes;
  - a watched Polygon wallet is never taken for the same string on Ethereum;
  - the as-of search lands on the exact block against a stand-in explorer whose
    block time changes midway.

  Plus Polygon's settings in `tests/endpoints.test.mjs`. All 83 unit tests pass.
- **Fingerprint gate, 14 of 14 identical.** Every recorded case (10 TRON, 3
  Ethereum, 1 Polygon), re-derived from the live chain as of its capture, is
  identical to its recorded copy. That proves the Ethereum client refactor
  changed nothing, and exercises Polygon's as-of search on the real chain.
- **End to end, 25 of 25,** on a production build in demo mode:
  - **Routes:** `?chain=polygon` answers the recorded case; the same address
    without it is never served it; `?chain=polygon` on a TRON address is refused.
  - **Freeze check and health:** the freeze check reads USDT0's list on Polygon,
    and health reports Polygon's reads.
  - **New case:** it offers the network with Ethereum chosen, and traces on
    Polygon when Polygon is chosen.
  - **Links:** the case page's own links, wallet links, explorer links and the
    navigation's case links all carry Polygon, and so do the packet's check
    link, the wallet card and the register row.
  - **Attribution:** the attribution register has Polygon's rows.
  - **Layout:** no sideways scroll at 375 and 784 px, and no console errors.
- **Demo mode serves every recorded case, 15 of 15** (`scripts/check-demo.mjs`,
  as CI runs it), the Polygon case included.
- tsc, eslint and the build are clean.

## Limits

- **Not every screen takes Polygon.** Batch triage reads a `0x` line as
  Ethereum, as its box says; the wallet card says tracing payers back is TRON
  and Ethereum only; a transaction hash is looked up on TRON and Ethereum.
- **CoinDCX is not named on Polygon:** no deposit address met the rule (see
  above).
- **BNB Chain is still not read.** No keyless data source exists for it
  (note on item 10).
