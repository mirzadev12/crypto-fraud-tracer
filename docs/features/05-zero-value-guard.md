# Zero-value transfer guard

## What it does

Ignores USDT transfers of **zero** value on both chains. They move nothing,
and anyone can emit one "from" any address — the address-poisoning trick of
calling `transferFrom(victim, look-alike, 0)`. Counted, such a spoof would:

- pose as an outflow the wallet never made, inflating the fan-out and
  peel-chain rules;
- stop a wallet that still holds the money from being recognised as at rest
  (hiding a CRITICAL finding);
- make the watch report a move that never happened.

The Ethereum client dropped them from the start; this adds the same guard to
the TRON client (`lib/trongrid.ts`), so traces, the wallet card and the watch
all ignore them, and to the TRON clustering and calibration scripts so a
spoofed "sweep" cannot count towards a deposit address in future runs.

## How to use it

Nothing to do — it applies to every read.

## Why now

Measured on 25 Sep 2026: TronGrid returned three zero-value "outflows" from
`TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ` and one from
`TTQd8Bo1nhKEVgkKJVP3SRYZ1nDNStckvj`, both wallets in recorded cases. In both,
the spoofs predate the fraud window, so neither case was affected.

## Verified

The TRON regression gate — every recorded TRON case re-derived as of capture
through the changed client — came back **10 of 10 identical**: disposition,
exit, taint, every node, edge, flag and sentence.

## Limits

- `data/deposit-addresses.json` (TRON, 241 rows) was derived before this guard.
  The next `node scripts/cluster.mjs` run applies it; until then the committed
  rows stand as derived. A zero-value spoof could only have added a sweep to a
  row that already met the rule on real transfers, since the 90% test counts
  value, and zero adds none.
- Dust (tiny but non-zero) transfers are real and still counted; the 1% trace
  threshold already keeps them out of the followed path, and the wallet card
  reports them as a poisoning signal (see 06).
