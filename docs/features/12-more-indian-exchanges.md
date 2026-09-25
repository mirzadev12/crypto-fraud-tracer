# More Indian exchanges: CoinSwitch

## What it does

Adds **CoinSwitch** (operated by Bitcipher Labs LLP, on the FIU-IND list of
4 Dec 2023) as the third Indian exchange FineX can name on Ethereum, after
CoinDCX and WazirX. It adds 28 CoinSwitch customer deposit addresses. A trace
that ends at one names it as a likely CoinSwitch deposit address, prints the
FIU-IND line, and drafts the freeze request to CoinSwitch.

**How it was found.** The explorer names one wallet "CoinSwitch Binance
Deposit 1". Its transfer rows are tagged as a Binance deposit address, so it is
CoinSwitch's own account at Binance. From April to June 2021, addresses that
each received USDT from 20–25 unrelated payers forwarded all of it there, one
sweep per deposit. That is the customer-deposit pattern, and the unchanged
sweep rule (at least 2 sweeps, at least 90% forwarded) found 28 of the first 30
senders.

- **The account itself is labelled as what it is:** a Binance customer deposit
  address held by CoinSwitch (seed field `heldAt`). A trace that reaches it
  directly names Binance, and the evidence names CoinSwitch as the account
  holder. It is not labelled "CoinSwitch", because it is not CoinSwitch's wallet.
- **The rows describe CoinSwitch as it was in 2021.** No CoinSwitch-tagged
  wallet has moved USDT since mid-2021, and its current deposit addresses are
  not publicly tagged. The seed's note says this. The attribution page shows it
  in a **Note** under each seed (every seed's recorded caveat is now shown
  there, not only kept in the data file) and in the Ethereum method text.

**What else was looked for, and not found** (explorer search on Ethereum and
Polygon, 25 Sep 2026):
- **ZebPay, Giottus:** no tag at all.
- **Mudrex, Unocoin:** tags on their token contracts only, no exchange wallet.
- **Bitbns:** a token deployer that moved USDT once in and once out.

None of these is an exchange wallet. Nothing was invented to fill the gap.

**BNB Chain (#10) is blocked, and was checked, not assumed.** There is no
keyless source for BNB Smart Chain history:
- Blockscout has no BSC instance (404).
- Routescan answers "chain not supported".
- Etherscan's free tier answers "Free API access is not supported for this
  chain".
- Ankr's multichain API refuses without a key (403).

It needs a paid key, which the user sets, never this repository.

## How to use it

Nothing to do. CoinSwitch appears wherever attribution does:
- `/attribution`: the seeds table (with the FIU-IND mark, "Its account at
  Binance" and the Note), the derived register (filter by CoinSwitch), the
  calibration panel.
- Traces, packets and freeze requests.

The landing page and `/operations` now **count** the Indian exchanges from the
data through the FIU-IND list ("CoinDCX, WazirX and CoinSwitch among them")
instead of typing two names, so the next one added appears on its own.

To add another Indian exchange later: add its tagged wallet to
`data/eth/hot-wallets.json` with a `source_url` and a `note` saying what the tag
does and does not establish. Then run:

```bash
node scripts/cluster-eth.mjs --from <its index> --merge
```

Back up `data/eth/deposit-addresses.json` first.

## Verified

- Each candidate was read from the chain before admission:
  - **CoinSwitch 1** (`0xd0808Da0…`) is an externally owned wallet. It
    received from Binance hot wallets and paid out to 22 wallets; last USDT
    9 May 2021.
  - **CoinSwitch Binance Deposit 1** (`0x986C…`) received from 46 senders and
    swept to Binance 14; last USDT 27 Jun 2021.
- 7 of 8 sampled senders into the account are deposit-shaped: 20–25 payers
  each, about 100% forwarded. One had its gas paid by the CoinSwitch-tagged
  wallet, and all seven share one untagged gas payer (`0xEB713f…`).
- The derivation, `cluster-eth.mjs --from 11 --merge`: 28 of 30 senders, no
  other row touched. It now reads 221 across 9 exchanges, 80 of them at
  FIU-IND-listed exchanges.
- Labels, read through `lib/labels.ts`:
  - `0x986C…` → Binance, customer deposit address, ground truth, evidence
    naming CoinSwitch as the holder;
  - `0xd0808Da0…` → CoinSwitch, exchange hot wallet;
  - the FIU-IND sentence resolves to "Bitcipher Labs LLP".
- The re-test and gas-payer check (08) over all 221 rows:
  - CoinSwitch's 28 all still meet the rule, but none has swept since 2021,
    so that shows only that nothing reversed.
  - Gas payer: 2 agree (gas paid by the CoinSwitch-tagged wallet), 0 conflict,
    26 no signal (gas from one untagged wallet).
  - No other exchange's figures moved.
- A live trace of a 2021 payer into one of these addresses
  (`0x4910Af8C…`, window from 60 s before its payment) came back WARM:
  - it reads "2,620 USDT reached a likely CoinSwitch customer deposit address;
    a freeze request naming that address is viable";
  - the case file prints the FIU-IND line for Bitcipher Labs LLP.
- The three recorded Ethereum cases, re-derived from the chain under the new
  labels, give the same fingerprints (see 07).
- `/attribution` at 375 px with all 16 seed notes open: no sideways scroll.

**Found and fixed on the way.** `cluster-eth.mjs` gave up on the first
explorer timeout. It treated the failure as "no inflows" and fell back to the
node's recent window, so the first run silently yielded **zero** CoinSwitch
rows. A timeout is now retried like a throttle, and a failed read is printed as
one.

## Limits

- **2021 only.** A current CoinSwitch case will not reach these rows. They
  matter for older complaints, and as proof that the method reaches Indian
  exchanges an explorer barely tags.
- The account at Binance is where CoinSwitch *swept* customer deposits. A
  restraint request for money that went on from there is Binance's to act on,
  and the label says so.
- No ZebPay, Mudrex, Giottus, Bitbns or Unocoin wallet is publicly tagged on
  Ethereum; they stay unnamed until one is sourced.
