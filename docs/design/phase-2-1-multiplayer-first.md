# Phase 2.1 — Multiplayer-first homepage refinement

Status: **proposal, awaiting approval**. No application code, tests, SEO configuration or dependencies were changed. This refines [the Phase 2.1 exploration](phase-2-1-homepage.md) after the product decision that **Multijugador is Penjat's primary mode**. The earlier artifacts in `design-explorations/phase-2-1/` are untouched.

| Artifact | Path (under `design-explorations/phase-2-1-multiplayer-first/`) |
| --- | --- |
| Gallery: current, D1 and D2 side by side, with width toggles | `index.html` |
| Prototypes (`?hl=es` for Spanish; D2 also `?estat=jugada`) | `d1.html`, `d2.html` |
| Shared styles (production tokens; additions marked "new") / helpers | `prototype.css`, `prototype.js` |
| Screenshots and measured layout metrics | `screenshots/*.png`, `screenshots/metrics.json` |
| Re-capture script (Node built-ins and Firefox only) | `node design-explorations/phase-2-1-multiplayer-first/capture.mjs` (add `CURRENT_URL=http://127.0.0.1:3002/` to include production) |

## How this was verified, and its limits

The previous exploration resized a desktop Firefox window. This round uses **Firefox 157 driven through WebDriver BiDi** (`capture.mjs`), with real emulation:

| Name | Viewport | DPR | User agent | Why |
| --- | --- | --- | --- | --- |
| desktop | 1440×900 | 1 | desktop | brief |
| laptop | 1024×768 | 1 | desktop | added: production's 1100px breakpoint |
| mobile | 390×844 | 3 | iPhone Safari | brief; iPhone 12–15 viewport |
| narrow | 320×568 | 2 | Android Chrome | brief; smallest supported width |

- Each capture uses a fresh browser user context, so there is no stored state. Captures were taken on 2026-10-08, so the daily challenge is **#54**.
- `metrics.json` records, for every capture: horizontal overflow, the position of each entry point relative to the fold, the smallest mode target, the smallest caption size, and whether entries are real links.
- **Production reference:** the existing local build (`dist/`, `dist-server/`) served on `127.0.0.1:3002`. I did not rebuild. The build post-dates every homepage-menu change: the only later `HomePage.tsx` change concerns invitations.
- **The iPhone user agent triggers production's iOS install card.** Every first-time iPhone Safari visitor sees it, and the earlier captures never showed it. Both prototypes reproduce it with the same detection logic.
- **Limits:**
  - Firefox 157 cannot emulate touch (`emulation.setTouchOverride` is unsupported), so `(pointer: coarse)` stays false.
  - The rendering engine is Gecko, not WebKit or Blink. Safe-area insets are not emulated, and nothing was tried on a physical device.
  - Georgia and Inter are not installed here. Production and prototypes both fall back to Noto Serif/Noto Sans, so the comparison is like-for-like, but H1 line breaks may differ on macOS/Windows.
  - The prototypes draw the hangman static; production sways it. Prototype links point at real routes but do not resolve from `file://`.

## Design rationale

Penjat should read as **a hangman game you play with friends**. Vocabulary learning and the daily word sit alongside it. In practice that means:

1. **One unmistakable primary action, always Multijugador.** It stays the only filled green control at every width. It never changes with the daily state, because the brief rules out Concept B's identity switch.
2. **The current homepage is already close.** Multijugador is the green button and the subtitle already leads with friends. The real defects are smaller:
   - the daily entry reads as a footnote: a centred 12px underlined link with a 4.31:1 caption;
   - two of the three entries are `<button>`s, not links;
   - the `aria-label` sits on a plain `div`, so assistive technology ignores it;
   - captions are below AA contrast;
   - **at 661–1100px the illustration stacks above the copy, which puts every action below the fold.** Measured at 1024×768, Multijugador sits at y=972–1020 of 768.
3. **Explain each mode in a few words outside the button.** Labels stay compact. That follows the standing preference for compact buttons with microcopy outside.
4. **Give the daily entry a hook (today's number) but no fill and no green border,** so it never competes with the multiplayer button.
5. **Keep the identity as it is:** the illustration card with `_ E _ J _ T`, the H1, the eyebrow, the palette, Georgia and the P mark. Neither variant adds an icon, badge, gradient, animation or new colour.

### Naming: "Multijugador" or "Juga amb amics"?

| | **Multijugador** (D1) | **Juga amb amics** (D2) |
| --- | --- | --- |
| Clarity for a first visit | A category name. On a game site it can suggest public matchmaking with strangers, which Penjat does not have. | Says *who* and *what*. It sets the right expectation: a private room you share with people you know. |
| Brand positioning | Neutral | States the differentiator in the most prominent text on the page |
| Destination consistency | Matches the route `/multijugador`, the "Com es juga?" section and "Ves a Multijugador" | Matches the destination's SEO title "Penjat multijugador — **Juga online amb amics**" and the homepage meta description ("juga amb amics"). The destination's own first action is "Crea una partida", which follows naturally. |
| Fit with neighbours | All three entries are names: Multijugador / Aprendre català / Paraula del dia | Imperative next to the infinitive "Aprendre català". This is a small grammatical asymmetry, softened by the different visual tier. |
| Length (ES) | Multijugador | Juega con amigos (fits at 320px; see `d2-narrow-es-full.png`) |

**Recommendation: "Juga amb amics" / "Juega con amigos", with "Multijugador" kept as the caption.** The mode name stays learnable and matches the URL and the help page. The button says what the visitor will actually do. This is a single string, so it can be swapped into either variant.

## D1 — Conservative evolution

![D1 desktop 1440×900](../../design-explorations/phase-2-1-multiplayer-first/screenshots/d1-desktop.png)

| 390×844 (iPhone) | 320 full page (Android) | 390 ES |
| --- | --- | --- |
| ![D1 mobile](../../design-explorations/phase-2-1-multiplayer-first/screenshots/d1-mobile.png) | ![D1 narrow](../../design-explorations/phase-2-1-multiplayer-first/screenshots/d1-narrow-full.png) | ![D1 mobile ES](../../design-explorations/phase-2-1-multiplayer-first/screenshots/d1-mobile-es.png) |

**Layout:**
- The production composition, sizes and breakpoints are unchanged: two columns, the 360px action stack, and the same illustration card.
- Changes:
  1. A centred 13px caption under each button.
  2. The daily footnote becomes a **typographic row** under a hairline: a serif "Paraula del dia" with a green "#54", a caption, and an arrow. The whole row is a 60px link. It has no fill and no box, so it reads as "also here".
  3. All three entries are `<a href>` inside `<nav aria-label="Modes de joc"><ul>`, with each caption linked by `aria-describedby`.
  4. The eyebrow, subtitle, captions and help link use `--muted-strong` (`#5f6a62`, 5.00:1 on paper).
  5. The two-column layout holds down to 861px. Below that the card stacks *after* the copy, which fixes the 1024px fold problem (see `d1-laptop.png`).

**Copy** (only the captions and the daily text are new; everything else is current copy):

| Element | Catalan | Spanish |
| --- | --- | --- |
| Subtitle (unchanged) | Juga amb els amics o practica vocabulari mentre jugues. | Juega con tus amigos o practica vocabulario mientras juegas. |
| Primary | **Multijugador** | **Multijugador** |
| Caption | Crea una sala i convida els amics | Crea una sala e invita a tus amigos |
| Secondary | **Aprendre català** | **Aprender catalán** |
| Caption | Juga en solitari amb pistes | Juega en solitario con pistas |
| Daily row | Paraula del dia **#54** · Nova cada dia, la mateixa per a tothom | Palabra del día **#54** · Nueva cada día, la misma para todos |

**How it reinforces multiplayer:**
- It keeps Multijugador as the first and only filled action.
- The caption says what happens next (create a room, invite friends), which answers the first-time question "with whom?".
- The bigger daily row stays below a hairline, visually outside the button group.

**Strengths:**
- Lowest risk: it is the current page, made clearer.
- It fixes semantics, contrast, the hidden daily entry and the tablet fold.
- The number comes from `getDailyChallenge()`, which `HomePage.tsx`'s module already imports, so no storage read is needed.

**Weaknesses:**
- The full-width stacked buttons are not compact.
- "Multijugador" still leaves "with friends or strangers?" to the caption.
- At 320×568 the daily row starts at y=521 and is cut by the fold (production's smaller link fits, ending at 537). It is still visibly there and invites a scroll.

**Implementation complexity: small.**
- `HomePage.tsx` markup (about 25 lines), 4 new string pairs in `homeCopy`, and about 25 CSS lines in `App.css` (one token and the breakpoint change).
- One static-markup test.

## D2 — Refined multiplayer-first composition

![D2 desktop 1440×900](../../design-explorations/phase-2-1-multiplayer-first/screenshots/d2-desktop.png)

| 390×844 (iPhone) | 320 full page (Android) | 320 ES full page |
| --- | --- | --- |
| ![D2 mobile](../../design-explorations/phase-2-1-multiplayer-first/screenshots/d2-mobile.png) | ![D2 narrow](../../design-explorations/phase-2-1-multiplayer-first/screenshots/d2-narrow-full.png) | ![D2 narrow ES](../../design-explorations/phase-2-1-multiplayer-first/screenshots/d2-narrow-es-full.png) |

**Layout:**
- Same identity and two columns, rebalanced to 1.1fr / 0.9fr with a 48px gap. The illustration card is capped at 480px instead of 520px, so the action area gets more room without the picture losing its role.
- **Compact action pair (from Concept A):**
  - a filled **Juga amb amics** (min-width 200px) beside an outline **Aprendre català** at natural width;
  - each has a centred caption.
  - Primary-left, filled and wider gives a clear hierarchy without any added size.
- **Daily mini-card (a calmer take on Concept C's glimpses):**
  - It spans the pair's width (385px) and sits on a translucent cream surface with a hairline border and no shadow.
  - On the left, **#54** sits on a letter-slot rule, the board's own motif.
  - Next to it are a serif "Paraula del dia" and the line "8 d'octubre · igual per a tothom". "Juga →" is on the right.
  - It is visibly a thing to do, yet lighter than both buttons: no fill, no green border.
- **Subtitle:** it leads with the multiplayer *mechanic* instead of a list of modes.
- **Mobile (≤660px):**
  - the pair stacks to full width for thumb reach, and the card follows;
  - at ≤380px the card's "Juga" word drops, leaving only the arrow, so "Palabra del día" stays on one line in Spanish.
  - Above 660px it uses the same breakpoint fix as D1 (`d2-laptop.png`).
- **"Already played" state (optional), reached with `?estat=jugada`:**
  - Only the card's text changes: "Encertada amb 2 errors · nova paraula demà" and "Resultat →".
  - The primary action and the layout do not move. Penjat stays multiplayer-first for returning daily players, and they still get a reason to come back tomorrow. The word is never shown.

  ![D2 played desktop](../../design-explorations/phase-2-1-multiplayer-first/screenshots/d2-played-desktop.png)

**Copy** (new text marked with \*):

| Element | Catalan | Spanish |
| --- | --- | --- |
| Subtitle\* | Tria una paraula i repta els amics a endevinar-la. Sense registre. | Elige una palabra y reta a tus amigos a adivinarla. Sin registro. |
| Primary\* | **Juga amb amics** | **Juega con amigos** |
| Caption\* | Multijugador · de 2 a 10 | Multijugador · de 2 a 10 |
| Secondary | **Aprendre català** | **Aprender catalán** |
| Caption\* | En solitari, amb pistes | En solitario, con pistas |
| Daily card\* | Paraula del dia · #54 · 8 d'octubre · igual per a tothom · Juga → | Palabra del día · #54 · 8 de octubre · igual para todos · Juega → |
| Played (won)\* | Encertada amb *N errors* · nova paraula demà · Resultat → | Acertada con *N errores* · nueva palabra mañana · Resultado → |
| Played (lost) | No ha pogut ser · nova paraula demà (reuses the existing `lost` string) | No ha podido ser · nueva palabra mañana |

The error count should reuse the existing `dailyTranslations.mistakes(n)` helper, which already handles singular and plural.

Two notes on the copy:
- "Tria una paraula i repta els amics" is accurate to the rules: the setter rotates, so everyone chooses and everyone guesses. "Repta" also echoes the existing "Repta un amic" invite copy.
- "Sense registre" is true (rooms need only a name) and removes the most common hesitation before inviting friends.

**How it reinforces multiplayer:**
- The button text names the experience.
- The subtitle describes the multiplayer mechanic before anything else.
- The primary reads first in a left-to-right pair.
- The daily card is deliberately the quietest surface in the group.

**Considered and rejected: a room-code motif ("Sala K7Q2M") in the illustration card.** It signals rooms nicely, but a first-time visitor could reasonably try to *use* the code. A fake identifier in the hero is a usability risk, and it adds decoration.

**Strengths:**
- Compact buttons, the clearest hierarchy, and the most explicit multiplayer positioning.
- A daily entry with a live hook that stays clearly subordinate.
- The played state helps retention without changing the page's identity.
- It is still visibly the same Penjat.

**Weaknesses:**
- More new copy to keep in sync, including a new subtitle.
- The imperative/infinitive pair "Juga amb amics / Aprendre català".
- On mobile it converges with D1. The differences are the label, the subtitle and the card. Stacking is the right thumb pattern, so this is accepted.
- At 320×568 the card starts at y=514, cut by the fold, as in D1.
- The played state needs a read-only storage summary.

**Implementation complexity:**
- **Small to medium without the played state:** markup, about 45 CSS lines and 6 new string pairs.
- **Medium with it:** add a pure `homeDailySummary()` helper with unit tests.

## Comparison

Measured values come from `screenshots/metrics.json`. *y* values are in CSS pixels from the top of the viewport.

| Criterion | Current | D1 | D2 |
| --- | --- | --- | --- |
| 1. Multiplayer prominence | Filled, first. Label is a category. | Same, plus a caption saying what happens | **Filled, first, named as the experience, and backed by the subtitle** |
| 2. Clarity for a first visit | Three entries, no explanations | Every entry captioned | **Captioned, plus a subtitle explaining the mechanic and "sense registre"** |
| 3. Aprendre català discoverable | Outline button, no hint that it is solo or has hints | Outline plus "Juga en solitari amb pistes" | Outline, side by side with the primary on desktop, plus "En solitari, amb pistes" |
| 4. Paraula del dia discoverable | Underlined footnote, no number, caption at 4.31:1 | Serif row with #54, readable caption | **Mini-card with #54, the date and the played state**, still lighter than both buttons |
| 5. Identity preserved | — | **Identical** | Near-identical: same card (slightly smaller), same tokens |
| 6. Simplicity and elegance | Simple. The footnote looks unfinished. | Simple, tidy | **Most polished.** Compact controls, one quiet grouped surface |
| 7. Mobile (390 / 320) | Primary at 365–413 / 345–393. Daily ends at 541 / 537. | Primary at the same y. Daily at 541–601 (390); at 320×568 it starts at 521 (partly below the fold). | Primary at the same y. Daily at 534–598 (390); starts at 514 at 320 (partly below the fold). |
| 7b. Tablet / small laptop (1024×768) | **Primary at 972–1020: below the fold** | Primary at 463–511 | Primary at 496–544 |
| Horizontal overflow (all captured widths, CA/ES) | None | None | None |
| 8. Accessibility and semantics | 2 of 3 entries are `<button>`s; `aria-label` on a plain div; captions 12px at 4.31:1 | Real links in a labelled `nav`/`ul`; `aria-describedby` captions; 13px at ≥5.0:1; all targets ≥48px | Same as D1, plus a whole-card link whose number is read via visually hidden text (the folio is `aria-hidden`) |
| 9. Implementation complexity | — | **Small** | Small–medium; medium with the played state |
| 10. SEO preservation | — | H1, title, meta, canonical unchanged. Adds crawlable internal links. No new headings. | Same as D1 |

Two observations:

- **Neither variant moves the primary on a phone.** At 390 and 320 the multiplayer button sits exactly where it is today: 365px and 345px from the top, well inside the first screen. The mobile improvements are about distinguishing the options, captions and contrast, not about speed to the CTA.
- **Making the daily challenge more visible did not require making it the main action.** In both variants it gains a number and readable text, yet it remains the only entry without a filled or green-bordered control.

## Recommendation

**Adopt D2's composition with the "Juga amb amics" label, and ship it through D1's steps first.**

- D1 alone would be a perfectly good low-risk release. It fixes every defect found: semantics, contrast, the footnote-like daily entry and the 1024px fold.
- D2 is better on the three things this phase is about:
  1. it **says** multiplayer is the point (label and subtitle);
  2. it uses the compact controls Penjat's style calls for;
  3. it gives the daily challenge a proper but subordinate home.
- It does this without new colours, icons or structure, and the illustration stays in place.
- **Ship the played state last and treat it as optional.** The card works without it.
- If you would rather keep the button named "Multijugador", D2 still works: swap the label and the caption ("Multijugador" / "Juga amb amics · de 2 a 10").

Recommended combination, element by element:

| Element | Choice |
| --- | --- |
| Layout and breakpoints | D2 (with the shared 661–1100px fix) |
| Primary label and caption | Juga amb amics · "Multijugador · de 2 a 10" |
| Subtitle | D2's mechanic-led line |
| Learning caption | "En solitari, amb pistes". D1's "Juga en solitari amb pistes" is the fallback if "solitari" alone feels too terse in testing. |
| Daily | D2 mini-card. The played state is a later step. |
| Contrast, semantics | Shared |

## Implementation roadmap (after approval; not executed)

Each step is a separate, reviewable change with its own check. Steps 1–3 deliver D1's value. Steps 4–6 complete D2.

1. **Real links in a labelled nav.**
   - In `src/pages/HomePage.tsx`, replace the two mode `<button>`s and the daily `<a>` with `<a href>` elements inside `<nav aria-label><ul>`.
   - Intercept only plain primary clicks:

     ```js
     if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
     event.preventDefault()
     ```

     Today's daily link always calls `preventDefault`, which blocks Ctrl/Cmd-click and opening in a new tab.
   - Use `/multijugador`, `/aprendre` and `DAILY_CHALLENGE_PUBLIC_PATH`. Make "Com es juga?" an `<a href="/com-es-juga">` with a 44px target.
   - *Verify:* a new static-markup test asserting the hrefs and that the `nav` is labelled; `npm run lint`; both `tsc` checks; `npm run test:browser` (navigation and history).
2. **Contrast token.**
   - Add `--muted-strong: #5f6a62` to `App.css`.
   - Apply it to `.home-copy .eyebrow`, `.home-copy p`, the captions and `.home-help-link`.
   - *Verify:* computed ratios (5.00:1 on `--paper`, 5.55:1 on `--cream`), plus a visual check.
3. **Tablet fold fix.**
   - In the `max-width: 1100px` block, stop stacking the hero with `.home-preview { order: -1 }`.
   - Keep two columns down to 861px; below that, stack the card after the copy at 360px wide.
   - *Verify:* re-capture at 1024×768 and confirm the primary is above the fold (currently at y=972).
4. **Captions and copy (CA + ES together).**
   - Add the label, caption and subtitle strings to `homeCopy`, keeping both languages in sync.
   - Add the captions with `aria-describedby`.
   - *Verify:* `npm run test:localization`, a static-markup test for both languages, and `npm run test:seo`, which must show the H1, title, meta and canonical unchanged.
5. **Action pair and daily mini-card.**
   - Add the D2 CSS for the pair and the card.
   - The number and date come from `getDailyChallenge()`, read once on mount, matching the daily page's documented midnight-rollover behaviour.
   - *Verify:* re-capture at 1440, 1024, 390 and 320 in CA and ES with `capture.mjs` adapted to the local URL, and check no horizontal overflow.
   - Do a keyboard pass: the tab order should be the help link, primary, learning, daily, then the footer. Also check 200% zoom.
6. **(Optional) Played state.**
   - Add a pure `homeDailySummary(date, storage)` in `src/daily/` that returns `{ number, displayDate, status: 'new' | 'won' | 'lost', errors }` by replaying the stored guesses. It reuses `readDailyAttempt` and the existing replay, never trusts stored flags, and never returns the word.
   - The card switches its line and action text. **The primary action never changes.**
   - *Verify:* unit tests in `test:daily` covering new, won, lost, corrupt storage and a different date. Note in `docs/architecture.md` that the homepage reads daily storage, read-only.

None of the steps touches routes, game logic, multiplayer mechanics, SEO metadata, canonicals, structured data or dependencies. The homepage keeps a single H1 and adds no headings.

## Open points (outside this proposal)

- `.home-domain` ("penjat.cat", `#9a9f9b`) is 2.38:1. It is left as is because it acts as a wordmark. Confirm whether it should count as text.
- The prototypes' CA/ES pill uses `--muted-strong` for the inactive language. In production that pill is global (`App.css`, every page), so changing it there is a separate, app-wide decision.
- Still open from the first report:
  - the "Aprendre català" (homepage) vs "Aprèn català" (page title) naming;
  - the hard-coded Catalan eyebrow on the learning setup screen in the ES interface;
  - the sitemap trailing slashes.
