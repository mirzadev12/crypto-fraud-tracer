# A batch by state

## What it does

I4C coordinates the state cyber cells, so a morning's complaints are read by
state as well as by case. A complaint sheet's **State** column (`State`,
`State/UT`, `Union territory`) is now read, and after a batch runs, Batch
triage shows **By state**, one row per state or union territory:

| Column | Meaning |
| --- | --- |
| Complaints | rows from that state |
| Critical | money still held where it was found |
| At an exchange | the money reached an exchange or service |
| Closed | a mixer or sanctioned address; nothing left to act on |
| Not read | the chain could not be read, counted as such, never as empty |
| USDT still reachable | traced in the critical and at-an-exchange complaints |
| Exchanges reached | which exchanges, and in how many complaints |

The table is sorted by reachable money first. Complaints with no state come
last, as "State not given".

- **Spellings.** Values are matched to India's **28 states and 8 union
  territories** (`lib/states.ts`), so "MAHARASHTRA", "Orissa", "Pondicherry",
  "NCT of Delhi", "J&K" and "UP" group where they belong. Anything else is kept
  **as written**, never replaced by a guess.
- **Where else it appears.** Each result shows its state beside its NCRP
  number, and the worklist CSV gains a `state_ut` column.
- **Only when given.** The panel appears only when the sheet named states. A
  plain list of addresses is unchanged.
- **Only this batch.** Counted from the traced results of this batch and
  nothing else. There is no database behind it (see the Limits).

## How to use it

Add a **State** column to the complaint sheet (the example sheet now has one;
its states are placeholders, like its `EXAMPLE` numbers), then **Build the
queue** and **Run the queue** on Batch triage. **By state** appears above
**One request per exchange**.

## Verified

- **Unit tests** (`tests/by-state.test.mjs`):
  - the column is read and spelled canonically, with an unknown value kept as
    written;
  - a column named "Statement" is not taken for a state;
  - aliases and abbreviations resolve;
  - the counts, the order, and that a sanctioned exit is not an "exchange
    reached".
- **End to end, 9 of 9**, on a production build, running the example sheet:
  - **Maharashtra:** 2 complaints, 1 critical, 1 at an exchange (Bybit);
  - **Delhi:** 1 closed, nothing reachable;
  - **Karnataka:** the Ethereum case at CoinDCX;
  - each result shows its state, and the CSV carries `state_ut`;
  - no sideways scroll at 375 px, no panel for a plain list, no console
    errors.

## Limits

- **One batch at a time.** A national view across days needs the case database
  this project deliberately does not have (it is on the Phase 3 list).
- A district column is not read. The same approach would add it.
