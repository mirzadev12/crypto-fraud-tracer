# Recording what happened to a freeze request

## What it does

FineX names the account and drafts the letter, but it never learns what the
exchange did. This closes the loop. The officer records the answer, and the
desk counts, per exchange:
- how many requests went out;
- how many were **frozen** (fully or partly), **refused**, or are still
  **unanswered**;
- the **median days** from sending to an answer;
- the USDT frozen against the USDT traced.

That is the evidence I4C would need to press an exchange that sits on requests.
It is also the only honest ground a future ranking of cases could be trained
on: confirmed outcomes, not guesses.

**Two places:**
- **Record what happened.** A panel below every freeze request, never
  printed: status (sent, acknowledged, frozen, partly frozen, refused, no
  response), date sent, date answered, USDT frozen, the exchange's reference,
  and a note.
  - On a **combined request** it records the same answer for every complaint
    in the letter, one record each.
  - A later save keeps an NCRP number already recorded for that complaint.
- **Freeze requests and outcomes.** On the Case queue: the per-exchange table,
  every request latest first with a link back to it, **Export CSV**, **Export
  for another desk** (JSON) and **Import records**.

**Honest by construction:**
- Every figure says how many requests it is counted from ("not a measure of
  any exchange beyond them"). The median states how many answers it covers.
- **Kept in this browser only**, for the same reason as the watch list: there
  is no database, and a server that sleeps could not hold them. The screen says
  so. A unit combines desks by exporting and importing. Importing merges, and
  the later update of each request wins.
- An answer dated before the request was sent is refused. An imported file
  that is not FineX records is refused and named. A link inside a record must
  point back into the app, or the record is dropped.
- If the browser refuses storage (a private window), the panel says the record
  was not saved.

## How to use it

1. Send the freeze request (see 14 for where), then come back to it and fill
   in **Record what happened**. Update it when the exchange answers.
2. The Case queue shows the tally, under **Freeze requests and outcomes**.
3. **Export CSV** for a report; **Export for another desk**, then **Import
   records** on the other browser, to combine.

## Verified

- **Unit tests** (`tests/outcomes.test.mjs`):
  - records are read only when valid (status, a link back into the app,
    dates, amounts);
  - merging keeps one record per request, the later update winning;
  - per-exchange counts and the median are right;
  - the CSV quotes commas and quotes.
- **End to end, 14 of 14**, on a production build in a clean browser:
  - the combined MEXC letter recorded for all three complaints;
  - one of them updated to frozen, 7,000 USDT, reference MX-1; a date out of
    order refused;
  - the panel does not print, and the form survives a reload;
  - the desk counts "MEXC 3 requests, 1 frozen, 0 refused, 2 unanswered, 2
    days (median of 1)" and says it is counted from 3;
  - the NCRP number from the letter survives the single save;
  - the CSV has three rows;
  - another browser imports the JSON and merges three, and refuses a junk
    file;
  - no sideways scroll at 375 px; no console errors.
- **Found and fixed on the way:**
  - The request list overflowed a phone by 22 px on "Sent, awaiting answer".
  - A save from a single request dropped the NCRP number the combined letter
    had recorded.
  - A save remounts the form, which erased its confirmation; the resting line
    is now "Saved in this browser · last recorded …".

## Limits

- One browser's record. There is no shared store, and nothing on a server.
- The officer records it; FineX does not check it with the exchange.
- Counts from a handful of requests describe those requests. The screen says
  so, and they must not be quoted as an exchange's record.
