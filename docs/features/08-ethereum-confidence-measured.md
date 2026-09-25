# Ethereum attributions, measured

## What it does

`scripts/calibrate-clustering-eth.mjs` puts two questions to every derived
Ethereum deposit address (221 on 25 Sep: the whole set, not a sample). The answers
are shown on `/attribution` under the Ethereum register, and a contradicted row
carries a warning wherever its name is printed.

1. **Does the rule that found it still hold?** Each address is re-read from the
   chain and re-tested with the rule that found it:
   - sweep route: at least 2 sweeps forwarding at least 90% of its USDT to the
     exchange's tagged wallets;
   - gas-funded route: at least 1 sweep forwarding at least 90% to the wallet
     it was found sweeping to;
   - both routes: either rule holding counts.

   This is the TRON measurement (`calibrate-clustering.mjs`), applied to
   Ethereum.
2. **Who paid its gas?** This is new and has no TRON equivalent. An Ethereum
   deposit address can't move its USDT without ETH for gas, and exchanges send
   that ETH from wallets the explorer tags. For each address found by the
   sweep rule alone, the ETH senders are read with their tags. The verdict is
   one of three:
   - **agrees**: a sender is tagged as the same exchange. This is a second
     behaviour, independent of the sweeps. A wallet that merely settles to an
     exchange sends it money, but doesn't get its gas from it.
   - **conflicts**: none is, but one is tagged as another entity's gas, fee,
     funder or custody wallet. Someone else may manage the address. That is
     the method's known failure (a custodied or merchant wallet that settles to
     one exchange looks like a customer deposit address).
   - **no signal**: neither.

   Addresses found through an exchange's own gas wallet are left out of this
   test: that wallet is how they were found, so it can't confirm them.

A contradicted row **stays in the register**: its sweeps are real. Its
evidence (`lib/labels.ts`) now ends with a caution naming the gas payer. The
packet's "Basis for attribution" and the freeze requests print that evidence,
so an officer sees the doubt before sending a request.

## How to use it

- **Read it:** `/attribution` → below the Ethereum register, the panel
  **Ethereum · Does an attribution hold when read again?** It shows the re-test,
  a note on how soon after the derivation it was read, the bands and routes, and
  **Independent check · who paid the gas**, with each conflict listed in full.
- **Re-measure it** (no key needed, about 8 minutes, then commit the file it
  writes):

  ```bash
  node scripts/calibrate-clustering-eth.mjs
  ```

  It writes `data/eth/clustering-calibration.json`. It takes the derivation time
  from the git commit that last wrote `data/eth/deposit-addresses.json`, and the
  panel states the gap. **Re-run it a few weeks before the finale.** A re-read
  weeks after the derivation is a real persistence test; this one was not (see
  below).

## Measured, 25 Sep 2026

**Re-test.** 221 of 221 readable, and all 221 still hold, in every band, route
and exchange. **This is weak evidence, and the panel says why.** Each re-read
came within a day of its derivation: about 15 hours for the first 193 rows, and
minutes for CoinSwitch's 28, which have been dormant since 2021. Almost every
row was therefore re-tested on the transfers that found it. The real test is
the 21 that swept again since, and all 21 held.

**Gas payer**, 169 addresses found by the sweep rule alone:

| Exchange | Agrees | Conflicts | Tested |
| --- | --- | --- | --- |
| Binance | 21 | 0 | 24 |
| MEXC | 17 | 0 | 17 |
| Gate.io | 23 | 0 | 23 |
| Bitget | 24 | 0 | 25 |
| Bitfinex | 17 | 0 | 25 |
| Coinbase | 1 | 1 | 27 |
| CoinSwitch | 2 | 0 | 28 |
| **All** | **105** | **1** | **169** |

63 had no tagged payer either way, so the check says nothing about them in
either direction. That includes 25 of Coinbase's 27 and 26 of CoinSwitch's 28:
CoinSwitch's gas came from one untagged wallet, and from its own tagged wallet
for the other two.

**The one conflict** is `0xe66EA309d38bC71dE6D82924D5f11afa1B95ec35`. It was
derived as a Coinbase deposit address from 52 sweeps with 100% forwarded, at
confidence **0.95**, the top band. Its gas came from **Cobo: Custody 1**, a
custody provider's wallet. It is the clearest evidence so far that the
confidence figure counts sweep evidence and says nothing about who manages an
address. It is on the panel, and its label now carries the caution.

## Verified

- The script ran three times against the live chain:
  - twice over the first 193 rows, with the same re-test result both times
    (193 of 193, 16 continued); the second run added the gas-payer test
    (103 agree, 1 conflict, 37 no signal of 141);
  - once over all 221 after CoinSwitch was added (see 12). Those are the
    figures above, and the committed file.
- The label for `0xe66EA309…` reads from the lookup with the caution appended
  (checked directly through `lib/labels.ts`). Other rows are unchanged.
- The fingerprint doesn't cover evidence strings (see 07), and no recorded case
  touches that address, so every recorded case is unchanged.
- The panel renders on `/attribution` with the gap sentence, bands, routes,
  agreement by exchange and the conflict. tsc and eslint are clean.

## Limits

- **No ground truth.** Only an exchange can confirm whose account an address
  is. Both tests read public data: the first shows the pattern persists, the
  second that a second behaviour agrees.
- Explorer tags are community and explorer labels of varying reliability. The
  agreement test trusts the tag on the gas payer as much as the derivation
  trusts the tag on the seed.
- It reads the first 100 incoming transactions per address. A payer outside
  that window isn't seen, and counts as "no signal".
- Confidence still doesn't order the rows: every band re-tested at 100%. Read it
  as "how much sweep evidence was seen", never as accuracy.
