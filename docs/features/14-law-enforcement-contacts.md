# Where to send it: exchange law-enforcement contacts

## What it does

The freeze request drafts the letter. This says **where to send it, and what that
exchange requires before it will act**. It appears above every freeze request
and every combined request as a panel, **How to send this request to
\<exchange\>**:

- the exchange's own channel (portal, email or form), as a link;
- the conditions its published page states;
- the page it came from, and the date it was read.

It is screen-only and never prints: the letter goes to the exchange, which
doesn't need to be told its own portal.

`data/le-contacts.json` covers **all 17 exchanges FineX can name**. Every entry
was copied from the exchange's **own** page on 25 Sep 2026. Nothing was taken
from a third party or inferred.

| Exchange | Channel |
| --- | --- |
| CoinDCX | legal@coindcx.com ("Regulatory issues / enforcement authorities") |
| WazirX | legal@wazirx.com |
| CoinSwitch | Nodal Desk, nodaldesk@coinswitch.co (gov.in / nic.in senders only), and a postal address |
| Binance, Bitget, Bitfinex, OKX, Coinbase | a Kodex law-enforcement portal |
| KuCoin | its Information Request System |
| MEXC | its Law Enforcement Online Request System |
| Gate.io | regulatory@gate.com |
| Flipster | enforcement@flipster.io |
| Kraken | its compliance and legal inquiry form |
| Bybit | its Report Stolen Funds form (it publishes no officer portal) |
| **Not found** | FixedFloat (its site gave this tool no readable page), Swapster (policies only as PDF files, not read), UEEx (no channel on its own site) |

The not-found entries **say so**, with the reason, and the panel tells the
officer to find the channel on the exchange's own site.

**What the pages turned up that changes a request:**
- **MEXC:** a freezing order must state its duration. MEXC freezes for at most
  30 days unless the order says otherwise, and lifts the restriction if none is
  given. Access to its system takes 15 to 20 business days to approve.
- **Gate.io and Bitfinex** also require the duration of a freeze.
- **KuCoin** does not accept a digital signature or seal.
- **WazirX and MEXC** may tell the user before disclosing their data, unless
  the order says otherwise.
- **Flipster** does not answer informal cross-border requests: they go through
  a mutual legal assistance treaty or another recognised channel where the law
  requires it.

So **both freeze requests gained a blank, "Duration of the restriction"**, for
the officer to set. The tool still asserts no legal basis and prints no
statute.

## How to use it

Open a freeze request from a case (**Freeze request**), or a combined one from
batch triage. The panel sits above the letter. Use its link, meet its
conditions, and check the source page first, because exchanges change these
channels.

To add or update an exchange, edit `data/le-contacts.json` from the exchange's
own page, with `source` and `checked`. The test in `tests/le-contacts.test.mjs`
fails if any exchange in the attribution data has no entry.

## Verified

- Each page was read in the browser on 25 Sep 2026, and each link and
  address was copied from it, not from a search summary. Where a summary named
  an address the page did not show, it was not used.
- Tests (`tests/le-contacts.test.mjs`):
  - every exchange a label can name, including an account held at another
    exchange, has an entry;
  - every found entry has a channel and an `https` source;
  - every not-found entry has a reason;
  - names match however they are spelled.
- Shown above the freeze request for a recorded MEXC case, with its four
  conditions and the source line.

## Limits

- **Dated guidance, not a guarantee.** The channels were right on 25 Sep 2026.
  The panel says so and links each source.
- **The tool never sends anything.** Registering on a portal and sending the
  request is the officer's act.
- FixedFloat, Swapster and UEEx have no recorded channel.
- SAHYOG is not mentioned. What SAHYOG handles is not claimed here.
