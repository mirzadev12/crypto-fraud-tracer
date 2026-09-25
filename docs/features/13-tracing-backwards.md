# Tracing backwards: payers, one hop back

## What it does

The trace follows money forward from the reported wallet. This looks the other
way. For any wallet, it lists who paid it and **where each payer's own USDT came
from**, and it names the exchanges among those sources.

That answers the question an officer asks next: *which exchange can identify
the people who paid this wallet?* USDT an exchange sends out is a withdrawal by
one of its customers. So when a payer was funded straight from an exchange's
wallet, or an exchange wallet paid in itself, that exchange can say from its
own records who made the withdrawal. When the exchange is Indian, that is a
domestic request.

It is not redundant with the wallet card's **Funded by** list. That list stops
at the payers; this reads one hop further back, to what funded them.

**How it reads:**
- **Payers.** Every wallet that paid in 1 USDT or more (dust is excluded, as
  everywhere), largest first.
- **Funding.** For the largest twenty, the payer's history is read **as of its
  last payment in**. The newest transfers of that read are the money it had
  just then, however long its history is. Its three largest sources are kept.
  On Ethereum the read seeks straight to the block of that payment.
- **Exchanges.** A source is named from the attribution register, or on
  Ethereum from the explorer's own tags, shown verbatim and marked "explorer
  tag". An exchange is credited once per payer, and the register outranks a
  tag.
- **Honest states.** Each payer carries one of:
  - `read` (with its sources);
  - `labelled`: it is itself an exchange wallet, which is the answer;
  - `contract`: not followed;
  - `unreadable`: the chain did not answer, so its funding is not stated;
  - `skipped`: beyond the twenty.
- **Payers, never victims.** A payer can be a victim, an accomplice or a
  stranger. The chain shows where their money came from, not who they are.

## How to use it

- **On screen:** open any wallet card (the origin icon next to any address, or
  `/wallet/<address>`) and press **Trace the payers back**, below "Funded by".
  It takes up to a minute (a chain read per payer), so it runs only when asked.
- **API:** `GET /api/payers/<address>` returns `PayersTrace`. The README has
  the example.

## Verified

- **The CoinSwitch deposit address `0x57DbDbBF…`** (Ethereum, 2021):
  - 25 payers paid 24,818.26 USDT; the largest 20 were read back, and one
    could not be read and is shown as such.
  - The exchanges that funded them: **Binance 11, HitBTC 6, CoinSwitch 2**
    (the register), Kraken 1 and Bittrex 1, the rest by explorer tag.
  - With a deeper read, one payer's sources also included "WazirX:
    Withdrawals".
- **The recorded case wallet `TXq2kpXz…`** (TRON): one payer. Read as of its
  payment, its three largest sources came back (the first read, from the head
  of its long history, had found none). No exchange is named: TRON transfer
  rows carry no explorer tags, and the register names none of the three. The
  screen says exactly that.
- **Speed:** twenty Ethereum payers first took 157 s and 343 calls. Reading
  each payer only as far as its payment, from the payment's own block, brought
  it to **42 s and 24 calls** with the same exchanges found.
- **No change to anything else.** The chain clients gained two optional,
  additive inputs (a page limit, and on Ethereum the block to read from), and
  transfers carry their block. The recorded cases re-derived from the chain
  give the same fingerprints: the three Ethereum cases and a TRON case (07's
  gate).
- **Unit tests** (`tests/payers.test.mjs`):
  - payers grouped, dust and self-transfers excluded, the last payment's block
    kept;
  - sources limited to before the payment;
  - explorer tags name an exchange only when filed under "Exchange";
  - an exchange is credited once per payer, the register outranking a tag.
- **End to end, 12 of 12** on a production build (demo off, live chain):
  - the section waits to be asked;
  - Ethereum: payers counted and read back, Binance, HitBTC and CoinSwitch
    named, explorer-tag names marked, CoinSwitch with its FIU-IND mark, a
    funding line per payer;
  - no payer is called a victim;
  - no sideways scroll at 375 px;
  - TRON: the payer read as of its payment, and the reason no exchange is
    named;
  - no console errors.

## Limits

- **One hop.** A payer funded by an unlabelled wallet that was itself funded
  by an exchange is not traced further.
- **TRON:** only the attribution register names sources, so many exchange
  wallets there stay unnamed.
- **Ethereum:** explorer tags are community and explorer labels, not vetted
  by FineX. They are marked as such, and never become attribution.
- A payer's sources are its **largest three** in the transfers read just
  before it paid: 100 on Ethereum, 400 on TRON. A busy payer's older funding
  is not counted, and the payer is marked "older ones were not read".
- Reads the chain now. In demo mode there is no recorded version, so offline
  it fails and says so.
