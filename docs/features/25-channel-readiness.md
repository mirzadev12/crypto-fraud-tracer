# Channel readiness: can this desk actually send it?

## What it does

Note 14 says where an exchange takes law-enforcement requests and what its page
requires. This adds the question that decides whether a freeze request goes
anywhere: **can this desk send it?** A portal takes an account of the desk's own,
and approval can take weeks (MEXC's own page says 15 to 20 business days), so the
desk should know before the case arrives, not after.

**1. The conditions as a checklist** (`needs` in `data/le-contacts.json`). Each
found entry carries codes for the conditions its own page states: 12 of the 14
found entries have at least one; Kraken and CoinDCX have none. There are 13 codes:
account first, approval first, browser, English, signed order, wet signature,
government domain, official email, duration, copiable text, treaty channel,
freezing order, and legal basis. `needText` in `lib/le-contacts.ts` words each one,
for example "State how long the restriction is to last" or "Portal access must be
approved first, generally within 15 to 20 business days". `leadTime` and `domain`
quote the page ("15 to 20 business days" for MEXC; "gov.in or nic.in" for
CoinSwitch). The file's own rule: every code restates a sentence in that exchange's
`notes`, and `leadTime` and `domain` quote it. The codes were added on 4 Oct 2026
from the notes as read on 25 Sep.

**2. The desk's own access** (`lib/desk-access.ts`). Per exchange: **not recorded**,
**applied** (with the date) or **active**. Kept in this browser, in `localStorage`
under `finex.desk-access.v1`, keyed by the exchange's name reduced to lower-case
letters and digits (`mexc`, `gateio`).

**3. The sending guide** (`components/SendingGuide.tsx`), above every freeze request
and combined request:
- **A portal exchange** (7 of the 14: Binance, Coinbase, OKX, KuCoin, MEXC, Bitget,
  Bitfinex) shows a readiness line: **Ready** (access active), **Waiting** (applied
  on a date, with the approval time the page gives) or **Not ready** (no access
  recorded; apply now). Three buttons set it.
- **Any other** (email or form) shows **No account needed** and how it is sent.
- **Before you send** lists the remaining conditions. For a portal exchange the two
  access conditions are the status line instead, so they are not repeated.
- An exchange recorded as not found shows its not-found text as in note 14.

**4. The batch** (`components/ChannelReadiness.tsx`, on **One request per
exchange** in batch triage). Each exchange gets a tag (**Ready**, **Access applied
for**, **No portal access recorded**, **No account needed**, **No channel
recorded**). Above the list, one line names the exchanges in the batch that take
requests through a portal this desk has no active access to, each with its approval
time where the page gives one: "Apply now, or record the access on its request
page".

## How to use it

Open a freeze request (or a combined one from batch triage). For a portal exchange,
set **Not recorded / Applied / Active** to match what the desk really has. The
readiness line, the checklist, and the batch panel then follow. To change a
condition, edit `data/le-contacts.json` from the exchange's own page, with `source`
and `checked`, as in note 14.

## Verified

- **Unit tests, `tests/le-contacts.test.mjs` (4):**
  - every exchange a label can name has a recorded entry;
  - a found entry carries a channel and its own source, and a missing one says why;
  - names match however they are spelled;
  - every stated condition is worded, every found entry has a `needs` list, every
    quoted `leadTime` and `domain` appears in that exchange's own notes, and
    `needsAccess` is true for MEXC and false for CoinDCX.
  - That each code restates a note is the rule the data follows; the test checks
    the quotes, not each code.
- **On a production build:**
  - MEXC showed **Not ready** with "15 to 20 business days";
  - choosing **Applied** showed **Waiting** and stored
    `{"mexc":{"state":"applied",...}}` under `finex.desk-access.v1`;
  - Bybit showed **No account needed** and "Sent by form".

## Limits

- **One browser's record.** Nothing is kept on a server, and unlike the recorded
  outcomes (note 15) there is no export, so two desks cannot combine it.
- **It records what the desk says.** FineX does not check access with the
  exchange.
- **A refused write is not reported.** If the browser refuses storage (a private
  window), the buttons do not stick and the guide does not say so.
- **Dated guidance.** The conditions are the exchange's page as read on 25 Sep
  2026. Exchanges change them: check the source link under the guide.
- **A portal is taken to need access of its own.** Coinbase and OKX also list an
  email, and show as portal exchanges.
- **The screens are not unit tested**, only the data and the wording.
