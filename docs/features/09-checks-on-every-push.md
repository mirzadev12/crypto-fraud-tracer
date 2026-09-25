# Checks on every push

## What it does

`.github/workflows/checks.yml` runs on every push and pull request, fastest
first, and fails the commit if any step fails:

1. **Unit tests.** `node --test` over `tests/*.test.mjs`, with no test
   dependency. Every test has an answer that doesn't come from this
   repository:
   - Keccak-256 and EIP-55 against published vectors;
   - the QR encoder against a code made by another encoder;
   - the fingerprint, poisoning, intake and combined-request rules.
2. **Route types, then types.** `npx next typegen`, then `npx tsc --noEmit`.
3. **Lint.** `npx eslint .`
4. **Build.** `npm run build`
5. **Demo mode serves every recorded case.** Starts the build with
   `DEMO_MODE=true` and runs `scripts/check-demo.mjs`. The pitch runs on demo
   mode, so this checks it directly. Each of the 13 recorded cases is requested
   through its own permalink, the link the app builds, and must come back:
   - stamped `recorded`;
   - for the address asked about;
   - with the recorded disposition;
   - with the same findings fingerprint as the file (see 07).

   An address the file does not hold must not be answered from it.

No secret is used and nothing is deployed. The workflow can only read the
repository (`permissions: contents: read`), and a newer push to the same branch
cancels the run in progress.

## How to use it

- Push a branch. The result shows as a check beside the commit on GitHub and in
  the repository's **Actions** tab.
- **Locally, the same steps** (README → Checks):

  ```bash
  node --import ./tests/register.mjs --test "tests/*.test.mjs"
  ```

  ```bash
  npx next typegen
  ```

  ```bash
  npx tsc --noEmit
  ```

  ```bash
  npx eslint .
  ```

  ```bash
  npm run build
  ```

  and, with a demo-mode server running (`DEMO_MODE=true npx next start -p 3032`):

  ```bash
  node --import ./tests/register.mjs scripts/check-demo.mjs 3032
  ```

  The demo check refuses a server that is not in demo mode, and names it.

## Verified

- On a clean checkout of the branch (a fresh worktree):
  - `tsc` **fails** without the route types (`Cannot find name 'PageProps'`,
    three pages) and passes after `next typegen`. That is why the step exists:
    `.next/` and `next-env.d.ts` are not committed, so a fresh checkout has
    neither.
  - Tests and lint pass.
- `scripts/check-demo.mjs` against a production build with `DEMO_MODE=true`:
  14 of 14. All 13 recorded cases (10 TRON, 3 Ethereum) were answered from the
  file with identical fingerprints, and the stranger address was answered live,
  not from the file. Against a server without demo mode it fails and says so.

## Limits

- It runs only where GitHub Actions is enabled for the repository.
- It reads no chain, so it can't catch a change that alters live traces. That
  is what the re-derivation gates are for (`scripts/rescore-cases.mjs`, and
  the fingerprint gate in 07), and they need the network and minutes.
  - One exception: the stranger-address request in the demo check makes a
    single short read of an address that has never held USDT.
- A build on GitHub fetches the Google fonts. A runner without internet
  access would fail at the build step, not at a check.
