# Ethereum tracing — design

Status: design approved 24 Sep 2026 (brainstorming), with the FIU-IND line as the one
optional extra taken. For the SIH grand finale, not the submission. Work happens on the
local branch `feat/ethereum`; nothing is pushed, and `main`, Render and the deck are not
touched.

Goal, as the user chose it: **full parity** — trace USDT on Ethereum mainnet and name the
customer deposit address at the receiving exchange — **USDT only**, **Indian exchanges
first**, built as **one engine with a chain adapter underneath** (approach A).

---

## 1. What was measured on 24 Sep 2026

Every design choice below rests on one of these. They are samples, stated as samples.

1. **The deposit-address rule holds on Ethereum when seeded at the right wallet.**
   Binance 14 (`0x28C6c06298d514Db089934071355E5743bf21d60`): 3,573 USDT inflows in the
   last 1,500 blocks from 3,219 distinct senders; of 16 senders sampled and read in full,
   **13 meet the exact TRON rule** (≥ 2 sweeps, ≥ 90% of inflow forwarded) and **16 of 16
   forward 100%**.
2. **Two Indian exchanges are live on Ethereum, and their own gas wallets lead to them.**
   Exchanges pay gas for customer deposit addresses from a funder wallet, and both of
   these funders carry a public explorer tag and were active on 23–24 Sep:
   - *CoinDCX: Deposit Funder 1* `0xC4e805208D8d25b71BDcfB558F29259544EC4fcC` — of 21
     funded addresses sampled, 15 had USDT history and **all 15 swept 100% of it to
     `0x4d24eececb86041f47bca41265319e9f06ae2fcb`**, which is itself tagged
     *CoinDCX: Hot Wallet / CoinDCX 5*.
   - *WazirX: Deposit Funder 1* `0x7aeB3314E041153c4F6bbea19AbECBCe20946fD4` — of 44
     sampled, 24 had USDT history and **19 swept to `0xf6fc530369cbe3ce503ffe986ac5c0828d831a9c`**,
     which carries **no public tag**; three swept to the WazirX Safe
     `0x27fD43BABfbe83a81d14665b1a6fB8030A60C9b4` and two to the tagged
     *WazirX: Binance Deposit*. Seeded directly at that untagged wallet, 5 of 16 senders
     meet the strict rule — several split their sweeps between it and older WazirX wallets.
   - Other Indian exchanges: ZebPay and Giottus have no tags; Mudrex, Unocoin and Bitbns
     only token-contract tags; CoinSwitch's tagged wallet last moved USDT in 2021.
     CoinDCX's other tagged "Hot Wallets" are downstream treasury wallets — seeded there,
     0 of 7 senders met the rule, because what feeds them is DEX routers and Aave, not
     customers.
3. **Address poisoning is endemic.** On a Blockscout-tagged "Bybit Hot Wallet"
   (`0xee5B5B923fFcE93A870B3104b7CA09c3db80047A`), 118 recent inflows included one
   zero-value transfer and 12 under 1 USDT, from vanity look-alikes of a real
   counterparty (`0xf89d…aa40`, `0xb587…178d`). The one "deposit address" the unfiltered
   rule found there was a look-alike that had sent 4 and 6 USDT. That wallet is also not
   a consolidation wallet at all — it receives 100,000,000-USDT transfers from another
   Bybit wallet — which is why a seed must be checked, not only tagged.
4. **Blockscout REST v2** (`eth.blockscout.com/api/v2`, no key, about 180 requests a minute):
   - newest first only — `sort`/`order` are refused with HTTP 422;
   - the page cursor can be started at any block: `block_number=17000000&index=0`
     returned only transfers at or below that block (first 16,923,968) — so an
     "as of" read is a cursor seek;
   - it times out (HTTP 524) on the largest exchange wallets;
   - every transfer names each counterparty's `is_contract`, `name`, `proxy_type`,
     `public_tags` and `metadata.tags` — e.g. *Universal Router V1.2 / Router / DEX /
     Uniswap V3*, *Polygon (Matic): ERC20 Bridge / Bridge*, *Stargate Finance: S\*USDT
     Token / Pool*, *L1 Standard Bridge Proxy / Base: Base Bridge / Bridge*;
   - block timestamps are readable at `/blocks/{n}`.
5. **A public Ethereum node** (`ethereum-rpc.publicnode.com`) answers `eth_getLogs` and
   `eth_getCode` without a key for roughly the last 8,000 blocks; 20,000 blocks back it
   refuses ("Archive requests require a personal token").
6. **USDT** is `0xdAC17F958D2ee523a2206206994597C13D831ec7`, 6 decimals (read from live
   responses).
7. **FIU-IND.** FIU-IND does not publish its registered list. The Ministry of Finance's
   answer to **Lok Sabha Unstarred Question No. 112, 4 December 2023** carries an annexure,
   *Details of VDA SPs registered with FIU-IND*: 28 entities, legal and trade names,
   including *Neblio Technologies Private Limited — Coin DCX* and *Zanmai Labs PVT LTD —
   WazirX*. Source: `https://sansad.in/getFile/loksabhaquestions/annex/1714/AU112.pdf?source=pqals`
   (text read from the PDF itself).

---

## 2. Architecture

```
address / tx hash
   │  checkAddress()  →  { chain: "tron" | "ethereum", canonical address }
   ▼
ChainClient  ──  TronGrid (unchanged)        EthClient (new, Blockscout REST v2)
   │  transfers · outflowsSince · didFail · wasTruncated · apiCalls · responseHashes
   │  contractInfo (Ethereum only)
   ▼
runTrace()  — one engine: limits, taint, dwell, FIFO, triage, unread rules unchanged
   │  lookup()  — one label table, both chains
   ▼
TraceResult { chain: "tron" | "ethereum", … }  →  every screen through lib/api.ts
```

New files: `lib/chain-client.ts` (interface), `lib/ethclient.ts` (Blockscout client),
`lib/evm.ts` (Keccak-256, EIP-55, address and hash checks), `lib/address.ts` (one check
for both traceable chains), `lib/chain-meta.ts` (names, assets, explorer links),
`lib/fiu.ts` + `data/fiu-ind.json`, `data/eth/hot-wallets.json`,
`data/eth/deposit-addresses.json`, `scripts/cluster-eth.mjs`.

---

## 3. The data client

### 3.1 `ChainClient`

```ts
export interface Transfer {           // today's Trc20Transfer, renamed; the old name stays as an alias
  txHash: string; from: string; to: string;
  value: number;                      // divided by decimals
  timestamp: number;                  // ms
  symbol: string;
}
export interface ContractInfo {
  isContract: boolean;
  name: string | null;                // verified source name, e.g. "UniversalRouter"
  proxyType: string | null;           // e.g. "eip1967", "eip7702"
  tags: string[];                     // explorer public/metadata tag names, in order
}
export interface ChainClient {
  readonly chain: "tron" | "ethereum";
  readonly apiCalls: number;
  readonly responseHashes: string[];
  transfers(address: string): Promise<Transfer[]>;          // USDT, newest first, capped, cached
  outflowsSince(address: string, sinceMs: number):
    Promise<{ transfers: Transfer[]; complete: boolean } | null>;
  didFail(address: string): boolean;
  wasTruncated(address: string): boolean;
  contractInfo?(address: string): ContractInfo | null;      // from data already read; never a new call
}
```

`TronGrid` implements it with no behaviour change (it already has every member except
`chain` and `contractInfo`).

### 3.2 `EthClient` (Blockscout REST v2)

- `GET /api/v2/addresses/{a}/token-transfers?type=ERC-20&token=<USDT>` — 50 per page,
  newest first, cursor from `next_page_params`. Up to **20 pages (1,000 transfers)**, the
  same depth TRON reads; more than that marks the wallet truncated.
- **As of:** resolve the moment to the last block at or before it — interpolate from the
  head using `/blocks/{n}` timestamps, a handful of reads, cached per trace — then start
  the cursor at `block_number=B+1&index=0`. Every response used, block reads included, is
  hashed and counted.
- `outflowsSince`: `filter=from`, one page, newest first; the same three answers as TRON
  (null when the chain did not answer).
- **Pacing:** its own server-wide clock, adaptive as TronGrid's — floor 350 ms without a
  key (≈ 171 a minute, under the measured limit), doubles on 429, eases on each answer.
  Optional `BLOCKSCOUT_API_KEY`, set by the user in their own environment, never in chat;
  its parameter name is verified against Blockscout's documentation before use.
- **Failures:** 429 and 5xx retried with back-off; 524, a timeout, a non-JSON body or a
  body with no `items` array is an **unread** wallet, never an empty one. A failure after
  some pages is **truncated**.
- **Parsing:** `total.value` through BigInt ÷ 10^`total.decimals`; a row whose decimals
  are not 6 or whose token is not USDT is dropped. **Zero-value transfers are dropped** —
  they move no money, and spoofed `transferFrom(victim, look-alike, 0)` events would
  otherwise count as outflows and recipients. `timestamp` ISO → ms.
- **Addresses:** every address the client emits is canonical **EIP-55**. Contract
  metadata for each counterparty is kept from the transfer rows it arrived in, which is
  what `contractInfo` answers from.

### 3.3 `lib/evm.ts`

Keccak-256 in TypeScript (no dependency), `toChecksumAddress`, `checkEvmAddress` (40 hex;
mixed case must match EIP-55, all-lower or all-upper carries no checksum and is accepted
as such), `isEvmTxHash` (`0x` + 64 hex). Tested against the Keccak-256 of the empty string
and the four EIP-55 examples in the EIP.

### 3.4 Health

`/api/health` keeps `chainAccess` (TRON) and gains `ethereumAccess`: `"keyed"` or
`"public"`, never the key.

---

## 4. Attribution — Indian exchanges first

### 4.1 Seeds — `data/eth/hot-wallets.json`

Each row: `address`, `exchange`, `tag` (the explorer text), `role`
(`"hot"` | `"deposit_funder"`), `source_url`, optional `note`. A seed is admitted only with
a public explorer tag that a person can open at `source_url`, and only after its inflows
have been looked at (§1.3 is why). Order: **CoinDCX** (CoinDCX 5 and its Deposit Funder 1),
**WazirX** (Deposit Funder 1), then Binance 14 and other major exchanges where a tag can
be cited. The Blockscout-tagged `0xee5B…047A` is excluded, with the reason in the file.

Labels: seeds are `exchange_hot`, `ground_truth`, confidence 1, evidence
`Explorer-tagged "<tag>"` (a funder's evidence adds "(gas wallet)").

### 4.2 Derivation — `scripts/cluster-eth.mjs`

Standalone like `cluster.mjs` (own fetch, no imports from `lib/`), same flags
(`--senders`, `--ratio`, `--sweeps`, `--from`, `--merge`), same checkpoint writes, same
§7 cap of **30 per seed**. Only transfers of **at least 1 USDT** count for anything, and
zero-value rows are dropped, so poisoning dust cannot make a deposit address.

- **Sweep route** — the TRON rule: ≥ 2 sweeps, and ≥ 90% of the sender's inflow forwarded
  to **that exchange's tagged wallets** (all of them, not one: §1.2 shows exchanges
  rotating wallets). Seed inflows are read from Blockscout; when it times out on a giant
  wallet, from the public node's `eth_getLogs` over the recent window (500-block chunks).
- **Funder route** (Ethereum only) — an address that received ETH from an exchange's
  tagged Deposit Funder, and sent ≥ 90% of its USDT inflow to one destination in ≥ 1
  sweep. Funder recipients come from `/addresses/{funder}/transactions?filter=from`
  (value > 0), capped at 30. This is what attributes WazirX, whose consolidation wallet
  has no tag.
- **Derived consolidation wallets** — a destination shared by at least 5 funder-route
  deposit addresses becomes a heuristic `exchange_hot` label ("Likely WazirX wallet"),
  so a trace that reaches it stops there instead of walking the exchange's bookkeeping.
- Rows: `address`, `exchange`, `route` (`"sweep"` | `"funder"`), `sweepCount`,
  `confidence`, `evidence`, `sweptTo`, `windowTruncated`. Confidence keeps the TRON
  formula, `min(0.5 + 0.03 × sweeps, 0.95)` — how much evidence was seen, not accuracy.
  Evidence states every signal, e.g. *"Gas-funded by 'WazirX: Deposit Funder 1'; 20
  sweeps, 100% of inflow to 0xf6fc…1a9c"*.
- A read where outflow exceeds inflow is partial and says so, as on TRON.
- The run prints its yield **per seed, zeros included**, and that is the Ethereum
  number. Back up `data/eth/deposit-addresses.json` before any run.

### 4.3 Sanctions

The EVM-format addresses already in `data/sanctions-multichain.json` (124, 48 entities,
Lazarus Group among them) become `sanctioned` labels, evidence *"OFAC SDN · <program> ·
filed under <asset>"*. A trace reaching one is COLD, as on TRON. No mixer list is added;
Tornado Cash was offered and declined.

### 4.4 One table

`lib/labels.ts` loads both chains into the one Map, same priority order. EVM keys are
stored lowercase and `lookup()` lowercases a `0x` input; TRON keys are unchanged. No call
site changes. `labelStats()` reports per chain.

### 4.5 The FIU-IND line

`data/fiu-ind.json` holds all 28 annexure rows (legal name, trade name as printed,
normalised exchange name), with the source title, URL, answer date and the date read.
`fiuListing(exchange)` returns a row or null. Where an exit's exchange is on it, the exit
card, the evidence packet and the freeze request say:

> CoinDCX is operated by **Neblio Technologies Private Limited**, listed as registered
> with FIU-IND in the Ministry of Finance's answer to Lok Sabha Unstarred Question 112,
> 4 December 2023.

The freeze request names that legal entity as the addressee. Absence from a 2023 list is
**never** stated as "not registered" — no line is shown instead. The line claims nothing
about what registration obliges an exchange to do. `/attribution` lists listed exchanges
first.

---

## 5. The tracer

- `runTrace` takes the chain from `checkAddress()` and creates the client for it; the root
  is canonicalised first. Every limit (3 hops, top 5, 1% dust, after the fraud date, stop
  at a label), both taint models, dwell, the causality rule, the unread and truncated
  rules and the risk rules are unchanged.
- **Stop at a contract (Ethereum).** When a wallet the money reached has
  `contractInfo().isContract` and is not a smart-contract wallet, the trace stops there
  without reading it. Smart-contract wallets are followed as wallets: verified name
  `GnosisSafeProxy` or `SafeProxy`, or an EIP-7702 delegated account (how Blockscout
  reports those is checked before relying on it). The label table is asked first, so a
  sanctioned or exchange contract keeps its label. Otherwise the node gets
  `{ kind: "contract", confidence: 1, source: "ground_truth" }` with:
  - a tag containing *Bridge* → entity is the tag name, reason *"left Ethereum through
    Polygon (Matic): ERC20 Bridge; the trail continues on another network, which this
    trace does not read"*;
  - a tag containing *DEX*, *Router*, *Pool* or *Swap* → *"entered Uniswap V3: Universal
    Router, a smart contract; USDT tracing ends where a contract pools the money or
    converts it to another asset"*;
  - anything else → entity *"Unlabelled smart contract"* (verified name in evidence when
    there is one).

  Without this rule a trace walks into a pool and follows it out to unrelated swappers,
  and can name one of them as the exit.
- **Disposition.** `decide()` checks, in order: mixer or sanctioned (COLD) → exchange
  (WARM) → money at rest (HOT) → **money that entered a contract (HOT, with the sentence
  above)** → still moving (HOT). A contract is not an exit: `terminal` stays null and no
  freeze request is offered.
- The narrative's "where it ended" sentence and the leads gain the contract case (one new
  lead: the trail left USDT or left Ethereum here, and what to open next — the contract
  interaction, or the destination network for a bridge).

---

## 6. The frozen contract — the two changes

`lib/types.ts` gains exactly two additive changes, recorded in its header with the date
and reason:

- `chain: "tron" | "ethereum"`
- `NodeKind` adds `"contract"`

Consequences, all required: `NODE_KINDS` in `lib/api.ts`; `normalizeTrace` passes `chain`
through (default `"tron"`) instead of forcing it; `KIND_COLOR` (`BubbleMap`) and
`KIND_STYLE` (`TraceGraph`) entries using existing tokens (no new colour — a contract is
not a finding); `kindTag` → "Smart contract"; `entityPhrase` for the new kind;
**`SHARED_INFRASTRUCTURE` in `lib/links.ts` adds `"contract"`** — two complaints that both
used Uniswap or a bridge are not linked. `freezable()` is unchanged (a contract is not
freezable).

---

## 7. Intake, screens and copy

- **One address check** (`lib/address.ts`): `checkAddress(raw)` → the chain and canonical
  address, or the reason it is invalid. It replaces the direct `checkTronAddress` calls
  in both trace routes, the wallet and watch routes, `lib/api.ts`, `BulkTriage`,
  `InvestigateForm`, `Navbar` (case scoping) and `WalletOrigin`. A mistyped TRON address
  is still never offered as another chain.
- **One chain table** (`lib/chain-meta.ts`): name, asset (*USDT TRC-20* / *USDT ERC-20*),
  explorer links (Tronscan / Etherscan, labelled "Open in block explorer"), and for
  Ethereum the network line: *"Ethereum mainnet · USDT ERC-20. The same 0x address on BNB
  Chain, Polygon or another EVM network is not read."* It replaces
  `tronscanAddressUrl` / `tronscanTxUrl` and the hard-coded TRON strings across the
  screens.
- `lib/chains.ts`: EVM becomes traceable (on Ethereum mainnet); every other chain is still
  screened, never traced.
- **New case:** a `0x` address runs a trace and shows the network line; a bad EIP-55
  checksum is refused the way a bad base58check is; the OFAC screen stays available. A
  `0x` + 64-hex hash is read on Ethereum (`/transactions/{hash}/token-transfers`) and
  shows the wallet it paid before tracing; a bare 64-hex hash is TRON, as today.
- **Batch triage:** both chains in one batch, still sequential.
- **Case file, packet, freeze request, wallet card, queue:** chain and asset from the
  table; the FIU-IND line where it applies; the wallet card and the watch run on the
  client for the address's chain. When the register holds more than one chain, each row
  carries a chain tag and the panel header names both.
- **Width:** a `0x` address is 42 characters. Prose that can carry one gets
  `wrap-anywhere`, and the width sweep includes an Ethereum case.
- `/attribution` gains an Ethereum section (seeds, derived addresses with route and
  evidence, counted from `data/eth`); `/operations` moves the "multiple blockchain
  ecosystems" and cross-chain rows to what is now true, with counts computed from the
  list; `/help` gains the Ethereum lines and still mirrors the navigation; the landing
  figures band gains the Ethereum count only once `data/eth` holds one; `README.md` gains
  Ethereum `curl` examples run against a server first; `CONTEXT.md` gains a §10 record.
- No screen names a data provider.

---

## 8. Recorded cases, demo mode, verification

- **Three real Ethereum cases** join `data/demo-cases.json` (`chain: "ethereum"`): WARM at
  an Indian exchange (a CoinDCX or WazirX derived deposit address), COLD at an OFAC-listed
  EVM address, HOT with funds at rest. `freeze-cases.mjs` gains `--chain ethereum`,
  draws candidates from the committed Ethereum data, and keeps a case only when the
  pipeline independently reaches the wanted disposition with no unread wallet on the
  path. They are chosen by script and are never described as victim reports or fraud
  proceeds.
- `lib/demo.ts` matches EVM addresses in canonical form; `answersFor` is unchanged.
  `make-mocks.mjs` derives register rows for them. `rescore-cases.mjs` re-derives them
  as of capture like the TRON cases.
- **`verify-case.mjs`** gains an Ethereum path that re-reads each transaction from a raw
  Ethereum node (`eth_getTransactionReceipt`, Transfer logs decoded) — a different
  provider from the one that traced it. The four verdicts are unchanged; a node that has
  pruned an old transaction index answers UNREADABLE, not MISSING.

---

## 9. How it is checked

- `node --test` (Node 24, no new dependency): Keccak-256 and EIP-55 vectors, address
  checks, the Blockscout row parser (zero-value dropped, decimals, canonical case),
  contract classification, `fiuListing`.
- **TRON regression gate:** the ten recorded TRON cases, re-derived as of capture with
  demo mode off, match the committed file — disposition, exit, taint, every node, edge,
  flag and sentence. The one allowed difference is the sanctions program string from the
  24 Sep refresh ("FTO" → "FTO, SDGT"), already on record.
- **Ethereum:** each recorded case traced live and as of capture (identical), and
  confirmed by `verify-case.mjs`.
- `npx tsc --noEmit`, `npx eslint .`, `npm run build` clean; functional checks on a
  production build with `DEMO_MODE=true`; no sideways scroll at 375 / 784 / 1100 / 1600 on
  every route, with an Ethereum case among them; no console errors.

**Done when:** a `0x` address traces end to end and a WARM Ethereum case names a CoinDCX or
WazirX customer deposit address with its evidence and the FIU-IND line; the clustering
number is reported per seed; the three Ethereum cases replay in demo mode; the TRON gate
passes; everything is committed on `feat/ethereum` and nothing is pushed.

---

## 10. Risks, and what is checked during the build

- Blockscout's keyless limit was measured once and can change → optional key; demo mode.
- A giant unlabelled wallet times out → reported unread, as the rules require.
- The public node's log window is about a day → giant seeds are sampled from recent
  inflows only; the yield depends on the day the script runs, and the run records it.
- Explorer tags can mislead (§1.3) → every seed's inflows are looked at before it is
  admitted.
- The WazirX Safe `0x27fD…C9b4` was the wallet drained in July 2024 → not a seed.
- How Blockscout reports an EIP-7702 account, and its key parameter → verified before use.
- A public node may have pruned the index for an old transaction → UNREADABLE.
- Tether can freeze and destroy a blacklisted address's USDT without a Transfer event, on
  both chains → a frozen balance can read as "at rest"; not handled here, noted for later.
- The FIU-IND list is a December 2023 snapshot → always shown with its date.

## 11. Out of scope

BNB Chain, Polygon, Arbitrum and other EVM networks; USDC and other tokens; following ETH
itself (the funder route only reads gas payments); decoding a bridge's destination
address; Tornado Cash labels (declined); machine learning or a language model; Etherscan
as a data source; any change to `main`, Render or the deck; any push. The TRON client's
own handling of zero-value transfers is a separate follow-up, so TRON's recorded cases do
not move in this work.
