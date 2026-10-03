# Plan B — the prompt for the second Claude account

Paste everything in the box into Claude Code (desktop or claude.ai/code) on the
second account. It is self-contained.

Before starting, the repository owner adds the friend's GitHub account as a
collaborator on `mirzadev12/crypto-fraud-tracer` (Settings → Collaborators),
so the branch can be pushed. Install the `impeccable` plugin on that account if
it is not there (Claude Code: `/plugin` → search "impeccable").

```
Project: FineX, our SIH 2026 entry for problem statement SIH26183 (MHA · I4C): it traces USDT from a victim-reported wallet to the exchange deposit account that received it, triages the case CRITICAL / SUSPICIOUS / CLOSED, and drafts an evidence packet and a freeze request. Repository: github.com/mirzadev12/crypto-fraud-tracer. The submission deadline is 5 October 2026.

Setup: clone it, `git switch finale/refine`, then `git switch -c finale/india`. Work only on finale/india and push only to that branch on mirzadev12. Never push to main, never push to any other remote (reemrasheed2007 is the deployed site; do not touch it), never change Render.

Read first: docs/plans/2026-10-04-finale-refine.md (the whole plan; you are Plan B), CONTEXT.md §3 (the house rules: palette budget, four faces, spacing scale, square corners, one border-light gradient only, no glow or blobs, provenance language, min-w-0, sweep widths), and docs/research/2026-10-04-india-context.md (what is verified about India's laws, helplines, emblem and map rules, GIGW).

Your files (only these; another account owns everything else, so touching other files will cause merge conflicts): components/AppShell.tsx, Navbar.tsx, InvestigateForm.tsx, BulkTriage.tsx, EvidencePacket.tsx, FreezeRequest.tsx, CombinedFreezeRequest.tsx, PacketFingerprint.tsx, HeroTrace.tsx; app/page.tsx (landing), app/help, app/operations, app/audit; new pages app/accessibility, app/policies, app/developers; lib/format.ts; the Hindi help content files; public/openapi.json; additive rules at the end of app/globals.css. If a task needs another file, write down what you need in docs/plans/plan-b-requests.md and keep going.

Do Plan B tasks B1 to B9 in order, then the Plan B items in the plan's "Motion and graphics" section. Use the /impeccable:impeccable skill for every UI change (animate, polish, adapt), within FineX's existing look; it is a refinement, not a redesign. components/LiveStatus.tsx already exists: place it in the footer (B1) and on the landing page.

Rules that must hold:
- No State Emblem of India, no map of India with boundaries. Say "a prototype for I4C, MHA — not an official Government of India website".
- Nothing from NOIR (the team's other entry): no departure boards, split-flap or odometer counters, wayfinding signs, yellow, or a VASP-first desk.
- Attribution is deterministic; confidence is not accuracy; an unreadable wallet is never reported as empty; print no statute unless the plan's B8 is approved; never claim SAHYOG or NCRP integration is live; count every figure from data/; timestamps stay absolute (UTC, with IST beside it).
- Hindi you add is machine-drafted: mark it for native review.

Verify before every push: `npx next typegen`, `npx tsc --noEmit`, `npx eslint .`, `node --import ./tests/register.mjs --test "tests/*.test.mjs"`, and a build. On claude.ai/code use `npx next build --webpack` (Turbopack cannot fetch fonts there) and run with DEMO_MODE=true (the cloud cannot reach the chain APIs). Check every route you touched at 375, 784, 1100 and 1600 px: no sideways scroll, no console errors. Commit often with clear messages and push finale/india to mirzadev12.

Finish with screenshots (1440 px and 390 px) of: the landing page, the Queue, a case file, the evidence packet, and batch triage with the state tiles. Put them in docs/screens-2026-10-05/ for the deck.
```
