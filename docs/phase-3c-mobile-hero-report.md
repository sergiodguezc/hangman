# Phase 3C — Mobile homepage hero

Status: implemented in the working tree on 2026-10-09. Nothing has been committed, pushed or deployed. The Phase 2A–3B uncommitted work is preserved. `server/`, `dist-server/`, `shared/`, the protocol, scoring, persistence and vocabulary are untouched.

## What changed

On phones (≤599px, `37.4375em`), the homepage hero now reads top to bottom:

1. the header (unchanged);
2. the eyebrow, the SEO `<h1>` and the lede (unchanged text);
3. the barretina character, centred, with the letter slots;
4. **Jugar**, a full-width link to `/multijugador`;
5. **Aprèn català** and **Paraula del dia**, two equal cards side by side;
6. the rest of the page, unchanged ("Tria com vols jugar" cards and footer).

| Element | Treatment |
| --- | --- |
| Illustration | `HangmanDrawing` as before, without the preview card frame or the "6 lletres" sticker. About 184px wide, 152px below 360px. |
| Jugar | 104px tall. Magrana background, 2px ink outline, 4px offset shadow, radius `--radius-card`. Shows a play badge, "Jugar" in Fraunces 800 at `--text-display` (34px at 390px), the caption "Amb amics · de 2 a 10" / "Con amigos · de 2 a 10", and an arrow. The whole surface is a single link: hover lifts and darkens it, a press moves it in, and focus shows the global ink ring with a gap. |
| Secondary cards | 68px tall, equal width and height (grid `1fr 1fr`, stretched rows). Fraunces 700 at 18px, a 2px outline with a 2px shadow and the inner radius. Tints are `--oliva-surface` and `--warning-surface`. Icons sit in circles. The daily card carries a small saffron `#55` tag, plus "✓" (spoken "Jugada") once today's challenge has been played. It never shows the word. |

- **Destinations and semantics.** Jugar keeps the existing main action, multiplayer room creation; no solo mode was invented. The new `<nav class="home-quick">` has the same accessible name ("Modes de joc" / "Modos de juego") as `.home-modes`. Phones hide `.home-modes` and wider screens hide `.home-quick` with `display: none`, so only one of the two is ever rendered, focusable or announced. The homepage has no analytics instrumentation to preserve.
- **Narrow screens and large text.**
  - Below 375px, the card icons lose their circle, so "Aprende catalán" and "Paraula del dia" keep whole words.
  - Below 360px, the character shrinks and the Jugar arrow is hidden.
  - Below 320 CSS px, which includes 200% text on phones, the cards stack and Jugar centres its badge, label and caption.
- **Desktop and tablet.** No rule outside the phone media queries changed. The new nav is `display: none` at 600px and above.
- **Copy.** There are four new keys in `src/home/i18n.ts`, in CA and ES: `play`, `playCaption`, `quickLearning` and `dailyPlayed`. "Aprende catalán" matches the Spanish header navigation.

## Evidence

All captures are local and untracked, under `design-explorations/phase-3c/`.

- **Phone before/after sheets.** One sheet per language and size (CA/ES × 320, 375, 390 and 430px) in `comparisons/`, e.g. [`ca-390x844`](../design-explorations/phase-3c/comparisons/ca-390x844.png) and [`es-375x812`](../design-explorations/phase-3c/comparisons/es-375x812.png).
- **Raw captures.** Viewport and full-page shots are in `screenshots/before` and `screenshots/after`. Also captured:
  - real 200% text (a Firefox profile with a 32px default font) in `screenshots/text200`;
  - fallback fonts (Georgia and the metric fallback) in `screenshots/fallback`;
  - focus and pressed states in `screenshots/states`.
- **Desktop unchanged.** The 768×1024, 1440×900 and 1920×1080 viewport and full-page captures are pixel-identical to the Phase 3B baseline in CA and ES (`logs/desktop-pixel-diff.log`).
- **Geometry at 390×844.**
  - The headline ends at y=202 and the character spans y=285–484.
  - Jugar is at y=536–640 and spans 346px, the full content width.
  - Both cards are at y=656–724 and measure 167×68 each, so all three actions sit in the first viewport.
  - At 375×812 the layout is the same, with 160×68 cards. 320×568 scrolls naturally: Jugar starts at y=501.
- **Contrast.**
  - Jugar label and caption on magrana: 4.87:1, rising to 6.77:1 on hover.
  - Card labels: 15.3:1.
  - Daily tag: 10.6:1.

## Validation

| Check | Result |
| --- | --- |
| `npm run build`, `npm run lint` | pass. Lint shows 3 warnings, all in Phase 2.1 exploration scripts that predate this phase. |
| `tsc -b`, `tsc -p server/tsconfig.json --noEmit` | pass |
| `test:learning`, `vocabulary`, `daily`, `invitation`, `localization`, `multiplayer-ui`, `match-results`, `character` | pass |
| `test:game`, `chat`, `lifecycle`, `match`, `n-player` (`dist-server` unchanged) | pass |
| `test:vocab`, `vocab:validate` | pass |
| `test:e2e` (dedicated server), `test:seo` | pass |
| `test:browser` (Firefox 157 BiDi) | pass |
| Reduced motion (`ui.prefersReducedMotion`), `design-explorations/phase-3c/checks.mjs --reduced` | No hover/press transforms on Jugar, the cards or the arrow; 0s transitions. |
| 200% text and fallback fonts at 320–1440px | No document overflow, no clipped labels and no mid-word breaks. |

### Tests changed and added

- **`scripts/homepage-browser-checks.mjs`.** The phone branch now asserts the new hero:
  - which navigation is rendered;
  - element order;
  - a centred illustration;
  - a full-width Jugar, 100–112px tall;
  - equal secondary cards side by side, 64–76px tall from 320px;
  - Jugar's dominance (≥1.35× the card height, ≥1.5× the label size);
  - all three actions within the first viewport from 375×812.

  It replaces the old phone checks on `.home-modes` and the 100px drawing. The tablet and desktop assertions are unchanged, with the same values. The navigation check adds a 390px Tab order (menu button → Jugar → Aprèn català → Paraula del dia, each with a solid focus ring), Enter on a card, and a click near Jugar's right edge, which proves the whole surface navigates in-app.
- **`scripts/header-browser-checks.mjs`.** The menu's outside-click test clicked the fixed point (30, 820). That point is now a mode-card link, and the header, as before, does not swallow outside clicks. The test now clicks the non-interactive letter row below the open menu and asserts that it lies below the menu.
- **`scripts/browser-audit-test.mjs`.** After a completed daily game, the phone daily card shows `#N ✓ · Jugada` without the word. It returns to `#N` with corrupt or outdated storage.
- **`tests/localization-test.ts`.** The four new strings are pinned literally. The new nav's classes, destinations and order are checked, and so are its CA/ES text in the new/won/lost states and that it never leaks the answer.

## Limitations

- The engines are desktop Firefox with resized viewports, not iOS Safari or Android Chrome. Headless Firefox shows a 12px classic scrollbar, so the measured content widths are 12px narrower than on a phone.
- At 200% text with a 320px viewport and a classic scrollbar, the existing footer is 7px wider than the client width. That is the footer's own layout; the page does not overflow the viewport. No phone with overlay scrollbars is affected.

## Follow-up: multiplayer setup emphasis

On `/multijugador`, "El teu nom" was a small label and field, easily missed beside the two large panels. The name is now step 1 and the page's main element. "Crea una sala" and "Uneix-te" are step 2.

- **Name card.**
  - Saffron (`--warning-surface`) with a 2px ink outline and the 4px card shadow.
  - An inked "1" badge and a Fraunces title at `--text-card-title` (36px on desktop, 24px on phones).
  - A 56px field in Fraunces with a placeholder, and the hint "Així et veurà la resta de la sala." / "Así te verá el resto de la sala." linked by `aria-describedby`.
  - The field uses `autocomplete="nickname"` and keeps its existing value, `maxLength`, `required` and saved name.
  - On desktop the title and field share one row, full form width. On tablets and phones the field sits under the title.
- **Step 2.** The line "Després, tria com jugar" / "Después, elige cómo jugar" has an outlined "2" badge. The panel titles drop to `--text-panel-title` (20–24px) and the panel shadows to 2px, so they no longer compete with the name.
- **Phones (≤599px).** The two panels are disclosures, and both start collapsed.
  - Each `<h2>` holds a button with `aria-expanded`/`aria-controls` and a chevron. The one-line hint stays visible, so the choice is clear while collapsed.
  - The whole collapsed card is the hit area. Opening one panel closes the other, so the page stays short.
  - Tablets and desktop keep both panels open with plain headings: no extra Tab stops.
- **Volts selector.** The selector's minimum option width went from 4.75rem to 3.5rem, so "1 · 3 · 5" stays on one row in a 320px panel (it previously wrapped "5" onto its own row).
- **Tests.**
  - `tests/localization-test.ts` checks setup order, the name label/field/hint association, the new CA/ES strings, and that the static (desktop) render has no toggles or hidden panels.
  - `checkSetupEmphasis` (`scripts/homepage-browser-checks.mjs`, run by `test:browser`) runs in CA/ES at 1440, 768, 390 and 320px. It checks that the name card leads, spans the form and has the largest title. It also checks there is no overflow. On phones it covers pointer opening via the hint area, one-at-a-time behaviour, and the keyboard: Tab from the name reaches the create toggle, Enter opens it, Tab continues into it, and Space closes it.
  - `scripts/header-browser-checks.mjs` now opens the create disclosure before creating a room at 390px.
- **Screenshots.** Before/after captures are in `design-explorations/phase-3c/screenshots/setup-before` and `setup-after`, including the opened create and join panels at 390 and 320px.
