# The critics' fixes: the smaller changes

## What it does

On 4 Oct 2026 three reviews were run against the live site and the competition.
They are kept in `docs/review/`:

- `2026-10-04-critic-walkthrough.md`: an evaluator's first-impression walkthrough
  of the deployed site (commit `6c2b3e4`), issues ranked P0 to P2.
- `2026-10-04-critic-ps-compliance.md`: a strict check of FineX against what the
  problem statement asks, with the claims that were false or contradicted.
- `2026-10-04-critic-competition.md`: what the other teams on the problem statement
  do, from their public READMEs. No rival code was run.

Notes 22 to 27 are the larger changes the reviews led to. This note holds the
smaller ones.

**A case reference that belongs to the wallet.** `caseIdFor(chain, address)` in
`lib/tracer.ts` takes 40 bits of SHA-256 over `<chain>:<address>` (a `0x` address in
lower case) and writes them in Crockford base32, which has no I, L, O or U to
misread aloud: `FX-XXXX-XXXX`.
- **One reference per wallet per chain.** The same wallet traced with or without a
  reported date has one reference, and the same `0x` string on Ethereum and on
  Polygon has two.
- **It used to be `FX-<year>-<four digits>`**, with the year taken from the trace's
  window. One wallet could carry two references, and with ten thousand values
  collisions were likely (walkthrough P1-6).
- **The 14 recorded cases were relabelled** in `data/demo-cases.json` and
  `public/mock/cases.json`. The findings fingerprint does not cover the reference,
  so no recorded fingerprint changed.
- **Older records keep the reference they were written with.** The audit log is a
  hash chain and is never rewritten, and a saved case is built from its entry. Note
  18 quotes an old-format reference in a test-run notification, as a record of that
  run.

**"Traced (none reported)" where nothing was reported.** With no amount or date in
the complaint, the trace derives both, and the packet and freeze request used to
print them as "Reported amount" and "Date of fraud" (walkthrough P0-3). They now
read **Amount traced (none reported)** and **Window opened (no date reported)**
when the link states none, on the packet, the freeze request and the request to
Tether. This relies on a link replaying an automatic figure as automatic (note 22).

**The legal-basis question.** Which criminal-procedure and evidence regime applies
turns on whether the matter was pending on 1 July 2024 (IST). The FIR or complaint
date answers that, and a fraud date does not: a fraud from May 2024 first reported
in 2026 is a new-law matter. So `regimeFor(fraudDate, pending)` in
`lib/legal-basis.ts` takes the officer's answer, and the picker (on the freeze
request and the request to Tether) asks **Was the matter pending on 1 July 2024?**:
**Not stated**, **No**, **Yes**.
- **No** gives the new laws' sections, as before.
- **Yes** withdraws those sections and leaves the line blank, for the earlier
  provision to be written in once a law officer confirms it.
- **Not stated**, with a fraud before 1 July 2024, shows a prompt to say so before
  citing any section. A fraud on or after that date shows none.

The tool chooses no section: the line stays blank unless the officer picks one.

**Rule base rates beside the rules** (`lib/rule-base-rates.ts`). Where a rate was
measured, each flag states how often its rule fires on wallets nobody reported:
"Fires on 16 of a sample of 17 TRON wallets nobody reported: weak on its own". The
measured rates are peel chain 16, fan-out 15 and sanctioned contact none, out of 17
(`scripts/calibrate-risk.mjs`). A rule at or above half the sample reads "weak on
its own". A rule with no measured rate states none, and the rates say TRON because
that is the only chain measured. It is a base rate, not a false-positive rate: there
is no labelled fraud set. It shows on the trace screen, on the packet ("Base rate:")
and in question 7 of the court sheet (note 24).

**A copy truth pass.** Statements a judge could check, made to say what the code does:
- **Latency, from a measurement.** On 4 Oct 2026 the recorded wallets were re-read
  live without an API key: median 12 s, slowest 179 s. `/operations`, `/help`
  (English and the Hindi draft) and New case say "from about ten seconds to about
  three minutes" with those figures. The loader adds "This wallet has a long history;
  reading continues." after 45 s of a live read, never for a recorded or replayed
  answer. "Real-time tracing" is now "Near-real-time tracing".
- **CRITICAL, SUSPICIOUS and CLOSED, as they are.** CRITICAL is "no exit yet": at
  rest, or still moving and not attributable after three hops. CLOSED is an
  OFAC-sanctioned address; a labelled mixer would close a case the same way, but no
  mixer list ships, so the landing page, `/help` and `/operations` no longer say a
  case "enters a mixing service". An address that never moved USDT is closed with a
  note to check it against the complaint.
- **TRON swap and bridge detection stated as absent.** TRON recognises no bridge or
  swap contract and reads one as an ordinary wallet; Ethereum and Polygon stop at a
  recognised one. "Identification of cross-chain fund movement" moved on `/operations`
  from built to "not built, with a plan", worded as partly in place.
- **`/operations` rows added** for automated recognition of fraud typologies (the
  scam type is entered by the officer; FineX does not detect it) and privacy-enhancing
  mechanisms (Monero is screened by exact match, never traced). The Indian-exchange
  row is counted from the data, chain by chain.
- **Persistence disclosed.** `/operations` and `/policies` say that on this
  demonstration host the state directory is not kept across deploys or restarts, so
  the audit log, case file and alert list start empty, and that a deployment that
  must keep them points `FINEX_STATE_DIR` at a persistent disk.
- **The repository can be found.** A footer **Source code** link, one on
  `/developers`, and the issue links on `/policies` and `/accessibility`
  (`REPOSITORY` in `components/AppShell.tsx`).
- **Which cases are real.** `/operations` says the recorded wallets were chosen by a
  script from public data, not reported by victims, and dates each at-rest finding
  ("funds at rest when recorded on …").
- **Two intake notes.** Batch triage says column names are matched loosely and that
  I4C's own export format has not been seen; New case says the scam type is entered
  by the officer and that a Bitcoin or Monero address is screened, not traced.
- **The portal text** (`docs/pitch/05-portal-text-finale.md`): the idea description
  is 1,981 characters, counting each line break as one, against the 2,000 that file
  records as the limit. It now says CRITICAL is "not yet at an exchange", CLOSED is
  "an OFAC-sanctioned address", and "Rules decide; no model does".

**Shared modules** (code only). `lib/trace-limits.ts` holds the tracer's search
limits (3 hops, the 5 largest outflows, 1% of the amount), so the court sheet quotes
the numbers the tracer uses. `components/sheet.tsx` holds the document pieces
(`SHEET`, `Section`, `Field`, `Blank`) that the freeze request, the combined request
and the request to Tether share. `FreezeRequest` re-exports them for existing
imports, and the combined request still takes them from there.

## Verified

- **Unit tests, `tests/case-id.test.mjs` (2):**
  - every recorded case carries the reference its wallet derives;
  - one wallet gets one reference (Ethereum case-insensitive, Polygon different from
    Ethereum), and the format matches `FX-` and two groups of four Crockford
    characters.
- **Unit tests, `tests/legal-basis.test.mjs` (4, one added):** the regime turns on
  whether the matter was pending, which the officer states.
- **Unit tests, `tests/help.test.mjs` (3):** the Hindi help has the English help's
  shape, is in Hindi and says it needs review, and every screen it names is in the
  navigation.
- **The seven test files behind notes 22 to 28 pass:** 22 tests, run on 5 Oct 2026
  with `node --import ./tests/register.mjs --test tests/<file>`.
- **The portal text** counts 1,981 characters (line breaks as one), checked on 5 Oct
  2026.
- The new wording itself, as opposed to the structure the help test checks, is not
  covered by an automated check.

## Limits

- **The Help page's button list does not yet describe** Prepare for court, Request to
  Tether or the portal-access buttons (notes 24 to 26).
- **The base rates are from 17 TRON wallets.** That is enough to show which rules
  are weak and too few to tune their thresholds, and `/operations` says so.
- **The Hindi text remains a machine draft** marked for native-speaker review
  (note 17); the updated lines are unreviewed.
- **A reference no longer carries a year or a chain.** The chain is read from the
  line beside it, where the packet and the requests print it.
