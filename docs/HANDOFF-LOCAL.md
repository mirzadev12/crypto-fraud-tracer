# Handoff to the local machine — 24 September 2026

The cloud session could not reach sih.gov.in, TronGrid, Render or YouTube, so
the remaining work moves to the Windows machine. Everything that session
produced was merged into **`main`** (fast-forward, no force) on **mirzadev12**
and on **reemrasheed2007** on 24 Sep — Render redeploys from whichever of the
two it watches. The work branch `claude/optimistic-franklin-isy8fq` is on both
too. Nothing is lost if you follow the three steps below in order.

---

## 1. Sync (PowerShell, one line at a time)

```
cd "C:\Users\Mohammad Ali\crypto-fraud-tracer"
git status
git stash
git switch main
git pull origin main
git fetch mine
git status
npm install
```

`git stash` only if the first `git status` showed local changes; `git stash
pop` brings them back afterwards. The second `git status` should say `main` is
up to date with `origin/main`; `git log --oneline -1` should show the same
commit as `mine/main`. If reemrasheed2007's `main` was not updated (check the
commit on GitHub), push it from here: `git push origin mine/main:main` — a
fast-forward, never `--force`.

## 2. See the website locally

```
$env:DEMO_MODE="true"
npm run dev
```

Open http://localhost:3000. What is new (screenshots in
`docs/pitch/screens-2026-09-24/`):

| Screen | What to try |
|---|---|
| `/investigate` (New case) | Paste `0x0330070FD38Ec3bB94F58FA55D40368271E9e54A`, click outside the box → *OFAC SDN · listed*. Paste `1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa`, press **Screen against OFAC** → *not listed — not a clearance*. A TRON address traces exactly as before |
| `/queue` (Batch triage) | Paste a TRON, an `0x…` and a `bc1…` address → **Build the queue**: other-chain lines say what they are |
| `/operations` | "Against the problem statement": sixteen capabilities, eleven built, counted from the list |
| `/` and `/attribution` | 334 sanctioned TRON addresses, 44 entities, 709 more on other chains |
| `GET /api/screen/<address>` | JSON screening answer for any chain |

## 3. Paste this into the local Claude Code session

```text
Project: FineX // Blockchain Intelligence — TRON/USDT crypto-fraud tracer, SIH 2026, PS 26183 (MHA/I4C).
Repo: C:\Users\Mohammad Ali\crypto-fraud-tracer, branch main (everything from 24 Sep is merged; mirzadev12 is now public).
Read CLAUDE.md, AGENTS.md and CONTEXT.md first. CONTEXT.md §8 is the full record of the 24 Sep cloud session
(problem statement verbatim, decisions, OFAC refresh, screening design, research, pending list), and
docs/HANDOFF-LOCAL.md is the task list. Do not re-derive anything recorded there.

Remotes: origin = reemrasheed2007/crypto-fraud-tracer (never force-push); mine = mirzadev12 (--force-with-lease only).
Live: https://crypto-fraud-tracer.onrender.com — main was fast-forwarded on both repos on 24 Sep, so Render should
serve the new build; confirm with /api/health (its "commit" is the deployed commit).
Deadline 30 Sep 2026; aim to finish by 25 Sep. Shell is PowerShell 5.1: no &&. Keep responses terse.

Done on 24 Sep (verified: tsc, eslint, next build, 33 Playwright checks):
- Multi-chain SCREENING (not tracing): any address on a chain the OFAC list covers is recognised and screened —
  lib/chains.ts, lib/screen.ts, GET /api/screen/[address], New case panel, batch-triage reasons.
- Sanctions gap closed: OFAC files TRON addresses under USDT (79) and XBT (1), and 52 TRX entries were newer than
  8 Sep → sanctioned TRON 202 → 334. scripts/refresh-sanctions.mjs re-derives from treasury.gov (run it here, where
  treasury.gov is reachable, to re-check against the official source).
- Figures now: 241 deposit addresses, 10 exchanges, 15 seeds, 334 sanctioned TRON (44 entities), 590 labels,
  1,043 screened addresses / 20 assets, 6/6 rules, verifier 33 confirmed / 0 mismatched, 7 endpoints, 12 scripts.
- Docs updated (tech stack, methodology, portal text, deck sheet, evidence sheet .docx/.pdf).
- .github/workflows/keep-awake.yml pings /api/health every 10 min so Render's free instance does not sleep
  (Render free allows 750 instance-hours a month per workspace; one always-on service uses ~730).
- Deck: every planned edit is applied by docs/pitch/deck-edits-2026-09-24.py (demo video link, QR caption, clickable
  links, slide-3 architecture corrected, 202 -> 334, measured feasibility lines); the edited pptx/pdf were sent in chat.
- Decisions: Ethereum TRACING is for the grand finale, not before submission. AI/ML not built on purpose (future:
  ML ranks the queue, trained on I4C-confirmed cases; rules decide). Bridge "hard stop" claim was false and removed.

Your jobs, in order (details in docs/HANDOFF-LOCAL.md §4–§6):
A. Website checks on sih.gov.in (the cloud could not reach it): PS 26183 page, the official 2026 idea template and
   guidelines (slide count, PDF rules, file-name/size limits), the portal's idea title/description character
   limits, the deadline, and what the SPOC must upload. Then report what is left.
B. Deck — the team's Canva deck ships; edit text in place, never rebuild, never change flow/template, replacement
   text never longer than the original. All planned edits are DONE in docs/pitch/deck-edits-2026-09-24.py (see
   HANDOFF §5). Run edit_deck.py, then python docs/pitch/deck-edits-2026-09-24.py "…\ppt sih EDITED.pptx"
   "…\ppt sih EDITED.pptx", export PDF via PowerPoint COM (Presentations.Open(path,$true,$false,$false),
   SaveAs(pdf,32); PNGs SaveAs(dir,18)) and check every slide by eye. Then re-check against the official
   template on sih.gov.in.
C. Deploy readiness (HANDOFF §4 A2–A5), then the portal submission (A6–A8), then the P1/P2 backlog (HANDOFF §6).

Rules: never enter or paste API keys; don't edit plan/DEMO_MODE in render.yaml; never describe the TDii6 wallet's
movement as fraud proceeds; confidence is not accuracy; don't claim SAHYOG handles VASP freezes; never state an
unmeasured figure (rule base rates only as "sample of 17 wallets"); re-count every figure from data/ before using
it; don't change the core idea or a fundamental feature; push to mirzadev12 first, reemrasheed2007 after.
```

---

## 4. Before submission — in this order

| # | Task | Who |
|---|---|---|
| A1 | ~~Merge into `main`~~ — **done 24 Sep** on both repos. Confirm Render redeployed: `/api/health` → `commit` should be the new main commit; if auto-deploy is off, press *Manual Deploy* in the dashboard | teammate with dashboard access |
| A2 | Render: set `TRONGRID_API_KEY` and `DEMO_MODE=true` (dashboard, not `render.yaml`), then open `/api/health` — expect `demoMode: true`, `chainAccess: "keyed"` | teammate with dashboard access |
| A3 | ~~Uptime pinger~~ — **done**: `.github/workflows/keep-awake.yml` (GitHub Actions, every 10 min). Check the *Actions* tab shows green runs; enable Actions on the repo if GitHub asks | anyone |
| A4 | Open the live site cold and warm; open the three recorded cases from `/operations`; check the QR on slide 6 scans to the site | anyone |
| A5 | YouTube demo: make sure it is Public or Unlisted (not Private) and plays logged-out | video owner |
| A6 | sih.gov.in: verify deadline, idea title/description limits, PDF size/name rules, and paste the matching version from `docs/pitch/03-portal-text.md` | team lead |
| A7 | SPOC uploads the team and Annexure A; LICENSE question goes to the SPOC first | SPOC |
| A8 | Leader submits title, description and the deck PDF; download the submitted PDF and open it once | team lead |

## 5. Deck — done in the cloud session; what is left is PowerPoint

`python docs/pitch/deck-edits-2026-09-24.py "ppt sih EDITED.pptx" "ppt sih EDITED.pptx"`
(after `edit_deck.py`) now applies **everything**, checked and idempotent, and
the resulting `ppt sih EDITED.pptx` / `.pdf` were sent in the chat on 24 Sep:

- **S2** second black box → "SHA-256 evidence packet for every case".
- **S3** architecture picture replaced with `deck-assets/architecture-2026-09-24.png`
  (Case Files · Chain Reads · Evidence Packets · OFAC SDN List · Explorer Tags ·
  `/api/screen` · CSV download — no database, DEX metrics or InsightX); template
  footer over the flowchart made invisible; page number moved below the
  tech-stack list it overlapped (the list cannot be resized: Canva exported its
  bullets as separate dots).
- **S4** "evidence shown per label"; "Re-read on-chain → 31/31 deposit
  addresses hold"; bridge mitigation corrected; "Security – SHA-256 audit trail".
- **S5** 202 → 334; multi-chain screening built; ML ranking on I4C-confirmed
  cases; text insets so both prospects clear their icons.
- **S6** 202 → 334; demo video `youtube.com/watch?v=A4AipdXDDsk`; Live tool,
  Demo, GitHub and QR are clickable in the PDF; QR (encodes the site) enlarged
  and captioned "Scan: live tool"; link lines moved off the GitHub underline;
  the TronGrid reference linked to a URL with `?utm_source=chatgpt.com` — now the
  clean URL it displays.

Left for the local machine: export the PDF through PowerPoint COM and check
every slide by eye (the cloud render used the deck's own embedded fonts, so it
should match, but PowerPoint is the authority). If the team prefers, redo the
slide-3 label changes in Canva instead of using the patched picture.

Checked against real winning SIH decks
(`github.com/JoysonBeera/sih-winning-presentations` — 2024 cybersecurity
winner, 2023 winner): they use the same six-slide official template as ours;
what distinguishes them is a clear solution/uniqueness slide, an architecture
diagram with a tech stack, risks paired with mitigations, and a concrete impact
story. FineX already has all four; the items above are accuracy and polish.

## 6. Critique and improvement backlog

**Rating as an idea-stage submission: 8/10 today, ~9/10 once §4 and §5 are
done.** Strongest: a working, deployed prototype; the named deposit account
(241 derived from public data); triage; the hashed evidence packet; every claim
measured. Weakest, in order:

| Priority | Weakness | Fix |
|---|---|---|
| P0 | Live site ran the old build and slept | Merged and pinger added on 24 Sep; confirm per §4 A1–A3 |
| P0 | Slide 3 architecture showed components that do not exist | Fixed in the deck script (§5); redo in Canva if preferred |
| P1 | "Tracing: TRON only" vs "should support multiple ecosystems" | Screening covers it now; say "TRON traced, 20 assets screened" when asked |
| P1 | No AI/ML | State the design choice in one line (deck S5 has it); do not bolt on an unmeasured model |
| P1 | No Indian VASP in the seeds | Keep saying "none is publicly tagged — 2,500 scanned"; plan: FIU-IND-registered VASPs, verified addresses, one row each |
| P2 (finale) | Ethereum USDT tracing | Adapter + Ethereum seed wallets + clustering run; branch only |
| P2 (finale) | NCRP/SAHYOG intake | Documented intake route taking a complaint record, returning trace + restraint request |
| P2 (finale) | Alerts need the desk open | Server-side scheduled watch (needs a persistent store) |

## 7. Files — where everything is

| What | Where |
|---|---|
| Full decision record | `CONTEXT.md` §8 |
| This task list | `docs/HANDOFF-LOCAL.md` |
| Feature screenshots | `docs/pitch/screens-2026-09-24/` |
| Deck text edits (checked, idempotent) | `docs/pitch/deck-edits-2026-09-24.py` |
| Deck edit reasoning, figures, PS table | `docs/pitch/04-deck-edit-sheet.md` |
| Portal title/description | `docs/pitch/03-portal-text.md` |
| Updated Tech Stack / Methodology / Evidence Sheet | `docs/pitch/*.docx`, `docs/pitch/FineX — Evidence Sheet.pdf` |
| Sanctions refresh | `scripts/refresh-sanctions.mjs` → `data/risk-lists.json`, `data/sanctions-multichain.json` |
| Edited deck (pptx + pdf) | sent in the chat on 24 Sep; or regenerate with edit_deck.py + the script above |
| Slide-3 architecture picture | `docs/pitch/deck-assets/architecture-2026-09-24.png` (how it was made: `patch-architecture.py`) |
| Website QR | `docs/pitch/qr-finex.png` (encodes https://crypto-fraud-tracer.onrender.com) |
| Uptime pinger | `.github/workflows/keep-awake.yml` |
