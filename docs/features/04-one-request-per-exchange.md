# One freeze request per exchange

## What it does

When two or more complaints in a batch end at the same exchange, FineX drafts
**one** restraint-and-preservation request to that exchange covering all of
them, instead of one letter per complaint. The exchange gets one document it can
act on; the officer signs one document instead of many.

The combined request lists:

1. **Accounts to be restricted** — every deposit address or exchange wallet the
   complaints reached, with the chain, the USDT traced to it, and the
   complaints (by NCRP acknowledgement number when the batch came from a
   complaint sheet).
2. **Basis for the identification** — attribution, confidence, source tier and
   evidence for each account, with the heuristic caveat where it applies.
3. **The reported frauds** — one row per complaint: acknowledgement number,
   case reference, reported wallet, amount reported, date, USDT that reached the
   exchange.
4. **Transfers into the named accounts** — every incoming transfer with its
   date, amount, sender and transaction hash.
5. **What is requested**, **Verification** and **Issued by** — the same wording
   and the same rules as the single request: it is a draft for an authorised
   officer to complete and sign, and it asserts no legal basis.

The FIU-IND line appears under the addressee when the exchange is listed.

It is not a new kind of finding. Each complaint travels in the link as the
exact run it came from (address, amount, window, the moment it was read,
acknowledgement number), and the page re-opens every case through the same
permalink route. So the letter shows exactly the figures each complaint showed,
on any later day. A case that no longer ends at that exchange is left out and
listed as "Not listed" with the reason — never included on its say-so.

## How to use it

1. Run a batch in **Batch triage** (`/queue`) — a pasted list, a complaint
   sheet, or **Load the recorded cases**.
2. If two or more complaints ended at the same exchange, a panel **One request
   per exchange** appears with the exchange, the number of complaints and
   accounts, and the USDT. A single complaint at an exchange already has its
   own request, so it is not offered twice.
3. Press **Combined request**, check it, then **Print / save as PDF**.

Link form, for integration: `/freeze/exchange?x=<exchange>&c=<case>&c=<case>…`,
where each `c` is `address~amount~since~asof~ack` (fields may be empty).
Anything malformed is dropped.

## Verified

Unit tests (`tests/combined.test.mjs`): only exchanges reached by two or more
complaints are grouped; the link round-trips every pinned field; malformed
input is dropped. End to end on the recorded cases (13 of 13, 13 checks):
MEXC is offered with 3 complaints and 1 account; Bybit (one complaint) is not;
the letter names `TX1so33jdGd8JkYD7JVB6q1i4QUDhPB2MN`, lists 27,930.21 USDT
across the three complaints — the same figure the linked-complaints panel
shows — carries the draft guard, lists every complaint and transfer, has no
sideways scroll at 375 px, and leaves out a case that ends at Bybit with the
reason. No console errors.

## Limits

- Grouped by exchange name. Two complaints ending at different wallets of the
  same exchange appear as two accounts in one letter, which is what the
  exchange needs.
- Only complaints in one batch are combined; there is no case database to
  combine across days.
