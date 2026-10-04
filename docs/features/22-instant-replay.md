# Instant replay

## What it does

A link pinned to a run (`?asof=` the moment it was read, with that run's amount,
window and model) used to be answered by reading the chain again. That takes half
a minute or more per wallet without an API key, and a throttled re-read can come
back with a wallet unread that the first read had read. The Case queue opened
every row that way, and the critics' walkthrough found the wait ran to minutes
(`docs/review/2026-10-04-critic-walkthrough.md`, P0-1). Confirmed transfers never
change, so a run pinned to its moment has exactly one answer, and the run already
read is the better copy of it.

**1. A run cache** (`lib/run-cache.ts`).
- After every live read, both trace routes and the six-hourly reference re-read
  keep the finished `TraceResult` in memory: 300 runs at most, the oldest dropped.
- A request that carries `asof` and matches a kept run exactly (chain, wallet,
  amount, window, taint model and the moment read) is answered from it. Nothing
  else is: a bare link still asks the chain what the wallet looks like now.
- The answer is the original, unchanged. It keeps its own `generatedAt`, so the
  screen still reads "Live trace · as of" the moment it was read, and the response
  is stamped `x-finex-provenance: live`, because this server read it from the chain.
- A streamed request gets one `replayed` progress event (`caseId`, `readAt`). The
  loader prints "the run read <time>, replayed without a new chain read"; batch
  triage prints "run already read, replayed".

**2. Register rows carry their run.** Each row of `/api/register` has an optional
`pin`: the query string that replays exactly that run (`runQuery` in
`lib/case-file.ts`). A recorded row pins its capture; a traced or reference row
pins its audit entry's moment, amount, window and model; a saved case pins its
saved link. `caseHref` (`lib/api.ts`) uses it, so the Case queue, the case rail
and the reports list open a row's trace, packet or freeze request as that run
instead of asking the chain again. A row without a pin opens as before.

**3. What was asked travels with the run** (`provenance.asked`, `lib/types.ts`).
An additive, optional field: the amount, window and taint model the run was asked
for, each a stated figure or `"auto"`. `traceHref` reads it, so a link made from a
trace replays an automatic amount or window as automatic. Before, the link stated
both, and the traced amount and the derived window then read as figures a
complaint had reported: the packet printed the derived window as the "date of
fraud", and NEW_ADDRESS (which reads a stated window as a reported date) could fire
on the replay where it had not on the run. Traces captured before 4 Oct 2026, the
recorded cases among them, carry no `asked` and keep the old link. `normalizeTrace`
(`lib/api.ts`) keeps the field only when it is well formed.

**4. The permalink and the case file.** Outside demo mode,
`GET /api/trace/[address]` also answers a link pinned to a recorded case's own
capture moment from `data/demo-cases.json`, stamped `recorded` (the match rule is
`answersFor` in `lib/demo.ts`: same amount, window and moment, haircut model).
`POST /api/trace` does not: outside demo mode it re-derives from the chain, which
`scripts/rescore-cases.mjs` depends on, since that script posts each case's capture
moment. A bare link and `?model=fifo` still go to the chain. Both routes consult
the run cache.

**The audit log.** A replay is written as a trace entry with provenance
`replayed` (`/audit` reads "Opened · replay of a run read earlier"). It is not a
chain read, and nothing counts it as one: `/api/status` leaves it out of
`traces.today` and `traces.last`, the register's `tracesLogged` and rows count
only live reads, and `findTrace` skips it, so a case saved from a replay is built
from the original entry. The hash chain is written as for any entry.

## How to use it

1. Trace a wallet once. Its row on the Case queue then opens at once, and so does
   the permalink pinned to that run.
2. By hand: take `provenance.generatedAt` from a live answer, then
   `curl "http://localhost:3000/api/trace/<address>?asof=<that moment>"`. Add
   `amount=` and `since=` only if the run stated them: a figure added to an
   automatic run is another run, and is read from the chain.
3. A recorded case answers from the file without a chain read, with or without
   demo mode, on its own pinned link:

   ```bash
   curl -i "http://localhost:3000/api/trace/TXq2kpXz13Z16b2Fjq58NerQTmU7gkkGex?amount=7630.48&since=2026-09-08T19:12:36.000Z&asof=2026-09-14T08:51:06.859Z"
   ```

   It returns `x-finex-provenance: recorded`.

## Verified

- **Unit tests, `tests/replay.test.mjs` (4):**
  - an automatic run's link stays automatic;
  - a stated run's link states both;
  - a trace from before `asked` existed keeps the old link;
  - a register row with a pinned run opens that run on every page (a Polygon pin
    carries `chain=polygon`), and a row without one opens the bare link.
- **Live, on a running server:** a pinned `GET` of a run read ten seconds earlier
  answered in 8.7 ms with a `replayed` progress event. The audit chain stayed
  intact, and `/api/status` `traces.last` stayed at the live run's time.

## Limits

- **In memory, 300 runs, one process.** A restart forgets them, and the first
  open of each run afterwards re-derives as before. The recorded cases do not
  depend on it: they are in the file.
- **Exact match only.** A different amount, window, model or moment is another run
  and is read from the chain.
- **A replay is the original run**, including a wallet it could not read at the
  time. To read again, change the run or open the bare link, which asks what the
  wallet looks like now.
- **Nothing here tests the routes.** The cache and the permalink's file answer are
  covered by the live check above, not by a unit test.
