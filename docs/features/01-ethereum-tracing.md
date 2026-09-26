# Ethereum tracing

## What it does

Traces USDT (ERC-20) on Ethereum mainnet with the same engine, limits and
rules as TRON, and names the customer deposit address at the receiving
exchange — Indian exchanges first.

- **One engine, two chains.** An address starting `0x` is traced on Ethereum;
  one starting `T` on TRON. Every limit (3 hops, top 5 outflows, 1% dust,
  after the fraud date, stop at a label), both taint models, dwell, the six
  risk rules and the disposition are the same.
- **Attribution.** 221 customer deposit addresses across 9 exchanges, 80 of
  them at CoinDCX, WazirX and CoinSwitch, derived from 12 explorer-tagged
  wallets with public data and no key (`data/eth/`). CoinSwitch's 28 describe
  it as it was in 2021 (see 12). WazirX is reached through its
  explorer-tagged gas wallet ("Deposit Funder"), because the wallet its
  deposit addresses sweep into carries no public tag.
- **Sanctions.** The 124 Ethereum-format addresses on the OFAC list are labels;
  a trace that reaches one is CLOSED.
- **Swaps and bridges.** Money that enters a DEX pool, router or bridge stops
  the trace there, named from the explorer's own tag, with a sentence saying
  USDT cannot be followed past it. Safe multisigs and EIP-7702 accounts are
  followed as wallets. A bridge is recognised by "bridge" anywhere in its tags
  (Allbridge's pool is "Allbridge: LP-USDT Token") and by the LayerZero adapter
  USDT0 leaves through ("USDT0: OAdapterUpgradeable"); before 26 Sep 2026 both
  were read as a DeFi pool or an unnamed contract (`tests/contracts.test.mjs`).
- **FIU-IND line.** An exit at an exchange listed as registered with FIU-IND in
  the Lok Sabha answer of 4 December 2023 names the legal company operating it
  — on the case file, the evidence packet and the freeze request.

## How to use it

- **New case:** paste a `0x…` address (42 characters) or a `0x…` transaction
  hash and press **Run trace**. A mistyped mixed-case address is refused by its
  EIP-55 checksum. The line under the field says Ethereum mainnet only.
- **Batch triage:** TRON and Ethereum addresses can share one list.
- **Wallet card, watch, permalink, evidence packet, freeze request:** all work
  for an Ethereum address exactly as for a TRON one.
- **API:** every route that takes an address takes either chain, for example
  `curl http://localhost:3000/api/trace/0x77fB78EAC2021Cd52097168873324d3F1200E275`.
- **Recorded cases (demo mode):** `0x77fB…0E275` (ends at a CoinDCX deposit
  address), `0x16a8…15dd` (reaches an OFAC-listed address), `0xda4E…569c`
  (700 USDT at rest). Chosen by script, not reported by victims.

## Scripts

- `node scripts/cluster-eth.mjs` re-derives the Ethereum deposit addresses.
  Back up `data/eth/deposit-addresses.json` first; `--from N --merge` adds one
  seed without re-deriving the rest.
- `node scripts/freeze-eth-cases.mjs [WARM|COLD|HOT]` captures Ethereum cases
  through a running app without demo mode.
- `node scripts/verify-case.mjs <address>` re-reads each transfer from raw
  Ethereum nodes, a different provider from the one that traced it.

## Limits

- Ethereum mainnet only. The same `0x` address on BNB Chain, Polygon or
  another EVM network is not read, and every Ethereum result says so.
- Reads Blockscout without a key: 180 requests a minute per IP. Set
  `BLOCKSCOUT_API_KEY` in your own environment for more; never paste it here.
- The very largest unlabelled wallets can time out; they are reported as not
  read, never as empty.
- Confidence says how much sweep evidence was seen, not how likely the
  attribution is to be right.
