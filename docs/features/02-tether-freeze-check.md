# Tether freeze check

## What it does

Reads, from the USDT contract itself, whether Tether — the issuer of USDT —
has frozen an address. A frozen address cannot move its USDT at all, whatever
wallet holds it.

Why it matters: money found at rest in a private wallet has no exchange to
write to. The issuer is the one party that can still stop it, so an officer
needs to know at once whether it already has — and, if not, that this route
exists.

It answers on both chains:

- **TRON** — `isBlackListed(address)` on the USDT TRC-20 contract, through
  TronGrid (`/wallet/triggerconstantcontract`).
- **Ethereum** — `isBlackListed(address)` on the USDT ERC-20 contract, through
  a public Ethereum node (`eth_call`; several nodes are tried in turn).

Three answers, never two: **frozen**, **not frozen**, or **not checked** when
the chain did not answer. It never guesses. Each answer carries the time it
was read and a SHA-256 of the request and response together.

## How to use it

- **Case file.** When the money is at rest in a wallet (a CRITICAL case), the
  "Where the money is now" card shows an **Issuer freeze** line under the
  resting wallet: frozen by Tether, not frozen (with the time checked), or not
  checked.
- **Wallet card** (`/wallet/<address>`) shows the same line for any wallet.
- **API:**

  ```bash
  curl http://localhost:3000/api/issuer/TLWnXEm6SNohB23udP4mMsX4LLd7ab9VYs
  ```

  returns `status` (`frozen` / `not-frozen` / `unchecked`), `chain`,
  `checkedAt`, `responseHash` and a `note`. A malformed address returns 400.

## Verified

On 25 Sep 2026, against addresses the contract's own `AddedBlackList` events
had just named: `frozen` for `0x7108…e539` (Ethereum) and
`TLWnXEm6SNohB23udP4mMsX4LLd7ab9VYs` (TRON); `not-frozen` for Binance 14 and
Binance-Hot 7; 400 for a malformed address. Shown on the case file of the
recorded CRITICAL Ethereum case and on the wallet card of the frozen TRON
address.

## Limits

- It is the chain **now**, not as of a recorded case's capture — the line says
  when it was checked.
- It reads the freeze; it does not request one. Whether and when the issuer
  acts on a request is for the issuer.
- A demo with no network shows "not checked", as it should.
