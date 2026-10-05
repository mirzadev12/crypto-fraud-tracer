# TRON swaps stop the trace

## What it does

Money that enters a SunSwap pool or one of SUN.io's routers on TRON stops the
trace there, named, as a recognised DEX already does on Ethereum and Polygon:
past a pool, USDT stops being traceable as USDT. The disposition is CRITICAL
with the sentence "… USDT entered SunSwap V2 USDT/TRX pool, a smart contract;
USDT tracing ends where a contract pools the money or converts it to another
asset", unless a wallet still holds money or an exchange was reached, which
take priority as before.

## Where the list comes from

`data/tron-contracts.json`, 25 contracts, read 5 Oct 2026:

- Routers (V2, V3, Smart Router, deprecated ones) and the stable pools that hold
  USDT, copied from SUN.io's own list (`sun-protocol/transactionAnalysis` on
  GitHub, linked from docs.sun.io), and the Universal Router from its docs page.
- The USDT/TRX pools (V2, and V3 at 0.05%, 0.3% and 1%), read on chain from
  SunSwap's own factories: WTRX from the V2 router's `WETH()`, then
  `getPair` / `getPool`. The 0.01% tier returned the zero address and is not listed.
- Left out: factories, the V3 position manager, and the list's example token,
  which is the USDT contract itself.

A label tier below exchanges and sanctions (`lib/labels.ts`, 3c), so it can
never displace an attribution.

## Verified

- `tests/tron-contracts.test.mjs`: a pool is a DeFi contract stop; the USDT
  contract is not labelled; no recorded case passes through any listed address,
  so none changes.
- Live probe, 5 Oct 2026: `TScAuTVYrbSVK457SRgcae1EhR39jtGu73`, which paid 1,750 USDT
  into the V2 USDT/TRX pool, traced with the pool labelled and stopped there.

## Limits

Not a complete list of TRON DeFi. Another contract — a TRON bridge included —
is still read as an ordinary wallet, and `/operations`, Help and the README say so.
