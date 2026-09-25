# Alerts when the desk is closed

## What it does

A CRITICAL case means the money is still sitting in a wallet, and that is true
only until it moves. The desk's watch used to ask the chain about those wallets
only while a Case queue tab was open, so a wallet that emptied at 3 a.m. was
found at 9. The deck lists the fix as a future prospect: move the watch to a
server-side scheduler. This is that.

Under the watch on the **Case queue** there is now one line, **Alerts when
closed**, with a **Turn on alerts** button:

- **Turning it on:**
  - the browser asks permission to show notifications;
  - it subscribes with its own push service (Chrome, Edge, Firefox or Safari);
  - it hands the FineX server its watch list.
- **The server checks every five minutes**, whether or not FineX is open. It
  asks each wallet the desk's question — *has it sent USDT since the case was
  read?* — using the same chain clients and shared pacing as a trace, so the
  check never crowds out an officer's trace.
- **When a wallet moves**, the browser shows a notification, even with every
  FineX tab closed. The real one from the test run:

  > **Funds moved · FX-2026-6619**
  > TDii6v…xcqYx has sent at least 344,786.68 USDT since the case was read on
  > 14 Sep 2026. Open the desk to see where it went.

  Pressing it opens the desk, where the desk's own check shows where the money
  went.

**The watch's rules still hold:**

- **Three answers, never two.** A wallet the chain did not answer for is asked
  again next round. It is never called still at rest, and it never raises an
  alert.
- **Once per wallet per browser.** Further movement shows on the desk, not as
  more notifications.
- **Nothing a reader could take for more than it is.** The notification says
  the wallet moved and when the case was read. It never says whose money it was.

**How the list stays right:**

- **The browser owns the list.** Every change is handed to the server at once,
  from whichever screen made it, so a CRITICAL case traced on its own page is
  watched before the desk is opened.
- **The list is sent again every time the desk opens.** A server that lost its
  copy in a restart has it back the next time anyone looks.
- **A lost key is recovered too.** If the restart also lost the server's push
  key, the desk notices the new key and subscribes again without asking, and
  the server is told to drop the old subscription.

**No provider, no key, no dependency:**

- **The message is encrypted to the browser's own key** (RFC 8291). The push
  service that relays it cannot read which wallet moved.
- **Every message is signed** as coming from this server (RFC 8292, VAPID).
- **No new dependencies:** `lib/webpush.ts` uses only Node's `crypto`. There is
  no email or SMS provider, and no one's API key.
- **Only the browsers' own push services are accepted** as endpoints (Google,
  Mozilla, Microsoft, Apple). A subscription names a URL the server will later
  POST to, so accepting any URL would let anyone aim the server at any address.

**The status line** says when the server last checked. If three checks were
missed, it says the server had stopped running, as a host that sleeps when idle
does.

## How to use it

1. Trace a case that comes back **CRITICAL**; its resting wallet goes on the
   watch. The recorded case works:
   `/trace/TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx?amount=5535.981436&since=2026-09-09T13%3A09%3A36.000Z&asof=2026-09-14T08%3A51%3A02.929Z`.
2. Open **Queue** (`/dashboard`). Under the watch, press **Turn on alerts** and
   allow notifications.
3. Close FineX. When a watched wallet moves, a notification arrives within
   about five minutes. The first check of a new list runs within seconds.
4. **Turn off** stops the alerts, and the server forgets this browser.

**To demonstrate it,** use the recorded case above. Its wallet has moved since
it was captured, so turning alerts on produces a notification within seconds.
That case was chosen by a script for being at rest. Describe the notification
as a CRITICAL finding going stale and the alert catching it. **Never** describe
it as fraud proceeds moving.

### Running it on a server

- **One always-on server:** nothing to set. The list and the server's push key
  are kept in `.finex/`, which is git-ignored because the key is private.
- **A host whose disk does not survive restarts** (Render's free plan):
  - set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, so the key survives;
  - point `FINEX_STATE_DIR` at a persistent disk, so the list survives.

  Without them a restart loses both, and the next desk to open restores them
  (tested below). Make a key pair with:

  ```bash
  node --import ./tests/register.mjs -e "import('./lib/webpush.ts').then((m) => { const k = m.generateVapidKeys(); console.log('VAPID_PUBLIC_KEY=' + k.publicKey); console.log('VAPID_PRIVATE_KEY=' + k.privateKey); })"
  ```

  Set the private half in the hosting dashboard, never in a file in the
  repository.
- **`VAPID_SUBJECT`** is the contact that push services see. It defaults to the
  deployment's own address on Render, and to the repository elsewhere.
- **A host that sleeps checks nothing while asleep.** The status line says so.
  Keeping the instance awake keeps the checks running.
- **Run one server per state directory.** Two servers sharing one would each
  send the alert.

## Verified

- **Unit tests, `tests/webpush.test.mjs` (6):**
  - encryption reproduces **RFC 8291's worked example byte for byte**, and the
    example decrypts with the RFC's browser key through a decryption written
    from the RFC, not from `lib/webpush.ts`;
  - fresh messages differ every time and decrypt;
  - the VAPID token is ES256, carries the right claims, and verifies with the
    public key;
  - key pairs are checked;
  - only the four push services are accepted, and look-alike hosts, other ports
    and embedded credentials are refused;
  - a push is posted as the standards require (to a local server): 410 reads as
    gone, and an unreachable service is an outcome, not a crash.
- **Unit tests, `tests/alerts.test.mjs` (7):**
  - a list is accepted only whole and well-formed;
  - a new list replaces the old, and a wallet taken off is forgotten;
  - each wallet is asked once, from the earliest moment anyone still waiting
    watches it;
  - only a read that came back, and shows USDT leaving after that browser's
    moment, owes an alert;
  - the notification's exact wording;
  - a round's outcome: delivered is marked told, refused is retried, gone is
    dropped;
  - the file is read back trusting nothing in it.
- **End to end, 26 of 26,** on a production build with a real Chrome and
  Google's push service:
  - **The route:** it gives a public key and keeps the private key on disk, and
    it refuses a non-push endpoint, a non-JSON body and a DELETE without an
    endpoint.
  - **Turning on:** the recorded case goes on the watch; the desk offers alerts,
    turns them on and says so, and the server holds the list.
  - **The alert:** a notification arrived **11 seconds** after turning on, and
    Chrome's own push log shows it **decrypted** ("Was Encrypted: Yes",
    "Success: Yes"). Its text is exactly as above. The server marked the wallet
    told.
  - **Reopening the desk:** the list is handed over again; the next round asks
    nothing and sends nothing about the wallet already told, and no second push
    arrives.
  - **Restart without the key:** the server made a new key; the desk
    re-subscribed under it and the old subscription was dropped; the browser
    holds the new key, and a notification arrived under it.
  - **Turning off:** the browser unsubscribes and the server forgets it.
  - No sideways scroll at 375 px, no console errors and no server errors.
- **How delivery was observed.** Chrome's `getNotifications()` returns nothing
  in an automated browser, even for a notification shown directly, so the test
  reads Chrome's DevTools record of push messages and notifications instead
  ("Background services"). It shows each push received, decrypted, dispatched
  to the service worker and displayed.
- **Clean checks:** tsc, eslint and all 55 unit tests. The build is clean too:
  it had one Turbopack file-tracing warning, fixed with the opt-out Turbopack
  names.
- **In the app's own browser pane,** which blocks notifications, the line says
  notifications are blocked and offers no button.

## Limits

- **Browser notifications only.** Email or SMS needs a provider and credentials
  this build does not hold.
- **The server has to be running.** A sleeping host checks nothing, and the
  status line says so.
- **Per browser.** Each officer turns alerts on in their own browser.
- **No login on the route**, as with every route in this prototype; a
  deployment puts it behind departmental sign-in. It holds at most 200
  browsers with 25 wallets each.
- **iPhone and iPad:** Safari sends web push only to a site added to the home
  screen, which FineX does not set up.
