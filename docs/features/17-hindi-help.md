# Hindi: the help page

## What it does

The Help page, the plain-language guide a first-time user reads, is now in
**Hindi** as well as English. A **हिन्दी / English** switch sits at the top of
`/help`, and `/help?lang=hi` opens the Hindi directly. It covers every screen,
the four steps to trace a wallet, what the three answers mean, what each button
gives you, and what the tool cannot do.

**Scope, on purpose.** Only the Help page is translated. The rest of the
interface, and above all the **evidence packet and the freeze request**, stay in
English. Those are documents an officer signs and sends, and an unreviewed
translation has no place in them.

**Honest about itself.** The Hindi opens with a note that it is a
**machine-drafted translation to be reviewed by a native Hindi speaker** before
it is relied on. The note also says why screen and button names stay in
English: the menu is in English, and a help page that uses names the menu does
not show sends the reader looking for something that is not there.

**Typography, done properly:**
- **The face.** Devanagari is set in Noto Sans Devanagari, added as a
  *fallback* in every font stack, so English text keeps its own face. The file
  is limited to Devanagari and not preloaded, so English pages never download
  it.
- **The spacing.** The interface's wide-tracked uppercase labels pulled
  Devanagari letters and vowel signs apart ("स हा य ता"). Hindi text now keeps
  normal spacing, and English menu names inside it keep their tracking.
- **Accessibility.** The Hindi is marked `lang="hi"`, so a screen reader reads
  it as Hindi.

## How to use it

Open **Help** (in the navigation or the footer) and press **हिन्दी**, or share
`/help?lang=hi` with a state cyber-cell officer.

To change the text, edit `app/help/content.ts`: English and Hindi sit side by
side in one structure. A screen added to one and not the other fails
`tests/help.test.mjs`.

## Verified

- **Tests** (`tests/help.test.mjs`):
  - Hindi and English have the same shape (same screens, menu names, order,
    steps, answers, buttons, limits);
  - every Hindi entry is in Devanagari and the review note is present;
  - every screen the help names exists in the navigation under that name (no
    such check existed before).
- **On a production build, 10 of 10:**
  - English unchanged, with the switch and no note; Hindi marked `lang="hi"`
    with the note and the headings;
  - a Hindi label at normal spacing while an English menu name keeps its
    tracking;
  - the Devanagari face **loaded** on the Hindi page and **not loaded** on an
    English page;
  - no sideways scroll at 375 and 784 px in either language; no console
    errors.
- The route and width sweep and the demo check are unchanged (32 of 32,
  14 of 14).

## Limits

- **Machine-drafted.** It needs review by a native speaker; the page says so.
- **Help page only.** The rest of the interface is English.
- The menu, screen names and button names stay in English on purpose.
