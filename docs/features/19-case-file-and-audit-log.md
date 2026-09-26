# Case file, sign-in and audit log

## What it does

Three pieces that turn one officer's browser into a shared desk, and make
every action on it accountable.

**Sign-in that records who did what.** The sign-in screen's **Officer ID** and
**unit** are now kept in the browser and sent with each request, so the server
can record who traced, saved or removed what. They are recorded as **stated at
sign-in, not verified**, and every record says so.

- **Behind a gateway, the name is verified.** Deployed behind the department's
  sign-in gateway, set `FINEX_IDENTITY_HEADER` to the header the gateway adds,
  for example `x-forwarded-email`. The server then records the name the gateway
  passes as **verified**, and ignores anything the browser says about itself.
  If the header is missing, the request is recorded as coming from nobody.
- **FineX never holds a password.**

**The audit log (`/audit`).** Each of these is one entry:

- every trace the server answers, live or recorded;
- every case saved or removed;
- every browser that turns alerts on or off.

An entry records when it happened, who did it and how far that is trusted, what
was done, and which wallet. A trace entry also records the run as asked (amount,
window, taint model) and the server's answer: disposition, exit, case number,
and the findings fingerprint (note 07).

Each entry carries the SHA-256 of the one before it, so the log is a chain:

- **The page checks the chain every time it opens.** It says either "Chain
  intact", with the **head** (the latest hash) to write down, or "Chain broken at
  entry N", with the reason.
- **Download the log** gives the file exactly as written.
  `node scripts/verify-audit.mjs <file>` checks it anywhere. The script re-states
  the hash rule itself and imports nothing from the app, so a bug in the app
  cannot make it pass.

**What the chain proves:** the entries are the ones written, in the order
written. Changing, removing or reordering any one breaks the chain at that entry.

**What it cannot prove on its own:** that the whole file was not swapped for a
different chain that is consistent with itself, or that the server's clock was
right. The page prints the head for the first of these. Write it down somewhere
the server cannot reach, such as a case diary or a covering letter: every later
log must still pass through it.

**The case file (Case queue).** **Save case** on a case file puts that run into
a case file that every officer using the same server sees on the Case queue,
above the committed register.

- **The server builds the saved case from its own audit record** of the trace,
  found by its findings fingerprint, never from what the browser sends. So:
  - **only a run this server actually traced can be saved.** Anything else is
    refused ("This server has no record of tracing that run");
  - **the disposition, exit and amount shown are the server's own.**
- **Open** replays exactly that run: the same amount and window, the chain as it
  stood when it was read, and FIFO if FIFO was asked for.
- **Remove** takes a case out of the file.
- **Saving and removing are logged**, with who did them.
- **The same run saved twice is one case**, and it keeps who saved it first.

This is `GET /api/cases` → `CaseSummary[]` from AGENTS.md §5. It stayed unbuilt
on purpose until there was a record honest enough to serve through it: the
objection was to serving complaint records the chain never produced, and every
row here is a run the server traced.

## How to use it

1. **Sign in** (`/login`) with your Officer ID and unit. The screen then says
   who is signed in on this browser, and has **Sign out**.
2. **Open a case**, for example the recorded case:
   `/trace/TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx?amount=5535.981436&since=2026-09-09T13%3A09%3A36.000Z&asof=2026-09-14T08%3A51%3A02.929Z`.
   Press **Save case**, in the case bar or under it on a smaller screen. It then
   reads **In case file**.
3. **On Queue (`/dashboard`), the Case file lists it** for every officer on
   this server, with who saved it and when. **Open** replays the run; **Remove**
   takes it out.
4. **The audit log** is linked from the Case file and from Operating notes
   (`/audit`). Use **Download the log**, then run
   `node scripts/verify-audit.mjs finex-audit.jsonl`.
5. **Behind a sign-in gateway**, set `FINEX_IDENTITY_HEADER`. Set it only when
   every request reaches FineX through that gateway, or anyone could send the
   header themselves.

**Where it is kept.** The case file and the log are `cases.json` and
`audit.jsonl` in the same directory as the alerts (`.finex/`, or
`FINEX_STATE_DIR`). That directory is git-ignored. On a deployment, point
`FINEX_STATE_DIR` at a persistent disk. On a host whose disk does not survive a
restart, both files are lost, and the log starts again at entry 1: another
reason to write the head down.

## Verified

- **Unit tests, `tests/audit.test.mjs` (6):**
  - canonical JSON sorts keys at every depth;
  - each entry names the one before it and hashes everything but its own hash;
  - a trace entry records the run and the answer, fingerprint included;
  - an intact chain verifies and names its head;
  - the chain breaks at the right entry, with the right reason, for each of
    these: a changed entry, a changed name, a removed entry, two entries swapped,
    a garbled line, and an entry re-hashed after an edit (the next entry catches
    that one);
  - the stand-alone verifier agrees, and exits 1 on an edited entry.
- **Unit tests, `tests/case-file.test.mjs` (5):**
  - the replay link: an automatic amount and window stay automatic, and FIFO is
    carried;
  - a saved case is the server's record, on TRON and on Ethereum;
  - a non-trace entry cannot become a case;
  - one answer is one case, and the file has a ceiling;
  - the file runs in the register's order;
  - the file is read back trusting nothing in it.
- **Unit tests, `tests/identity.test.mjs` (3):**
  - a stated name, including a unit named in Devanagari;
  - behind a gateway, only the gateway's header counts;
  - a name cannot carry a line break.
- **End to end, 33 of 33,** on a production build, with two officers in two
  browsers:
  - **Sign-in:** the officer is kept, the screen says who is signed in and how
    far that is trusted, and their trace is logged under that name, stated and
    not verified.
  - **Saving:** the save gives the server's own record, in the contract's
    `CaseSummary` shape, and is logged. A made-up fingerprint is refused with a
    404.
  - **The second officer:** not signed in, on another browser, they see the saved
    case with who saved it, open it to the exact run (which reads "In case
    file"), and their trace is logged as not signed in.
  - **Alerts and removal:** alerts on and off are logged with who. Removal
    empties the file and is logged.
  - **The chain:** the page reads it intact and shows the head. The downloaded
    log verifies on its own to the same head. An entry edited on disk shows as
    "Chain broken at entry 2", and verifies again once restored.
  - **Behind a gateway** (simulated with the header): the gateway's name is
    recorded as verified, and a request without it as nobody, whatever the
    browser claims. The chain stays intact across the restart.
  - **Layout:** no sideways scroll on `/audit`, `/dashboard`, `/login` and the
    case file at 375 and 784 px, nor on the case bar with Save case at 1280 px.
  - No console errors and no server errors.
- **The README's commands were run as written:** the permalink answered
  `recorded`, the save returned 201, and the downloaded log verified
  `INTACT: 2 entries`.
- **Regression:**
  - the alerts end-to-end test is still 26 of 26: the alert store now shares the
    state-file module;
  - tsc, eslint and the build are clean, and all 69 unit tests pass.

## Limits

- **A stated name is not authentication.** Anyone can type any officer ID. Only
  a gateway makes it verified, and the record always says which it is.
- **The chain proves integrity from within**, not that the whole file was never
  replaced, nor that the clock was right. Write the head down.
- **Logging a trace is best effort.** If the log cannot be written, the trace
  is still answered, and the failure goes to the server's own log. The missing
  entry shows as missing, and no case can be saved from it.
- **The case file holds runs, not complaints.** It has no complainant details
  and no free-text notes, so personal data stays out of it.
- **The routes have no login of their own**, like every route in this
  prototype. Anyone who can reach the server can save or remove a case, and each
  action is logged under the name they gave. A deployment puts the whole app
  behind the department's sign-in.
- **Ceilings:**
  - 500 saved cases;
  - the page shows the latest 200 log entries, and the download holds all of
    them.
