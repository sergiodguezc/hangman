# Phase 2.1 — Homepage UX and visual design exploration

Status: **proposal, awaiting review**. No application code, tests, SEO configuration or dependencies were changed. All artifacts are isolated in [`design-explorations/phase-2-1/`](../../design-explorations/phase-2-1/).

| Artifact | Path |
| --- | --- |
| Gallery (all screenshots side by side) | `design-explorations/phase-2-1/index.html` |
| Prototypes | `concept-a.html`, `concept-b.html` (`?estat=jugada` for the played state), `concept-c.html` |
| Shared prototype styles (tokens copied from `src/App.css`) | `prototype.css` |
| Screenshots | `design-explorations/phase-2-1/screenshots/*.png` |
| Re-render script (headless Firefox, no npm dependency) | `sh design-explorations/phase-2-1/capture.sh` |

## How this was verified, and its limits

- The current homepage was captured from the **existing local production build** (`dist/` + `dist-server/`, served with `PORT=3002 HOST=127.0.0.1 NODE_ENV=production node dist-server/server/server.js`). I did not rebuild, so the tracked `dist-server/` files are unchanged.
- All screenshots are real renders from **Firefox 157 headless** (`--screenshot`) at **1440×900** and **390×844**. They show the initial viewport only.
- **Mobile limitation:** the 390px captures use the desktop Firefox engine with a narrow window: device pixel ratio 1, no mobile user agent, no touch emulation, no safe-area insets, no Safari/iOS. The responsive *layout* was checked; behaviour on real phones was not. The iOS install card (only shown on iOS Safari) does not appear in any capture.
- **Font limitation:** Georgia and Inter are not installed on this machine, so both the production capture and the prototypes fall back to Noto Serif/Noto Sans. The comparisons are like-for-like, but on macOS/Windows the headings will render in Georgia, which is slightly narrower. Line breaks in the H1 may differ.
- The prototypes are static HTML/CSS that reproduce the production DOM and styles. They are not React. Links point at the real routes but do not resolve when the files are opened with `file://`.

## 1. Current-state analysis

![Current desktop](../../design-explorations/phase-2-1/screenshots/current-desktop.png)
![Current mobile](../../design-explorations/phase-2-1/screenshots/current-mobile.png)

**About the audit.** `docs/audit-2026-10-08.md` covers the functional defects F01–F06. It contains **no homepage or navigation findings**. The three problems below (A–C) come from the Phase 2.1 brief. I checked each one against the code and the screenshots.

### What works (keep)

- **The H1 and its SEO intent.** "Juga al penjat online en català." is clear and matches the query. It is the only heading on the page.
- **A strong, calm identity.** Dark green on warm paper, Georgia headings, the rotated "P" brand mark, the hand-drawn hangman, and very little chrome.
- **No friction before play.** There are no accounts or onboarding. The daily challenge starts in one click.
- **Mobile.** At 390px all three entry points are above the fold (observed), and "Com es juga?" moves to the footer.
- **The language toggle** (fixed CA/ES pill) is unobtrusive and consistent across pages.

### Friction (observed directly, unless marked otherwise)

1. **Multiplayer is the default action, but it has the longest path.** The filled green button is "Multijugador", which leads to a form (name, game language, rounds) and only pays off when a friend joins. Observed entry costs:
   - Paraula del dia: **1 click** to a playable board.
   - Aprendre: **2 clicks** (a setup card with the level remembered, then "Comença").
   - Multijugador: a form plus another person.
2. **Nothing says you can play alone.** The subtitle "Juga amb els amics o practica vocabulari mentre jugues" frames the solo mode as *practice*. "Aprendre català" names a learning tool, not a game. Its destination is titled **"Aprèn català"** (imperative), so the homepage and the page use different forms of the name. *Inference:* a visitor who wants a casual game has no explicit "alone" signal.
3. **The daily challenge looks like fine print.**
   - It is an underlined two-line text link with an 8px ring marker, centred under left-aligned buttons, so it reads as a footnote (observed).
   - Its 12px caption uses `--muted` on `--paper`, which is **4.31:1, below WCAG AA (4.5:1)** for small text (computed).
   - It never shows today's number or date, which is the hook of a daily game.
4. **The largest element does nothing.** The preview card takes about half the desktop viewport. It is `aria-hidden` and shows a finished (lost) game. It carries the identity well, but it neither shows nor starts anything.
5. **Two of the three entries are `<button>`s, not links.** Multijugador and Aprendre català cannot be opened in a new tab, show no URL on hover, and are not crawlable internal links. Only Paraula del dia is a real `<a href>`.
6. **Small inconsistencies** (outside the homepage, noted only):
   - The learning setup eyebrow "Català per a castellanoparlants" is hard-coded in Catalan (`src/pages/LearningPage.tsx:106`), so it also appears in the ES interface.
   - `public/sitemap.xml` lists `/multijugador/`, `/aprendre/` and `/com-es-juga/` with trailing slashes, while the canonicals have none.

Mode entry screens for reference: `screenshots/current-entry-paraula-del-dia.png`, `current-entry-aprendre.png`, `current-entry-multijugador.png`.

## 2. Existing visual identity (preserve)

| Element | Current value |
| --- | --- |
| Colours | `--green #244f3a`, `--green-dark #193d2b`, `--paper #f4f1e9`, `--cream #fffdf8`, `--line #ded9cd`, `--muted #69746c`, `--red #b84b43`; gallows `#5d7667`; letter rule `#728277`; focus ring `#e5a33c` |
| Type | Headings `700 Georgia, serif` (H1 `clamp(42px, 5.8vw, 64px)/.96`); body Inter/system; eyebrows 12px uppercase, `.1em` tracking |
| Buttons | `.primary-action`: filled green, 11px radius, 13×18 padding, soft green shadow. `.secondary-action`: white with 1px green border. `.text-button`: underlined muted text. Minimum height 48px on the homepage |
| Surfaces | Cream/paper cards, 1px `--line` border, 26–30px radius, `0 24px 70px rgba(49,58,48,.11)` shadow, faint radial highlight behind the page |
| Illustration | `HangmanDrawing` SVG (8px gallows, 7px figure) plus serif letters on underlines. The **letter-slot motif** is the most recognisable brand element after the "P" mark |
| Layout | 1180px shell, two-column hero, breakpoints at 1100px (stack) and 660px (mobile), 24px gutters, safe-area padding |
| Interaction | Arrow-in-circle back button, fixed CA/ES pill, `prefers-reduced-motion` respected |

All three concepts reuse these values unchanged. The one proposed token is **`--muted-strong: #5f6a62`**, a slightly darker caption tone with the same hue. It gives 5.0:1 on paper and fixes the AA failure for small captions.

## 3. Three proposals

Every concept keeps the title, meta description, canonical, routes, the H1 text, the "EL JOC DEL PENJAT" eyebrow, the "Com es juga?" link and the footer.

### Concept A — Minimal refinement

Same layout and the same decorative card. Only the action block and the subtitle change.

![Concept A desktop](../../design-explorations/phase-2-1/screenshots/concept-a-desktop.png)
![Concept A mobile](../../design-explorations/phase-2-1/screenshots/concept-a-mobile.png)

- **Hierarchy.** Filled **Paraula del dia** first: it is the fastest, zero-setup, solo game. Below it, two equal outline buttons side by side, **Aprendre català | Multijugador**.
- **Microcopy outside the buttons** (12.5px, `--muted-strong`):

  | Element | Catalan | Spanish |
  | --- | --- | --- |
  | Subtitle | Juga en solitari o amb amics i aprèn vocabulari mentre jugues. | Juega en solitario o con amigos y aprende vocabulario mientras juegas. |
  | Under Paraula del dia | #54 · La mateixa paraula per a tothom avui | #54 · La misma palabra para todos hoy |
  | Under Aprendre català | En solitari, amb pistes | En solitario, con pistas |
  | Under Multijugador | Amb amics, de 2 a 10 | Con amigos, de 2 a 10 |

- **First attention:** the H1, then the green "Paraula del dia" button.
- **Discovery:** daily through the primary button; solo through the "En solitari" caption; multiplayer through an equal-weight button that is still above the fold.
- **Rationale:** it fixes all three problems by changing the order and adding three short captions. The mode names stay as they are.

### Concept B — Play-first

The decorative card becomes **today's board**. The other modes are grouped by intent.

![Concept B desktop](../../design-explorations/phase-2-1/screenshots/concept-b-desktop.png)
![Concept B mobile](../../design-explorations/phase-2-1/screenshots/concept-b-mobile.png)

- **Card.** An `h2` "Paraula del dia", "#54 · dijous, 8 d'octubre" (the weekday is dropped on mobile), the empty gallows, today's real number of blank letter slots, "La mateixa paraula per a tothom avui", and a filled **Comença** button. This is the same first screen the daily page shows (`current-entry-paraula-del-dia.png`). The homepage now says "this is a game you can start now" without a paragraph.
- **Intent group.** Under the label "Com vols jugar?" are two outline buttons labelled by intent: **Juga en solitari** and **Juga amb amics**. The real mode names appear as captions: *Aprendre català* and *Multijugador*. This tests intent-first naming without renaming the modes or their pages.
- **Played-today state.** This uses the existing `readDailyAttempt` storage, reconstructed from the stored guesses.
  - The card shows the partial drawing and "Encertada amb 2 errors", plus the link "Veure el resultat · nova paraula demà". The word is never revealed on the homepage.
  - **The primary moves to "Juga en solitari"**, so a returning daily player is offered unlimited solo play next.

  ![Concept B played, desktop](../../design-explorations/phase-2-1/screenshots/concept-b-played-desktop.png)
  ![Concept B played, mobile](../../design-explorations/phase-2-1/screenshots/concept-b-played-mobile.png)

- **Mobile order:** H1, then today's card (compact: small gallows beside the slots, full-width button), then the subtitle, then "Com vols jugar?". Everything fits in 844px.
- **Copy:**

  | Element | Catalan | Spanish |
  | --- | --- | --- |
  | Subtitle | Sense registre. Juga en solitari o amb amics i aprèn vocabulari mentre jugues. | Sin registro. Juega en solitario o con amigos y aprende vocabulario mientras juegas. |
  | Group label | Com vols jugar? | ¿Cómo quieres jugar? |
  | Buttons | Juga en solitari / Juga amb amics | Juega en solitario / Juega con amigos |
  | Card button | Comença | Empieza |
  | Played result | Encertada amb N errors / No ha pogut ser | Acertada con N errores / No ha podido ser |
  | Played link | Veure el resultat · nova paraula demà | Ver el resultado · nueva palabra mañana |

  "No ha pogut ser" reuses an existing daily string.

- **First attention:** the card and its green "Comença" (desktop: the H1 and the card compete, and the card wins on size; mobile: the card sits right under the H1).
- **Discovery:** daily is the hero itself; solo is named literally; multiplayer is named literally, one row lower.
- **Rationale:** the biggest element on the page becomes the quickest game, with no new mode and no new copy. The daily number and date are the retention hook, and the played state gives a returning player something else to do.

### Concept C — Balanced discovery ("three ways to play")

A compact masthead and one shared board divided into three equal modes.

![Concept C desktop](../../design-explorations/phase-2-1/screenshots/concept-c-desktop.png)
![Concept C mobile](../../design-explorations/phase-2-1/screenshots/concept-c-mobile.png)

- **Masthead.** The H1 on one line (desktop), a short subtitle, and the hangman shrunk to a 150px emblem on the right.
- **Board.** One cream surface split by hairlines into three columns, ordered daily → solo → friends. Each column has an `h2`, one sentence, and a compact outline button: **Juga**, **Practica**, **Crea una sala**. No column gets a filled button.
- **Glimpses.** Each mode gets a small preview built from the **letter-slot motif**:
  - daily: today's 7 blank slots plus "#54 · dijous, 8 d'octubre";
  - learning: "A _ G U A" with "Pista · agua", showing how the Spanish hint works;
  - multiplayer: a room code "K7Q2M" on green rules.

  These reuse the board's own visual language instead of icons.
- **Mobile.** The board becomes a three-row list. Each whole row is the link (a stretched-link pattern; the visual button is hidden) with a chevron. Daily keeps its "#54". The small illustration moves below the list.
- **Copy:**

  | Mode | Catalan | Spanish |
  | --- | --- | --- |
  | Subtitle | Tres maneres de jugar, sense registre: cada dia, en solitari o amb amics. | Tres formas de jugar, sin registro: cada día, en solitario o con amigos. |
  | Daily | Paraula del dia · "Una paraula nova cada dia, la mateixa per a tothom." · Juga | Palabra del día · "Una palabra nueva cada día, la misma para todos." · Juega |
  | Learning | Aprendre català · "Partides en solitari amb pista en castellà i definició." · Practica | Aprender catalán · "Partidas en solitario con pista en castellano y definición." · Practica |
  | Multiplayer | Multijugador · "Crea una sala i comparteix el codi. De 2 a 10 jugadors." · Crea una sala | Multijugador · "Crea una sala y comparte el código. De 2 a 10 jugadores." · Crea una sala |

- **First attention:** the one-line H1, then the board read left to right. Daily is first in reading order but not visually louder than the others.
- **Rationale:** it is the most even and most "editorial" composition, and it shows what each mode *feels like* before the click.

## 4. Comparison

| Criterion | A — Minimal | B — Play-first | C — Balanced |
| --- | --- | --- | --- |
| 1. First-visit clarity | Good: one obvious default plus two captioned options | **Best:** the board makes "this is a game, start here" self-evident | Good: three clear options, but no default |
| 2. Ease of starting | 1 click (daily) | **1 click; the target is the largest element** | 1 click, but the visitor must choose first |
| 3. Solo discoverability | Caption "En solitari" (small) | **Button text says "Juga en solitari"** | The sentence says "en solitari"; the button says "Practica" |
| 4. Daily discoverability | Primary button plus "#54" | **Hero card, number, date and played state** | Equal panel with number, date and slots |
| 5. Multiplayer visibility | Equal secondary, above the fold | Secondary, above the fold ("Juga amb amics") | **Equal panel**, most explicit ("Crea una sala") |
| 6. Visual consistency | **Nearly identical** | High: the same card, drawing and slots, now functional | Medium-high: same tokens, but a new composition and the illustration demoted |
| 7. Mobile usability | Good: all entries above the fold; two buttons per row are tight at 320px | **Good:** the card is reachable at thumb height; all entries above the fold at 390px | Good: a list is the most familiar mobile pattern; the rows are large tap targets |
| 8. Accessibility | Real links, AA captions | Real links, AA captions; the card has an `h2`; the "Comença" link needs a described name (prototype: `aria-describedby`) | Real links, three `h2`s, labelled stretched links; the whole-row target is good, but the chevron is the only visual cue on mobile |
| 9. Implementation complexity | **Small:** `HomePage.tsx` markup plus about 20 CSS lines | Medium: plus a pure daily-summary helper (existing `getDailyChallenge`, `readDailyAttempt`, replay), card markup and CSS, and unit tests | Medium-large: a new layout, three previews, a distinct mobile list pattern, and more CSS to maintain |
| 10. SEO/navigation risk | **Very low:** H1 and meta unchanged | Low: H1 unchanged; adds one `h2`; the daily link becomes more prominent | Low: H1 unchanged; adds three `h2`s; more homepage text about the modes |

**Advantages and trade-offs**

**A — Minimal refinement**
- **Advantages:** the safest option and quick to ship. It keeps the illustration exactly, and it still fixes the hierarchy, the daily prominence and the solo signal.
- **Trade-offs:** the half-screen decorative card still does no work. The solo signal relies on a 12.5px caption. Side-by-side secondary buttons get tight below 360px.

**B — Play-first**
- **Advantages:**
  - It is the clearest "play now" signal, and it gives the daily challenge a real retention surface (number, date, played state).
  - The illustration is kept *and* made useful.
  - The intent labels answer "can I play alone?" directly.
- **Trade-offs:**
  - The card no longer shows the full drawing with the "_ E _ J _ T" (PENJAT) wordplay. Before playing, it shows an empty gallows.
  - "Juga en solitari" leads to a page titled "Aprèn català". The caption sets the expectation, but the wording mismatch remains. Aligning the learning page copy would be a separate decision.
  - The homepage now reads local storage and today's challenge, which adds logic and tests.
  - The anchor text "Comença" is weak on its own; see §8.

**C — Balanced discovery**
- **Advantages:** the most elegant and even presentation, and the most explicit about multiplayer. The glimpses teach each mode visually without paragraphs.
- **Trade-offs:**
  - With no default action, every visitor has to choose. That is more decision cost for "I just want to play".
  - The identity illustration shrinks to an emblem.
  - It needs the most new CSS.
  - The mobile list hides the compact buttons the user has preferred. The rows are buttons in effect, but they carry descriptive text.

## 5. Recommendation

**Adopt Concept B, and deliver it incrementally through Concept A's quick wins.**

- **The hierarchy problem is really "which game is fastest?"** Paraula del dia is the only zero-setup game, and it is free to make it the hero. B does that by turning the existing illustration card, which visitors already notice, into the starting point. It adds no new visual element.
- **It solves daily discoverability and retention together.** The number and date make the game feel live, and the played state hands returning players on to unlimited solo play. All of this uses data the client already has.
- **It is the most direct answer to "can I play alone?"** and it does not rename any mode or page.
- **It stays visually closest to Penjat after A,** at a moderate and testable cost.
- **Borrow from A:** the side-by-side outline pair with captions, the `--muted-strong` caption tone, and the step order below, so value ships early.
- **Borrow from C (optional, later):** the letter-slot "glimpse" idea, if the solo button ever needs a visual hint.

**Naming:** I recommend shipping B with the **intent labels** ("Juga en solitari / Juga amb amics") and the mode names as captions. If you would rather not introduce the mismatch with the "Aprèn català" page, the fallback is A's labels inside B's layout ("Aprendre català" with the caption "En solitari, amb pistes"). That is a one-string change.

I do not recommend a "classic" solo mode in this phase. If one is wanted later, the "Juga en solitari" slot is where it would go. **That is future work and outside this scope.**

## 6. Proposed implementation plan (after approval; not executed)

Each step is independently shippable and verifiable.

1. **Make the mode entries real links.**
   - Change the Multijugador and Aprendre `<button>`s in `src/pages/HomePage.tsx` to `<a href="/multijugador">` and `<a href="/aprendre">`, using the existing daily-link pattern (`preventDefault` plus the callback).
   - No visual change.
   - Add a focused static-markup test asserting the three hrefs.
2. **A's hierarchy and captions.**
   - Reorder the actions: daily is filled, then the outline pair with captions.
   - Add the `--muted-strong` token.
   - Add the CA/ES strings to `homeCopy` (keeping both languages in sync).
   - CSS stays within the existing `.home-actions--modes` rules and the 660px breakpoint.
3. **Daily summary helper.**
   - Add a pure `homeDailySummary(date, storage)` in `src/daily/` returning `{ number, displayDate, slots, status: 'new' | 'won' | 'lost', errors }`.
   - Reuse `getDailyChallenge`, `readDailyAttempt` and the existing guess replay. Never trust stored flags, and never return the word.
   - Slots come from the display mask of an empty guess set, so spaces and punctuation in multi-word entries match the daily board.
   - Unit tests go in `test:daily` (new / won / lost / corrupt storage / different date).
4. **Today's card.**
   - Replace the `home-preview` aside with a `<section aria-labelledby>` card that reuses `HangmanDrawing` (errors = 0 or the replayed count) and the `.preview-letter` styles.
   - Visible link text "Comença", with the `h2` also linked or included in the accessible name.
   - Played state: show the result line plus the "Veure el resultat" link, and swap the primary to the solo link.
5. **Intent group.** Add "Com vols jugar?" with the two intent-labelled links and mode-name captions, plus the mobile order (H1 → card → subtitle → group).
6. **Verification.**
   - `npm run lint`, both `tsc` checks, `test:daily`, `test:localization`, `test:seo` (H1/meta/canonical unchanged), `test:browser`.
   - Re-capture at 1440/390 in CA and ES with `capture.sh`.
   - Keyboard-only pass (tab order: brand → help → card → group → footer), 200% zoom, and the reduced-motion check.
   - Ideally one real iOS/Android device check.
7. **Docs.** Note in `docs/architecture.md` that the homepage now *reads* the daily storage (read-only), and record the screenshots in a task report.

Known edge to keep: the card is computed on mount, so it has the same midnight-rollover behaviour already documented for the daily page.

## 7. Out of scope but observed

- The hard-coded Catalan eyebrow on the learning setup screen in the ES interface (`LearningPage.tsx:106`).
- The "Aprendre català" (homepage) vs "Aprèn català" (page) naming.
- The sitemap trailing-slash vs canonical mismatch.

Each deserves its own small, separately reviewed change.

## 8. SEO and technical notes

- **Unchanged in all concepts:**
  - titles, meta descriptions, Open Graph/Twitter tags, canonicals, routes and the sitemap;
  - the H1 text in both languages and the eyebrow;
  - the "Com es juga?" link. The homepage has no structured data today, and none is added.
- **Intentional changes, and why:**
  - Converting the two mode `<button>`s into `<a href>` links adds crawlable internal links to `/multijugador` and `/aprendre`, and enables open-in-new-tab. This is expected to help or be neutral.
  - B adds one `h2` and C adds three. Both sit beneath the unchanged H1 and describe the page's existing destinations.
  - For B, keep descriptive anchor text for `/paraula-del-dia`: link the "Paraula del dia" heading as well as "Comença", or use "Juga la paraula del dia" as the accessible name.
- **Rendering.** The homepage content is rendered client-side, and the server injects only metadata. No server-rendered content changes are needed.
- **Tests.** The existing browser and SEO tests navigate by URL or check metadata. None relies on the homepage button text, so the risk to existing tests is low (checked: `tests/seo-test.mjs`, `scripts/browser-audit-test.mjs`).
- **Dependencies and bundle.** No new dependencies. B's helper only uses modules already in the main bundle (vocabulary and daily rules are imported eagerly today), so the bundle size should not change materially.
