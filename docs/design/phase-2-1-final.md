# Phase 2.1 — Final homepage polish (F1, F2)

Status: **approved — F1 adopted** for desktop and mobile, with the tablet range replaced by [T1](phase-2-1-tablet.md) and S0 sizing; F2 was not adopted. Implemented in [the Phase 2.1 homepage report](../implementation/phase-2-1-homepage.md). Exploration artifacts under `design-explorations/` (galleries, prototypes, screenshots) are local working files and are not committed, so links into that directory resolve only in the original workspace.

Original proposal status: final proposal, awaiting approval. No application code, tests, SEO configuration or dependencies were changed. This round refines D2, the earlier multiplayer-first proposal (an uncommitted working document that followed the product decision that multiplayer is Penjat's primary mode). Everything F1 keeps from D2 is restated in §1, so this specification stands on its own. The product hierarchy, identity and layout were already settled and are not reopened here.

| Artifact | Path (under `design-explorations/phase-2-1-final/`) |
| --- | --- |
| Gallery: current, D2, F1 and F2 side by side at every viewport, plus Spanish, completed states, interaction states and robustness checks | `index.html` |
| Prototypes | `f1.html`, `f2.html` |
| Prototype query parameters | `?hl=es`, `?estat=guanyada`, `?estat=perduda`, `?forcar=hover\|focus\|active`, `?serif=narrow` |
| Shared styles (production tokens; refinements marked `final`) and helpers | `prototype.css`, `prototype.js` |
| Screenshots (82) and measured layout metrics | `screenshots/*.png`, `screenshots/metrics.json` |
| Re-capture script (Node built-ins and Firefox only) | `CURRENT_URL=http://127.0.0.1:3002/ node design-explorations/phase-2-1-final/capture.mjs` |

**How the screenshots were made.**
- Firefox 157 driven over WebDriver BiDi, the same method as D2, with a fresh user context per capture. Captured 2026-10-08, daily challenge **#54**.
- Viewports:

  | Viewport | DPR | User agent |
  | --- | --- | --- |
  | 1440×900 | 1 | desktop |
  | 1024×768 | 1 | desktop |
  | 768×1024 | 2 | desktop |
  | 390×844 | 3 | iPhone (shows the iOS install card, as production does) |
  | 320×568 | 2 | Android |

- "Current" is the existing local production build (`dist/` + `dist-server/` on `127.0.0.1:3002`). It was not rebuilt.
- D2 was re-captured from its untouched prototype so that all four versions share the same five viewports.
- The limitations are listed in §7.

---

## 1. What was refined

D2's structure is kept as it is: the two-column hero, the compact primary/secondary pair, stacked buttons on phones, the 861px breakpoint fix, the mechanic-led subtitle and real links in a labelled `nav`. Five things changed.

| Area | D2 | Final (both variants unless noted) | Why |
| --- | --- | --- | --- |
| **Daily entry** | Bordered 64px mini-card with folio, date and "Juga →" | **F1:** borderless typographic row under a hairline. **F2:** the folio on a borderless cream wash. Both drop the date and the word "Juga". | On mobile, D2 shows **three stacked rounded rectangles of equal width**. The card is taller (64px) than either button (48px), so it reads as a third button. The date repeated what "del dia" and the number already say, and wrapped to three lines at 320px (`d2-narrow-full.png`). |
| **H1** | 64px × 3 lines (desktop), 42.9px × 3 (390) | **F1:** 56px × **2 lines** desktop, 37.4px × 2 at 390. **F2:** 60px × 3 desktop, 39.8px × 2 at 390. | The H1 was the heaviest element on the page. Two lines take about half its former ink area and lift the primary action **55px on a 390 phone** (365 → 310) with the same wording. |
| **Captions** | 13px | **14px**, 8px under the button | Comfortable reading size. The extra 1px costs no layout. |
| **Illustration** | 480px card, `0 24px 70px / .11` shadow | **F1:** 440px, 32px padding, `0 18px 50px / .08`. **F2:** 470px, `0 22px 60px / .10`. On **portrait tablet** both turn the card into a landscape band (drawing beside the word). | The card stays the identity anchor, but it no longer outweighs the controls. At 768px D2 left a 360px square floating beside an empty half. |
| **Multiplayer caption** | "Multijugador · de 2 a 10" | **"Crea una sala · de 2 a 10"** | The button already says *amb amics*. The caption now names the next step, using the destination's own noun ("Codi de sala"; the meta description says "Crea una sala, comparteix el codi"). |
| **Accessibility** | Footer domain 2.38:1; amber focus ring 1.93:1 on paper | Domain uses `--muted-strong` (5.00:1). The mode links get a 1px green-dark inner ring inside the amber outline (10.67:1). | WCAG AA for text (1.4.3) and non-text/focus contrast (1.4.11), without introducing a new colour. |
| **iOS install card** | Cream fill, bold green text | Transparent fill, 600-weight `#455249` text, 14px | It is a utility. It should not read as a fourth action when it peeks at the fold on iPhones. |
| **Completed daily state** | "Encertada amb 2 errors · nova paraula demà · Resultat →" | "Encertada amb 2 errors · torna demà →". When it cannot fit on one line, "Torna demà" moves to its own line with no dangling "·". | Shorter. It reuses the daily page's own "Torna demà" wording. |

Measured on the real renders (`screenshots/metrics.json`). *y* is in CSS px from the top of the viewport.

| | Current | D2 | **F1** | **F2** |
| --- | --- | --- | --- | --- |
| H1 at 1440 / 390 / 320 | 64×3 / 42.9×3 / 36×3 | 64×3 / 42.9×3 / 36×3 | **56×2 / 37.4×2 / 34×3** | 60×3 / 39.8×2 / 35×3 |
| Primary, 1440×900 | 560–608 | 573–621 | **528–576** | 564–612 |
| Primary, 1024×768 | **972–1020 (below fold)** | 496–544 | **447–495** | 476–524 |
| Primary, 768×1024 | 924–972 | 593–641 | **456–504** | 480–528 |
| Primary, 390×844 | 365–413 | 365–413 | **310–358** | 314–362 |
| Primary, 320×568 | 345–393 | 345–393 | **338–386** | 339–387 |
| Daily, 390×844 | 489–541 | 534–598 | 505–565 | 503–567 |
| Daily, 320×568 | 469–537 | 514–594 (cut) | 533–592 (title visible, caption cut) | 529–593 (title visible, caption cut) |
| Smallest caption | 12px at 4.31:1 | 13px at 5.00:1 | **14px at 5.00:1** | 14px at 5.00–5.42:1 |
| Horizontal overflow (all viewports, CA and ES) | none | none | none | none |
| Smallest mode target | 48px | 48px | 48px (daily 59px) | 48px (daily 64px) |

## 2. F1 — Editorial minimalism

![F1 desktop 1440×900](../../design-explorations/phase-2-1-final/screenshots/f1-desktop.png)

| 390×844 | 320×568 | 390 full page | 768×1024 |
| --- | --- | --- | --- |
| ![F1 mobile](../../design-explorations/phase-2-1-final/screenshots/f1-mobile.png) | ![F1 narrow](../../design-explorations/phase-2-1-final/screenshots/f1-narrow.png) | ![F1 mobile full](../../design-explorations/phase-2-1-final/screenshots/f1-mobile-full.png) | ![F1 tablet](../../design-explorations/phase-2-1-final/screenshots/f1-tablet.png) |

**Headline.**
- `clamp(40px, 4.3vw, 56px) / 1`, `-0.01em` tracking, `max-width: 17ch`.
- It breaks as **"Juga al penjat / online en català."** at every width from 390 to 1440. At 320 it falls back to three lines.
- It stays at 2 lines with both the wider (Noto Serif) and narrower (Liberation Serif) fallbacks, which bracket Georgia (`f1-serifnarrow-*.png`).
- Line height goes from .96 to 1.0 because two long lines need slightly more air between the descenders of "Juga" and the ascenders of "online".

**Daily row.**
- A 1px `--line` hairline spans exactly the pair's width (385px desktop, full width on phones).
- Beneath it is a single link:
  - left: serif **Paraula del dia** (18px) with **#54** in 14px bold green sans, and the caption *La mateixa per a tothom* underneath;
  - right: a green arrow.
- No fill and no border. The text is left-aligned, whereas the button labels are centred, so it cannot be mistaken for a third button.
- The link is inset by −8px, so its text aligns with the buttons while the hover tint has room to breathe.

**Illustration.**
- A 440px card: 32px interior padding, 250px drawing, a softer shadow.
- Its height (407px) now matches the copy block (eyebrow to daily row, about 400px), so the two columns balance optically.
- On phones the drawing is 100px wide, stacked under the actions as in production.

**Character.** It is the quietest version: everything below the H1 reads as one column of text and two controls. Spanish: `f1-desktop-es.png`, `f1-mobile-es.png`, `f1-narrow-es-full.png`.

![F1 completed (won), 1440](../../design-explorations/phase-2-1-final/screenshots/state-f1-won.png)

## 3. F2 — Balanced refinement

![F2 desktop 1440×900](../../design-explorations/phase-2-1-final/screenshots/f2-desktop.png)

| 390×844 | 320×568 | 390 full page | 768×1024 |
| --- | --- | --- | --- |
| ![F2 mobile](../../design-explorations/phase-2-1-final/screenshots/f2-mobile.png) | ![F2 narrow](../../design-explorations/phase-2-1-final/screenshots/f2-narrow.png) | ![F2 mobile full](../../design-explorations/phase-2-1-final/screenshots/f2-mobile-full.png) | ![F2 tablet](../../design-explorations/phase-2-1-final/screenshots/f2-tablet.png) |

**Headline.**
- `clamp(42px, 4.7vw, 60px) / .98`, `max-width: 14ch`. This keeps production's three-line poster break "Juga al penjat / online en / català." on desktop, slightly smaller.
- `text-wrap: balance` was tried in both variants and rejected: it produced an orphaned "Juga al" first line.

**Daily entry (subtle hybrid).**
- D2's letter-slot folio (**#54** on a 2px slot rule) is kept, beside the serif title and caption.
- It sits on a **borderless** cream wash (`rgba(255,253,248,.78)` ≈ `#fdfaf5`) with a 14px radius.
- On hover a hairline appears and the surface becomes full cream.
- It is more substantial than F1's row and visibly a place, yet still lighter than D2's card because it has no outline to echo the buttons.

**Illustration.**
- A 470px card with a 280px drawing.
- On phones the drawing (68px) sits **beside** `_ E _ J _ T` in a horizontal band, about half the stacked height. This mirrors the in-game mobile drawing panel, which also places the gallows beside the content.

**Character.** It is warmer and slightly more "game-like" on desktop, and the most compact on phones: at 390 the whole page, including the band, fits in the first screen.

![F2 completed (won), 1440](../../design-explorations/phase-2-1-final/screenshots/state-f2-won.png)

## 4. Detailed visual critique

| Criterion | F1 | F2 |
| --- | --- | --- |
| **Typography** | Two-line H1: confident but no longer shouting, and it **keeps its line count across fonts**. The serif daily title rhymes with the H1. | The three-line poster is closer to today's page and more expressive. **It is metric-fragile:** with a narrower serif it collapses to two lines (`f2-serifnarrow-desktop.png`), so on real Georgia the line count is unpredictable. The design would then change shape per OS. |
| **Colour** | Green appears only on the primary fill, the outline, `#54` and the arrow. One surface colour. | Same, plus a cream wash. It is pleasant, but it is a second surface value in a page that otherwise uses only paper and the illustration card. |
| **Layout proportions** | The copy block (about 400px tall) matches the 407px card, which gives the best optical balance of the four versions at 1440. At 1024 the copy column stays airy. | A taller copy block (about 463px) beside a 435px card. Fine, but at 1024 the three-line H1 at 48px plus the wash make the left column the busiest. |
| **Illustration** | Lighter card and shadow. It remains clearly the identity but recedes behind the controls. The stacked mobile drawing keeps production's image. | Larger desktop card. The mobile band is clever and compact, but splitting gallows from word changes the familiar stacked image. |
| **Buttons and captions** | Identical in both: 48px, 14px captions centred under each control, primary left, filled and 200px minimum width. | Identical |
| **Daily challenge** | Clearly subordinate, never mistakable for a button. Discoverable through the hairline, the serif title, the green number and the arrow. Hover adds a 4.5% green tint, an underline and a 3px arrow nudge. | Easier to spot at a glance, and the folio is a nice brand echo. However, on phones it is still a full-width rounded block directly under two full-width rounded buttons. It is softer than D2, but the rhythm of three blocks remains. |
| **Whitespace and spacing** | Spacing follows the scale (16 / 16 / 32 / 8 / 24). The hairline gives the daily entry its separation without adding a surface. | Same scale (20px before the daily entry). The wash's own padding makes the lower block feel slightly heavier. |
| **Mobile** | Primary at y=310. At 390 the daily row, the stacked illustration (ends at y=737) and the quieted iOS card all fit in the first screen, and the card reads as a footer utility. | Primary at y=314. Everything fits as well, with about 64px more room to spare, because the band ends at y=673. Efficient, but the band is a less familiar image. |
| **Accessibility** | Caption 5.00:1 at rest, 4.66:1 on hover, 4.55:1 when pressed (pressed tint lowered from 8% to 6% to stay AA). Focus: amber plus a dark inner ring. | Caption 5.42:1 on the wash. Same focus treatment. The `#54` is in the accessible name via an `sr-only` span, because the folio is `aria-hidden`. |
| **Brand consistency** | Closest to the editorial calm of the current page. Nothing new is introduced. | Consistent, with one extra surface type (the wash) and one new mobile composition (the band). |

## 5. Recommendation

**Adopt F1.**

- It answers the main open question best: the editorial row removes the stacked-blocks repetition beneath the buttons on mobile while staying discoverable. It is the first thing after the buttons, above the fold at 390, and a 59px target.
- Its two-line H1 is the larger balance gain. It reduces the H1's dominance, lifts the primary action 55px on phones and 32px on desktop, and it is the only headline option whose line count was stable across the bracketing fonts.
- It preserves production's stacked illustration on mobile, and the whole first screen at 390 (actions, daily row, illustration, iOS card) still fits.

**Already borrowed from F2.**
- The landscape band was explored first as F2's mobile illustration. It is used in both variants at 661–860px, where it fixes the portrait-tablet composition.
- The completed-state line break ("Torna demà" on its own line when space is short).

**Considered and not borrowed.**
- **The folio and the wash.** On desktop they are attractive, but they re-introduce a third surface under the buttons, which is the very problem F1 solves.
- **The mobile band.** It saves height, but the stacked drawing is the more recognisable image, and the space it saves is below the actions anyway.

**Fallback.** If the team feels F1's daily row is too quiet after real-device testing, F2's folio treatment is a drop-in replacement for the `<li class="mode-daily">` contents. It has the same link, the same strings and the same position, and nothing else needs to change.

## 6. Implementation specification

### 6.1 Files

| File | Change |
| --- | --- |
| `src/pages/HomePage.tsx` | **Menu branch only** (the final `return`). The multiplayer form and invitation branches are untouched. Replace the two `<button>`s and the daily `<a>` with links inside `nav.home-modes > ul.mode-pair`. Add the captions. Make both "Com es juga?" controls `<a href="/com-es-juga">`. Read the daily number and, optionally, the completed state. |
| `src/App.css` | Home section (lines ~29–58, 119–135) and the `max-width: 1100px` and `660px` home rules (lines ~419–420 and 429–454). See 6.3. No new tokens except `--muted-strong`. |
| `src/daily/homeSummary.ts` (new, optional step) | A pure helper for the completed state (6.5). |
| `src/daily/i18n.ts` | Add `sameForEveryone`, `wonWith(n)` and `comeBackTomorrow` to both languages (6.2). Reuse `title`, `lost` and `mistakes`. |
| `HangmanDrawing`, `App.tsx`, routes, SEO tables, `index.html`, structured data | **Unchanged.** |

Keep the production preview as it is (`HangmanDrawing errors={6}` with the sway). The global `prefers-reduced-motion` rule already stops the sway.

### 6.2 Approved interface strings

| Key / element | Catalan | Spanish |
| --- | --- | --- |
| Eyebrow (unchanged) | EL JOC DEL PENJAT | EL JUEGO DEL AHORCADO |
| H1 (unchanged) | Juga al penjat online en català. | Juega a Penjat online. |
| Subtitle `.home-lede` | Tria una paraula i repta els amics a endevinar-la. Sense registre. | Elige una palabra y reta a tus amigos a adivinarla. Sin registro. |
| `nav` `aria-label` | Modes de joc | Modos de juego |
| Primary | **Juga amb amics** | **Juega con amigos** |
| Primary caption | Crea una sala · de 2 a 10 | Crea una sala · de 2 a 10 |
| Secondary | **Aprendre català** | **Aprender catalán** |
| Secondary caption | En solitari, amb pistes | En solitario, con pistas |
| Daily title (`dailyTranslations.title`) | Paraula del dia | Palabra del día |
| Daily number | `#${challenge.number}` | same |
| Daily caption, not yet completed | La mateixa per a tothom | La misma para todos |
| Daily caption, won | Encertada amb `${mistakes(n)}` (n = 0: **Encertada sense errors**) | Acertada con `${mistakes(n)}` (n = 0: **Acertada sin errores**) |
| Daily caption, lost (`dailyTranslations.lost`) | No ha pogut ser | No ha podido ser |
| Completed suffix | torna demà (rendered "Torna demà" when it wraps to its own line) | vuelve mañana ("Vuelve mañana") |
| Help link (unchanged) | Com es juga? | ¿Cómo se juega? |

- Use the middle dot `·` (U+00B7) with normal spaces.
- Never render the daily word, its definition or its letter count on the homepage.
- "Multijugador" stays the mode name in the route, the help page and the destination title. It no longer appears as homepage text, as D2 already decided.

### 6.3 Markup and CSS (F1)

```tsx
<nav className="home-modes" aria-label={copy.modes}>
  <ul className="mode-pair">
    <li><a className="primary-action" href="/multijugador" aria-describedby="home-mp" onClick={route(onMultiplayer)}>{copy.multiplayer}</a>
      <p className="mode-caption" id="home-mp">{copy.multiplayerCaption}</p></li>
    <li><a className="secondary-action" href="/aprendre" aria-describedby="home-learn" onClick={route(onLearn)}>{copy.learning}</a>
      <p className="mode-caption" id="home-learn">{copy.learningCaption}</p></li>
    <li className="mode-daily"><a className="daily-entry" href={DAILY_CHALLENGE_PUBLIC_PATH} onClick={route(onDaily)}>
      <span>
        <span className="daily-head"><span className="daily-title">{d.title}</span><span className="daily-number">#{challenge.number}</span></span>
        <span className="daily-caption">{status === 'new' ? d.sameForEveryone : <>{result}<span className="daily-sep" aria-hidden="true"> · </span><span className="daily-tomorrow">{d.comeBackTomorrow}</span></>}</span>
      </span>
      <span className="daily-arrow" aria-hidden="true">→</span>
    </a></li>
  </ul>
</nav>
```

`route(fn)` intercepts only plain primary clicks:

```ts
(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); fn() }
```

Ctrl/Cmd-click, middle-click and "open in new tab" then work. Today's daily link always calls `preventDefault`, which blocks them.

CSS, with values taken from `f1.html` and `prototype.css`. Replace the current `.home-actions--modes`, `.home-cta*` and `.home-daily-*` home rules.

| Selector | Declarations |
| --- | --- |
| `:root` | add `--muted-strong: #5f6a62` |
| `.home-hero` | `grid-template-columns: minmax(0,1.1fr) minmax(0,.9fr); gap: 48px` (32px at ≤1100) |
| `.home-copy .eyebrow` | `margin-bottom: 16px; color: var(--muted-strong)` |
| `.home-copy h1` | `max-width: 17ch; font-size: clamp(40px, 4.3vw, 56px); line-height: 1; letter-spacing: -.01em` (no `text-wrap: balance`) |
| `.home-lede` | `max-width: 34ch; margin-top: 16px; color: var(--muted-strong); font-size: clamp(15px, 1.25vw, 17px); line-height: 1.5` |
| `.home-modes` | `margin-top: 32px` |
| `.home-modes ul` | `margin: 0; padding: 0; list-style: none` |
| `.mode-pair` | `display: grid; grid-template-columns: auto auto; justify-content: start; column-gap: 12px; width: max-content; max-width: 100%` |
| `.mode-pair .primary-action` | `min-width: 200px` |
| `.mode-pair a` | `display: flex; align-items: center; justify-content: center; min-height: 48px; padding: 13px 22px; text-decoration: none; width: auto` |
| `.mode-caption` | `margin: 8px 0 0; color: var(--muted-strong); font-size: 14px; line-height: 1.35; text-align: center` |
| `.mode-daily` | `grid-column: 1 / -1; contain: inline-size; margin-top: 24px; padding-top: 4px; border-top: 1px solid var(--line)`. `contain` stops a longer caption from widening the buttons. |
| `.daily-entry` | `display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; column-gap: 16px; min-height: 56px; margin: 0 -8px; padding: 8px; border-radius: 10px; text-decoration: none` |
| `.daily-head` | `display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 8px` |
| `.daily-title` | `color: var(--green-dark); font: 700 18px/1.25 Georgia, serif` |
| `.daily-number` | `color: var(--green); font-size: 14px; font-weight: 700; letter-spacing: .02em; font-variant-numeric: tabular-nums` |
| `.daily-caption` | `display: block; margin-top: 2px; color: var(--muted-strong); font-size: 14px; line-height: 1.35` |
| `.daily-tomorrow` | `white-space: nowrap`. At ≤380px: `display: block`, `::first-letter { text-transform: uppercase }`, and `.daily-sep { display: none }`. |
| `.daily-arrow` | `color: var(--green); font-size: 20px; line-height: 1` |
| `.home-preview` | `max-width: 440px; padding: 32px; box-shadow: 0 18px 50px rgba(49,58,48,.08)`; drawing `width: min(100%, 250px)`; letters `32px` wide, `42px` tall, `25px` |
| `.home-domain` | `color: var(--muted-strong)` |
| `.ios-install-card` / `.ios-install-toggle` | `background: transparent`; toggle `color: #455249; font-size: 14px; font-weight: 600` |

### 6.4 Responsive behaviour

| Width | Behaviour |
| --- | --- |
| ≥1101 | Two columns as above. |
| 861–1100 | Two columns, `gap: 32px`, card `padding: 24px`. **Remove production's `.home-preview { order: -1 }` stacking** (it causes the 1024×768 fold failure). |
| 661–860 | One column. The copy comes first, then the card as a **landscape band**: `justify-self: stretch; max-width: none; aspect-ratio: auto; padding: 24px 32px`; board `grid-auto-flow: column; justify-content: center; align-items: end; column-gap: 48px`; drawing 136px. |
| ≤660 | Production's mobile shell (padding-top 60px, hero margin-top 16px). Eyebrow +12px, lede +12px at 16px, modes +24px. `.mode-pair` becomes one column with a 12px row gap at full width, and the primary loses its `min-width`. Daily `margin-top: 16px`. H1 `clamp(34px, 9.6vw, 40px) / 1.02`. Illustration stacked, `margin-top: 32px`, drawing 100px, letters 16px wide, 24px tall, 16px. iOS card margin-top 24px. Footer margin-top 24px. |
| ≤380 | The completed-state suffix moves to its own line. CA/ES pill as production. |

Specificity note from prototyping: put the mobile and tablet card resets on `.home-hero .home-preview` and the board rules on `.home-hero .preview-board …`, or the desktop card rules override them.

### 6.5 Interaction states

| State | Primary | Secondary | Daily row |
| --- | --- | --- | --- |
| Rest | Green fill, `0 7px 15px #244f3a2b` | White, 1px green border | No fill, no border |
| Hover | `--green-dark`, shadow `0 9px 18px #244f3a33` | Border and text `--green-dark`, background `#f7f8f4` | Background `rgba(36,79,58,.045)`, title underline `rgba(25,61,43,.55)` 1px offset 4px, arrow `translateX(3px)` |
| Keyboard focus (`:focus-visible`) | `outline: 3px solid #e5a33c; outline-offset: 3px; box-shadow: 0 0 0 2px var(--paper), 0 0 0 3px var(--green-dark)` | Same | Same |
| Pressed (`:active`) | `translateY(1px)`, shadow `0 3px 8px #244f3a2b` | `translateY(1px)`, background `#eef1ea` | Background `rgba(36,79,58,.06)` (keeps the caption at 4.55:1) |
| Transitions | 140ms ease on colour, background, shadow and transform. The existing global `prefers-reduced-motion` rule removes them, including the arrow nudge. | | |
| Disabled / loading | **None.** These are navigation links that route instantly on the client. The only network step (connecting the socket) already has its own busy state on the multiplayer form. Do not add a spinner. | | |

Crops: `state-f1-{rest,hover,focus,active,won,lost-es,mobile-focus,mobile-won}.png`.

**Daily states.**
- **Not completed** (no stored attempt, a different date, corrupt storage, or a game in progress): caption "La mateixa per a tothom".
- **Completed:** the caption shows the result and the suffix. The title, number, link target and arrow do not change. The primary action never changes.
- **Optional helper:** `getHomeDailyStatus(challenge, storage): { status: 'new' | 'won' | 'lost'; mistakes: number }`.
  - It calls `readDailyAttempt(storage, challenge.id)`.
  - It **replays** the stored guesses with `createDailyRound(challenge.entry, guesses)` and never trusts the stored `completed`/`won` flags.
  - It returns no word fields.
- Compute the status once, in a `useState` initialiser, so there is no flash. If storage throws, treat the challenge as `new`.
- The step can ship later. The row works without it.

### 6.6 Accessibility checklist

- One `h1` and no new headings. The daily title is a `span`, so the outline and SEO stay unchanged.
- Tab order:
  - **desktop:** "Com es juga?" (topbar), then the primary, the secondary, the daily row and the CA/ES pill;
  - **mobile:** the primary, the secondary, the daily row, the iOS toggle, the footer "Com es juga?" and the CA/ES pill.
- Accessible names: the button label plus the caption through `aria-describedby`. The daily link's name is its visible text ("Paraula del dia #54, La mateixa per a tothom"). The separator and arrow are `aria-hidden`.
- Contrast:

  | Pair | Ratio |
  | --- | --- |
  | Caption on paper | 5.00:1 |
  | Caption on the hover tint | 4.66:1 |
  | Caption on the pressed tint | 4.55:1 |
  | Title | 10.67:1 |
  | `#54` | 8.25:1 |
  | White on the primary | 9.31:1 |
  | Domain | 5.00:1 |
  | Focus inner ring | 10.67:1 |
  | Amber against that ring | 5.53:1 |

- Completed and won/lost states are stated in text, never only by colour.
- With a 20px minimum font size (`large-*.png`) nothing is clipped or overflows at 390 or 320. The targets grow to 50px.

### 6.7 Tests to add or update

No existing test drives the homepage menu: `browser-audit-test.mjs` navigates by URL and `seo-test.mjs` checks only the head. Nothing needs updating. Add:

1. **`tests/localization-test.ts`**, which already renders pages with `renderToStaticMarkup`. Render `HomePage` with `mode="home"` in CA and ES; stub `globalThis.localStorage`/`sessionStorage`, because `useState` reads `hangman-name` and the room session. Assert:
   - exactly one `<h1>` with the unchanged text;
   - `nav[aria-label]`;
   - three `<a>` elements with `href` `/multijugador`, `/aprendre` and `/paraula-del-dia`;
   - the label and caption strings from 6.2;
   - each `aria-describedby` points at an existing id;
   - `#${getDailyChallenge().number}` is present;
   - the daily entry's `word` does not appear in the markup.
2. **`tests/daily-test.ts`**, if 6.5's helper ships:
   - no storage gives `new`;
   - a stored win with 0, 1 and 2 errors;
   - a stored loss;
   - corrupt JSON gives `new`;
   - another date's attempt gives `new`;
   - tampered flags (`completed: true` with guesses that do not solve) give the replayed status;
   - the returned object has no `word`/`entry` keys.
3. **`scripts/browser-audit-test.mjs`**, at 1024×768 and 390×844:
   - the primary's `getBoundingClientRect().bottom <= innerHeight`;
   - `scrollWidth <= innerWidth`;
   - a Ctrl+click event on each mode link is **not** `defaultPrevented`;
   - a plain click routes with `pushState` and does not reload.
4. Run `npm run lint`, both `tsc` checks, `npm run test:localization`, `npm run test:daily`, `npm run test:seo` (title, meta, canonical unchanged) and `npm run test:browser`.

### 6.8 Visual regression checkpoints

Point the capture script at the built app (`CURRENT_URL=http://127.0.0.1:3002/ node design-explorations/phase-2-1-final/capture.mjs`). Compare `current-*` with `f1-*`. Accept the result when:

| Viewport | Primary top (±12px) | H1 (Noto fallback) | Other |
| --- | --- | --- | --- |
| 1440×900 | 528 | 56px, 2 lines | Daily row 59px high under a hairline the width of the pair |
| 1024×768 | 447 | 44px, 2 lines | Two columns |
| 768×1024 | 456 | 40px, 2 lines | Card is a landscape band |
| 390×844 | 310 | ≈37px, 2 lines | Daily fully above the fold; with an iPhone user agent, the transparent iOS card is visible at the bottom |
| 320×568 | 338 | 34px, 3 lines | Daily title visible at the fold |

Also check:
- no horizontal overflow anywhere, in CA and ES;
- captions computed at 14px;
- the same results in the `?estat` equivalents: seed `penjat-daily-challenge` in storage for the won and lost captures.

## 7. Remaining limitations

These need real devices or real fonts. None of them blocks implementation.

- **Georgia and Inter are not installed here.** Every render uses Noto Serif/Noto Sans. F1's H1 holds two lines with both a wider and a narrower serif. Still, **check the 390px Catalan H1 on an iPhone**:
  - if Georgia Bold wraps "online en català." to a third line, the primary moves down about 38px, to roughly y=348, which is still well above the fold;
  - if that happens and looks unbalanced, lower the mobile clamp maximum from 40px to 38px.
- **Gecko only, no touch emulation.** Firefox 157 cannot emulate touch, so `:hover` styles were inspected on a desktop pointer. On iOS, `:hover` can stick after a tap. The hover tint and arrow nudge are mild enough, but confirm once on Safari. Safe-area insets were not emulated.
- **The iOS install card** was captured only collapsed and with an emulated iPhone user agent. Check its expanded state on a real iPhone with the new transparent style.
- **Real iPads** report a Mac user agent with touch, so production shows the install card there too. It was not captured at 768×1024 because the emulation has no touch points.
- **Global focus and language toggle.** The dark inner ring is specified for the homepage mode links only. The amber ring on other pages, and the CA/ES pill's inactive `--muted` text (4.31:1), are app-wide decisions outside this task.
