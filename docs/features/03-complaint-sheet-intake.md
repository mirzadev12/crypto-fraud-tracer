# Complaint sheet intake

## What it does

Batch triage now reads a **complaint sheet** — the spreadsheet a cyber cell
already has — as well as a plain list of addresses. Each row is one complaint:

| Column (named loosely) | Required | Used for |
| --- | --- | --- |
| Acknowledgement number (`Ack No`, `NCRP acknowledgement`, `Complaint number`) | no | shown on the row, carried to the evidence packet and printed in the freeze request's NCRP field |
| Wallet or transaction (`Suspect wallet`, `Txn hash`, …) | **yes** | a TRON or Ethereum address, or a transaction hash |
| Amount (`Amount (USDT)`, `Loss`, …) | no | the amount traced for that complaint |
| Date (`Date of fraud`, …) | no | the window the trace opens at |
| State (`State`, `State/UT`) | no | groups the batch by state or union territory — see 16 |

Each complaint is traced with **its own** amount and date instead of the
automatic defaults. A row that gives a transaction is resolved to the wallet it
paid first; with no amount or date given, the transaction's own amount and time
are used.

It is not a second screen: it is the same box on Batch triage. A plain list of
addresses still works exactly as before, and now accepts transaction hashes too.

India-specific readings:

- Dates are read **day first**: `03/04/2026` is 3 April.
- A date or time with no time zone is read as **IST** (UTC+05:30).

Nothing is guessed. A row whose wallet, amount or date cannot be read — or that
repeats an acknowledgement number — is listed with the reason, and the rest of
the sheet still runs.

## How to use it

1. Open **Batch triage** (`/queue`).
2. Paste the sheet into the box (a copy from Excel works — tabs are read), or
   press **Load a file** and choose the `.csv`. **Example sheet** under the box
   downloads a template.
3. Press **Build the queue**, then **Run the queue**.
4. Each row shows **NCRP <number>**. **Freeze request** and **Open the trace**
   carry the number; from the case file, **Evidence packet** and **Freeze
   request** carry it on.
5. **Export CSV** gives the worklist with `ncrp_acknowledgement`, what was
   given, the wallet traced, the disposition, the exit and the deposit address.
   Complaints that could not be read stay on it, marked `NOT READ`.

A link can also carry the number by hand: add `&ack=<number>` to a trace,
packet or freeze-request link. Anything that is not letters, digits, `/`, `_`,
`.` or `-` (up to 40 characters) is dropped rather than printed.

## Example sheet

`public/templates/complaint-sheet-example.csv` — four recorded cases at their
recorded amounts and dates (they answer from the file in demo mode) and one row
that gives an Ethereum transaction instead of a wallet. The acknowledgement
numbers are marked `EXAMPLE-` and are not real complaints.

## Verified

`node --import ./tests/register.mjs --test "tests/*.test.mjs"` (parser: lists,
sheets, tab-separated pastes, day-first dates, IST, bad amounts, repeated
numbers). End to end in a browser: the example sheet queued 5, traced 5, every
row showed its number, the CSV export carried them, and the freeze request and
evidence packet printed `EXAMPLE-0001`; a malformed `ack` was dropped; no
console errors.

## Limits

- It reads a CSV export, not the NCRP system itself; FineX has no access to it.
- A complaint number is printed as given. FineX cannot check that it is real.
