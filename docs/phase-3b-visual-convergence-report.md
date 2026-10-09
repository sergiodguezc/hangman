# Phase 3B — Visual convergence with Lovable

Status: implemented in the working tree on 2026-10-09. Nothing has been committed, pushed or deployed. The Phase 2A–3A uncommitted work is preserved. `server/`, `dist-server/`, `shared/`, the protocol, scoring, routing and vocabulary are untouched; the only server-side diff is still the pre-existing `GameRoom` change.

The Lovable mockup (`lovable/`) is now the visual reference. Penjat remains the source of truth for modes, behaviour, accessibility, SEO and responsive layouts.

## 1. Investigation: Penjat (Phase 3A) vs Lovable

I ran the Lovable prototype locally from an untracked copy (`design-explorations/phase-3b/lovable-app/`, dependencies installed there only) and captured every route and demo state at the six requested viewports. I compared those captures with 192 Phase 3A captures of the real app (CA/ES).

| Area | Phase 3A | Lovable | Verdict |
| --- | --- | --- | --- |
| Navigation | Floating circular back button (top left) and CA/ES pill (top right). Each page repeated its own "P" badge + title. No way to move between modes except through the homepage. | One ruled header: badge wordmark, the modes inline with an inked current item, CA/ES pill. Phones get a menu button. | **Improves the product.** It gives one place for wayfinding and a persistent brand. Adopted. |
| Brand | "P" in a red blob plus "penjat.cat" on the homepage only | Round magrana badge with a tiny gallows glyph, "penjat.cat" in Fraunces with a red ".cat" | Adopted (badge glyph, wordmark on every page, ink footer variant). |
| Homepage composition | Two-column hero with a modest headline, a mode button pair, a daily row and a framed drawing. The page ended there. | Huge display headline with an italic red accent, two pill CTAs, a rotated board card with a saffron sticker, a word ticker, a "Tria com vols jugar" bento of colour mode cards and an ink footer. | Hero, rotated preview card, mode-card bento and footer **adopted and adapted**. Fake stats ("48.291 partides"), "Joc individual" and the ticker were **not** adopted (invented data/feature, decorative motion). |
| Headings | Fraunces 700, page titles at 28–30px | Fraunces 800–900 at display sizes, with one italic accent word | Adopted with a fluid scale capped at 76px. Phones stay compact. |
| Labels | Many 13px uppercase tracked labels (hint, definition, example, incorrect letters, ranking places, results) | Mono uppercase micro-labels everywhere | **Neither.** All converted to sentence-case semibold labels at the metadata size, as the brief asked. |
| Buttons and controls | Pill primary with a 3px ink shadow; flat secondary pills; green segmented controls | Every button printed: 2px ink outline and offset shadow that lifts on hover and presses on click. Inked selected states. | Adopted consistently (primary, secondary, danger, segmented controls, inputs, daily ticket, mode cards). |
| Cards and panels | Mixture of 1px beige borders, soft shadows and 2px ink cards | 2px ink, about 22px radius, 4px ink shadow; dashed "ticket" surfaces; ink cards for reference data | Adopted. Ranking, chat, boards, results, lobby, setup and help all share the same card language. Supporting panels keep outlines without shadows. |
| Gameplay boards | Phase 2C/2D layouts with a paper-deep drawing panel and solid dividers | Clean card with a dashed separation feel, lives diamonds, Fraunces keys, inked score names, highlighted own row | Visual language adopted **on the Penjat layouts**. Lovable's horizontal ranking strip and tall stacked drawing would regress Phase 2C, so they were not adopted. |
| Results | Tinted full-bleed result area; uppercase labels | Colour word header ("fitxa"), large word, example with a red rule, podium for multiplayer | Learning/daily: tinted word block with ink outline and a 64px word. Multiplayer: saffron leader row, inked self badge, ★ mark. The podium was not adopted: it hides the full shared-rank classification and departed players. |
| Lobby | Centred card, plain code | Ink code card with a saffron code, player tiles | Ink/saffron room code, saffron initials, single primary action. |
| Multiplayer setup | One narrow form | Two side-by-side cards ("Crea una sala" / "Uneix-te") under a big headline | Adopted as two panels of one form. The name is shared above them, because joining also needs it. |
| Help | Grey grid of bullet lists | Big heading, numbered rule cards, colour mode cards, ink scoring card | Adopted: numbered rule cards, tinted mode sections with "Prova-ho" links, ink scoring card. |
| Backgrounds and decoration | Dot grid | Dot grid, rotations, sun, sticker tags | Dot grid, slight rotations of preview and rule cards, sticker tag. No floating/looping animation. |

## 2. What changed

### Shared shell
- **`SiteHeader`** (`src/components/SiteHeader.tsx`, `src/navigation/`) replaces `GlobalNavigation` and the fixed language toggle on every page and match state:
  - wordmark link home;
  - Multijugador · Aprèn català · Paraula del dia · Com es juga, using the real routes and `aria-current`;
  - a contextual exit: "Surt de la sala", "Surt de la partida" or "Acaba la sessió";
  - the CA/ES pill;
  - a skip link.
- **No "Jugar/Joc individual" item.** Penjat has no separate solo mode. The single-player mode is *Aprèn català*, so adding "Jugar" would have invented a feature. The brand link and the homepage cover "play".
- **Guarded navigation** (`App.navigate`). Header links never drop state silently. Leaving a waiting room asks "Vols sortir de la sala?". Leaving an active match, or an unfinished learning or daily game, uses the existing "Vols acabar la partida?" dialog. Cancel keeps everything (the session token is untouched). Finished matches and idle pages navigate directly.
- **Sticky only where it is free.** The header is sticky only on desktop content pages (home, help, multiplayer setup; ≥1000×600). Phones and every gameplay page scroll it away. Its height is 58px on phones and 66px from 661px. Pages lost the old 72px top padding that existed for the floating buttons.
- **`SiteFooter`**: an ink band with the wordmark, tagline and section links, on home, help and setup. It adds a crawlable second navigation.
- **Page heads**: a coloured eyebrow pill, a Fraunces heading with an italic accent word, and a lede. They replace the per-page "P" brand marks. Gameplay heads stay compact.

### Pages
- **Homepage.** The display hero keeps the SEO headline text and the honest multiplayer-first actions with captions. The daily entry is now a saffron ticket with the real status. The rotated board card has a sticker. A "Tria com vols jugar" section follows, with four colour cards (multiplayer, daily, learning, help). Each card shows a small honest illustration: a room-code tile row, a share-style grid, a hint→word card and the character.
- **Multiplayer setup.** A headline, the shared name, then create and join panels (stacked on phones with "o").
- **Lobby.** Ink room-code card, saffron initials, "Repta un amic" demoted to a secondary action so "Comença la partida" is the only primary.
- **Learning and daily.** Page heads. The daily page has a ruled masthead with the challenge number and date. Board cards use a dashed drawing separator, lives diamonds (`ErrorMeter`, decorative beside the existing count) and Fraunces keys. Results use the tinted word block.
- **Match.** Page title "Partida multijugador", inked room chips, Lovable ranking rows (saffron own row, Fraunces scores, inked "tu"), chat with paper bubbles and pill input, inked notices and forgiveness panels, and a ruled phone action bar for results.
- **Help.** Numbered rule cards, tinted topic sections, ink scoring card, "Prova-ho" links to the real modes.
- **Colour clean-up.** 69 leftover hard-coded green/amber/red hex colours from earlier phases now use the semantic tokens.

## 3. Mobile navigation behaviour

The phone and tablet header (<1000px) shows the badge wordmark, the CA/ES pill and a 44px menu button. In a room or learning session, a 44px icon-only exit button sits beside them.

The button is a disclosure (`aria-expanded`, `aria-controls`, localised "Obre/Tanca el menú"). It opens an overlay panel directly under the header. The overlay causes no layout shift under a running game, uses about 40% of an 844px screen, and scrolls internally if needed. The panel contains:
- Inici and the four sections, as 48px Fraunces rows with the current page inked;
- the interface language (Català/Español).

Behaviour:
- Focus stays on the button; Tab continues into the menu.
- Escape closes the menu and returns focus to the button.
- A pointer press outside the header closes it, and so does focus leaving the header.
- Choosing a link closes it and navigates. In a room or an active game, the confirmation dialog appears first.
- Growing past 1000px closes it, and the inline navigation takes over.

Narrow widths:
- Below 384px, a contextual exit takes the language pill's place. The language stays in the menu.
- Below 320 CSS px, or with large text, the pill moves into the menu, then the wordmark leaves the badge alone.
- No horizontal overflow at any tested width, including 320px rooms and 200% text.

## 4. Before/after evidence

- **Gallery:** [`design-explorations/phase-3b/index.html`](../design-explorations/phase-3b/index.html). It has 228 sheets (CA/ES × 6 viewports × 19 states). Each sheet shows Phase 3A | Phase 3B | the closest Lovable state (Catalan) side by side; the sheets are in `comparisons/`.
- **Raw captures:**
  - Phase 3A baseline: `screenshots/before/`
  - Phase 3B: `screenshots/after/`
  - real 200% text: `screenshots/text200/`
  - Lovable: `screenshots/lovable/` and `screenshots/lovable-full/`
  - live multiplayer: `screenshots/multiplayer/`
- **Quick comparisons:**
  - [desktop home](../design-explorations/phase-3b/comparisons/ca-1440x900-home.png)
  - [desktop match](../design-explorations/phase-3b/comparisons/ca-1440x900-guessing.png)
  - [learning result](../design-explorations/phase-3b/comparisons/ca-1440x900-learning-result.png)
  - [help](../design-explorations/phase-3b/comparisons/ca-1440x900-help.png)
  - [phone home](../design-explorations/phase-3b/comparisons/ca-390x844-home.png)
  - [phone menu](../design-explorations/phase-3b/comparisons/ca-390x844-menu.png)
  - [phone board](../design-explorations/phase-3b/comparisons/ca-390x844-guessing.png)
  - [320px board](../design-explorations/phase-3b/comparisons/ca-320x568-guessing.png)

The 390×844 short-word board now ends at about 795px, against 822px in Phase 3A. The full alphabet stays in the first viewport.

## 5. Validation

All logs are in `design-explorations/phase-3b/logs/` and the other `*.log` files in `design-explorations/phase-3b/`.

| Check | Result |
| --- | --- |
| `npm run build` | pass (the 500 kB vocabulary chunk warning predates this phase) |
| `npm run lint` | pass, 3 warnings, all in Phase 2.1 exploration scripts (they predate this phase) |
| `tsc -b`, `tsc -p server/tsconfig.json --noEmit` | pass |
| `test:learning`, `vocabulary`, `daily`, `invitation`, `localization`, `multiplayer-ui`, `match-results`, `character` | pass |
| `test:game`, `chat`, `lifecycle`, `match`, `n-player` (rebuilt server; `dist-server` unchanged) | pass |
| `test:vocab`, `vocab:validate` | pass |
| `test:e2e` (dedicated server on 3002) | pass |
| `test:seo` | pass |
| `test:browser` (Firefox 157 BiDi), including the new header checks | pass (rerun after the final CSS change) |
| Phase 2C interaction checks on the Phase 3B fixtures | 37/37 pass |
| Identity checks (contrast tokens, focus ring, short-board geometry) | Firefox 157 and Chromium 151: pass |
| Live multiplayer, 4 and 10 players, ties, reconnect, departure, results, rematch (`DETERMINISTIC_FIRST_SETTER=1`) | Firefox 157 and Chromium 151: pass |
| Capture matrix: CA/ES × 1920×1080, 1440×900, 1366×768, 768×1024, 390×844, 320×568 × 19 states | 228 renders, 0 overflow, truncation, contrast, <24px target, clipping or crushed-panel flags |
| Real 200% text (Firefox profile with a 32px default font), 5 viewports × 14 states × CA/ES | 140 renders, 0 flags |
| Reduced motion (Firefox `ui.prefersReducedMotion`) | no hover/press transforms, 0s transitions, no running animations |
| Keyboard | skip link → brand → sections → CA/ES → page actions; visible focus rings; menu Escape returns focus; dialogs trap focus as before |
| `git diff --check` | clean |

### Regression assertions changed, and why
All of these follow the authorised structural redesign. Each keeps its original intent.
- `tests/localization-test.ts`:
  - The homepage `<h1>` is compared by text content, because the accent word is an `<em>`. The headline text is unchanged.
  - The approved F1 strings stay pinned literally, and the new Phase 3B homepage strings are pinned in a second literal assertion.
- `scripts/homepage-browser-checks.mjs`:
  - **Headline:** the size cap is 76px instead of 56px (Lovable display scale). Lines are ≤2 on phones and ≤3 from 600px.
  - **Header:** a new header-height assertion was added.
  - **Hero geometry:** the tablet assertions for the old single-measure layout are replaced by the new stacked-hero ones (preview after the daily entry, centred). The two-column check now starts at 1000px, the new breakpoint.
  - **Row alignment:** compared on the untransformed list items, because the hover lift legitimately moves a hovered button by ≤1px.
  - **Keyboard order:** it now starts at the skip link and header (brand, four sections, CA, ES) before the three page mode links. A skip-link activation check was added.
- `scripts/browser-audit-test.mjs`: returning home from a finished daily game uses the header brand link (`.site-brand`). There is no generic back button any more.
- `scripts/responsive-scope-checks.mjs`: the help contract checks the rule-card grid (one column ≤599px, two from 600px) instead of the removed brand-row flex direction.
- `design-explorations/phase-3b/interaction-checks.mjs` (the Phase 2C checks on the new fixtures): help no longer has a back button, so the label-visibility check moved to the learning exit ("Acaba la sessió"). Help is checked as 8 topic sections plus 4 rule cards, instead of 9 sections.

### New regressions
- `scripts/header-browser-checks.mjs`, run inside `npm run test:browser`, in CA and ES:
  - phone menu state, labels, links and target sizes;
  - viewport budget;
  - Tab into the menu, Escape and focus return, outside click;
  - navigation closes the menu and marks the current page;
  - menu language switch;
  - resize to desktop closes it; current-page marking;
  - sticky only on content pages;
  - 320px room header without overflow;
  - guarded room exit: cancel keeps the session, confirm leaves.
- `design-explorations/phase-3b/motion-check.mjs`: with `prefers-reduced-motion`, hovered buttons, cards, keys and the brand badge have no transform and 0s transitions, and no animation runs.

## 6. Remaining limitations

- **"Jugar" has no own entry.** There is no single-player mode distinct from *Aprèn català*, and adding one would be an invented feature.
- **Not adopted from Lovable, on purpose:**
  - fake activity numbers, streaks, timers, percentiles, pronunciation, bookmarks, units and "Joc individual";
  - the word ticker;
  - the multiplayer podium, which hides the shared-rank classification;
  - Lovable's horizontal ranking strip, nine-column keyboard and tall phone drawing card, which would undo Phase 2C.
- **Italic accent is synthesised.** It is a synthetic oblique of the upright Fraunces face, the same as Lovable itself, which never loads an italic face. A true Fraunces Italic subset would cost about 55 kB more.
- **WebKit not re-run.** WebKit was not re-run this phase. Phase 3A's WebKit harness fixes still apply, and the layouts use no new WebKit-specific features beyond `:has()` (supported since Safari 15.4) and `color-mix()` (since Safari 16.2). No physical phones or iOS Safari were tested.
- **Older harnesses no longer load.** The Phase 2C/3A fixture harnesses import the removed `GlobalNavigation` and no longer load. Their Phase 3B copies live in `design-explorations/phase-3b/`.
- **Existing copy left as is.** Some existing copy duplication remains: the learning board labels both the error count and the wrong-letter list "Lletres incorrectes". The 500 kB vocabulary chunk warning and the three exploration-script lint warnings also predate this phase.
- **Large local folders.** `design-explorations/phase-3b/lovable-app/` contains the installed prototype dependencies (about 400 MB, untracked, ignored by lint). Delete it when the comparison is no longer needed.
