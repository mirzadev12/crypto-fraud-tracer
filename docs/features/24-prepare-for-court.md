# Prepare for court

## What it does

Defence counsel will not ask whether the graph is clear. They ask how the tool
knows the money is the victim's, who says the address belongs to the exchange,
whether anything was left unread, and whether software decided. **Prepare for
court** answers those questions from this case's own record, with what each answer
does not establish stated beside it.

It is a section under the evidence packet on `/report/[address]`: **nine
questions**, or eight when the case has no exit (the question about who attributes
the exit is left out). Each has an answer, and a **Limit**: the thing the answer
does not prove, said before counsel says it.

- **Built like the summary** (`lib/narrative.ts`). `witnessSheet()` in
  `lib/witness.ts` is a pure function of the finished trace and its fingerprint, so
  it cannot drift from the evidence it describes. No language model writes any of
  it, and every figure in it is one the trace holds.
- **Outside the filed packet.** It is for the officer, not the court. It sits below
  the packet, closed by default (**Show the questions** opens it), and it is not
  shown for illustrative cases. It prints only when **Print with the packet** is
  ticked; otherwise it is hidden in print.
- **It prepares; it does not advise.** It cites no statute. The packet's legal-basis
  line and its optional blank certificate are where the law is chosen.

| # | Question | Answered from |
| --- | --- | --- |
| 1 | How do you know this is the victim's money? | The traced amount at the exit and its share, under the taint model the run used (haircut or FIFO, from `provenance.asked`; haircut when absent). With no exit: how much was followed out of the reported address, across how many transfers. When the reported address is itself the exit (note 23): that no tracing step stands between the payment and the account. |
| 2 | Who says this address belongs to that exchange, or that entity? | The exit's label source: the sweep evidence and confidence for a derived address, the OFAC list, or a public explorer tag. Only when there is an exit. |
| 3 | Was every wallet on the path actually read? | The wallets with no attribution that returned no history, and the count of hashed responses in the chain of custody. |
| 4 | How can the court be sure the findings have not changed since? | The first 16 characters of the findings fingerprint (note 07), the check link and QR on the packet, and the moment the chain was read. |
| 5 | Could the reported address be a look-alike the victim copied by mistake? | That it was traced exactly as entered and zero-value transfers are ignored (note 05); the victim's own record decides. |
| 6 | Did software decide this? | Rules decide everything; one advisory model only ranks unusual wallets, and no finding depends on it. |
| 7 | How strong are the laundering indicators? | The rules that fired and their measured base rates (note 28), or "No behavioural rule fired". |
| 8 | What did the trace not look at? | The search limits in `lib/trace-limits.ts`: 3 hops, the 5 largest outflows of any wallet, transfers under 1% of the amount, anything before the window opened, anything but USDT on the chain read. |
| 9 | When was the chain read, and by whom? | The moment read; recorded (served from the case file) or live (the audit log records the officer ID, stated or verified). |

## How to use it

1. Open a case's evidence packet (**Evidence packet** on the trace, or `/report/<address>`).
2. Below the packet, under **Prepare for court**, press **Show the questions**.
3. To take it to the hearing on paper, tick **Print with the packet**, then print.

## Verified

- **Unit test, `tests/witness.test.mjs`**, for each of the 14 recorded cases:
  - the sheet has at least eight items;
  - the fingerprint's first 16 characters, and the count of hashed responses,
    appear in it;
  - when the exit is not the reported address, the USDT that reached it appears;
  - it contains no statute (`CrPC`, `BNSS`, `Section n`) and none of "proves",
    "certainly" or "definitely".
- No end-to-end or print check is recorded for this note.

## Limits

- **The questions are fixed.** Counsel may ask others. The sheet answers the nine
  that the record can answer.
- **An answer is what the record supports.** Question 9's answer on who ran the
  trace depends on whether the officer ID was only stated at sign-in or verified by
  the department's gateway, and the sheet says to state which.
- **The sheet cannot say what happened after the read.** What the money did next
  is not in it; the desk's watch reports that.
- **It is only as good as the finding.** A derived attribution is still heuristic,
  and the sheet says so in question 2's limit.
