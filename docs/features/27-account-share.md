# Whose other money is in this account

## What it does

A freeze request asks an exchange to restrict one customer's account. If the money
traced from this case is a small share of what that account received, most of what
would be restricted is somebody else's, and the request should say so before
defence counsel does. Above a freeze request that names a **customer deposit
address**, the officer now sees **Whose other money is in this account**: how much
of the account's inflow this case is.

- **It is measured from the account's own history.** When the request opens, one
  read of `GET /api/wallet/<account>` (`?chain=polygon` on Polygon) profiles the
  account. `WalletProfile` gained `payers`: how many distinct addresses paid into it
  over the history read.
- **`accountShare()` in `lib/proportion.ts`** divides the USDT traced to the account
  by what the account received. Three answers, as everywhere in this tool:

  | State | When | Says |
  | --- | --- | --- |
  | Share | The history was read in full | "The account received 30,003 USDT from 1 payer; the money traced from this case is 1.7% of that." and one of three bands |
  | Upper bound | The history was read in part (paging limit, or outflows that exceed inflows) | "The account received at least X USDT … so the money traced from this case is at most P% of its inflow." No band |
  | Nothing | The read failed; or it received nothing; or more was traced into it than it is read as receiving, which proves the read short | "Not checked" or "Not computed", with the reason |

- **The bands describe the proportion and decide nothing.** At 50% or more, "Most of
  what it received is traced from this case." From 10% to under 50%, "This case is
  part of what it received; much of the rest came from elsewhere." Under 10%, "Most
  of what it received is not from this case." Percentages under 10% carry one
  decimal.
- **The screen adds** (whenever a figure is shown) that the history is "as read" at a
  stated time and can include money that arrived after the trace was read, and that
  the request asks the exchange to restrict and review the account, not that
  everything in it is proceeds of this case.
- **Screen only.** It never prints: the letter asks to restrict and review.
- **Only for a customer deposit address**, which is one account. Not for an exchange
  hot wallet, which is everyone's, and not on the combined request or the request to
  Tether.

## How to use it

Open a freeze request whose exit is a customer deposit address, for example the
recorded Bybit case `TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ`. The line sits between the
sending guide and the letter.

## Verified

- **Unit tests, `tests/proportion.test.mjs` (3):**
  - 1,131.72 USDT against an account that received 18,240 from 41 payers reads
    "6.2% of that. Most of what it received is not from this case." and "from 41
    payers";
  - a partial history gives "at least 1,000 USDT" and "at most 50%", never a share;
  - an unread account, and a read that proves itself short, compute nothing.
- **Live, on `TJjc21…`** (its exit is a Bybit deposit address): "received 30,003 USDT
  from 1 payer; … 1.7% of that". The account is read now while the trace is as of
  14 Sep, so the line states the read time.

## Limits

- **The account is read now; the trace is as of its capture.** The share can include
  money that arrived later, and the line says so.
- **The traced amount is what the run was given.** That is the amount the complaint
  reported or, when none was, everything that left the reported wallet. On a
  reported address that is itself a deposit address (note 23) with no amount
  reported, that is the account's own sweeps, so no share is computed: the request
  says the share cannot be stated and asks for the amount paid.
- **A partial read only bounds the share.** The history cap and the sanity check
  (outflows cannot exceed inflows) decide when it is partial.
- **It is a proportion, not ownership.** A derived deposit address is still
  heuristic; only the exchange can confirm whose account it is.
- **One more chain read** when the request opens.
