# Address-poisoning warning

## What it does

The wallet card flags the two sides of an address-poisoning theft, counted from
the wallet's own history — no extra request, no model, no score:

- **Spray — this wallet poisons others.** It sent under 1 USDT to many
  different wallets (shown from 5). That is how a poisoner plants a look-alike
  of a real address in other people's histories; money a victim sent here was
  most likely copied from one of those planted entries.
- **Look-alikes — this wallet was targeted.** Dust (under 1 USDT) arrived from
  addresses that share the first and last four characters of an address this
  wallet really moves money with (at least 1 USDT). Each pair is listed **in
  full**, because the ends are identical by design and only the middle shows
  the difference.

The section appears only when a signal fires. It is a pattern to know about,
not a verdict, and says so.

## How to use it

Open any wallet card — press the origin icon on any address in the app, or go
to `/wallet/<address>`. If the wallet shows either pattern, an **Address
poisoning** section appears under its figures.

The data is also in the API: `GET /api/wallet/<address>` returns
`poisoning.spray` (`transfers`, `recipients`) and `poisoning.lookalikes`
(`lookalike`, `imitates`, `transfers`).

## Verified

Unit tests (`tests/poisoning.test.mjs`): a look-alike of a real counterparty is
flagged; dust from an unrelated address or from the real counterparty is not;
the spray counts distinct recipients; TRON look-alikes compare case-sensitively.

On real wallets, 25 Sep 2026:

- `0xee5B5B923fFcE93A870B3104b7CA09c3db80047A` — 4 look-alikes of its real
  counterparty `0xf89d7b…aA40` (found in research on 24 Sep).
- `0xF89db5152Aa96Cb0f8BfCC5cc1bE6F622B5Eaa40`, one of those look-alikes —
  sprayed 500 dust transfers to 321 wallets in the 1,000 transfers read.
- `0x16a8D032ffe880535CD3e1815fe917e96A0715dd`, the recorded COLD case's
  wallet — 2 look-alikes of the OFAC-listed address it had paid.
- No signal on the recorded CoinDCX case's wallets or on `TJjc21br…`.

Shown on the wallet card with no sideways scroll at 1280 or 375 px and no
console errors.

## Limits

- Counts cover the transfers read; a wallet with more history than one pass
  reads (marked "Partial history") may have more.
- Zero-value spoofs are dropped by the chain clients (see 05), so a poisoning
  attempt made only of zero-value transfers does not show here.
- Four characters at each end is the common attack; a poisoner who matches
  fewer is not caught.
