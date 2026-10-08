# Phase 2.1 — Portrait-tablet refinement (T1, T2)

Status: **approved — T1 adopted** for 600–860px (the 600px start and 17ch H1 cap from §7.2), with S0 sizing; T2 was not adopted. Implemented in [the Phase 2.1 homepage report](../implementation/phase-2-1-homepage.md). Exploration artifacts under `design-explorations/` (galleries, prototypes, screenshots) are local working files and are not committed, so links into that directory resolve only in the original workspace.

Original proposal status: proposal, awaiting approval. No application code, tests, SEO configuration, dependencies or approved F1 files were changed. This round only replaces F1's 661–860px treatment ([F1 §6.4](phase-2-1-final.md#64-responsive-behaviour)). F1 desktop, F1 mobile, the hierarchy, copy, colours, fonts and illustration are not reopened.

| Artifact | Path (under `design-explorations/phase-2-1-tablet/`) |
| --- | --- |
| Gallery: F1, T1 and T2 side by side at every width, transitions, breakpoint study, Spanish, states | `index.html` |
| Prototypes | `t1.html`, `t2.html`, and `t1-600.html` (T1 starting at 600px; `?h1=17ch` adds the mobile H1 cap) |
| Styles | `t1.css`, `t2.css` (661–860 only), `bp600.css` (breakpoint study). `f1.css` is a verbatim copy of F1's inline styles. All pages link the untouched `../phase-2-1-final/prototype.css` and `prototype.js` |
| Screenshots (97) and metrics | `screenshots/*.png`, `screenshots/metrics.json` |
| Re-capture (Node built-ins and Firefox only) | `node design-explorations/phase-2-1-tablet/capture.mjs` (`ONLY=<prefix>` re-runs a subset) |

**Method.**
- Firefox 157 over WebDriver BiDi, the same method as F1, with a fresh user context per capture. Captured 2026-10-09, daily challenge **#55**. Noto Serif/Noto Sans stand in for Georgia/Inter.
- The markup of `t1.html` and `t2.html` is byte-for-byte F1's. Only one stylesheet is added, and it is scoped to the tablet range.
- Viewports (heights chosen to match a real portrait device at each width):

  | Width × height | DPR | Why |
  | --- | --- | --- |
  | 660×1000, 661×1000 | 2 | mobile/tablet boundary |
  | 700×1000 | 2 | between boundary and iPad |
  | 768×1024 | 2 | iPad 9.7″, the reference |
  | 820×1180 | 2 | iPad Air / iPad 10th gen |
  | 860×1180, 861×1180 | 2 | tablet/desktop boundary |
  | 1024×768 | 1 | small laptop reference |
  | 844×390 | 3 | iPhone landscape (lands in the tablet range) |
  | 480, 540, 599, 600, 640 | 2 | breakpoint study |
  | 1440×900, 390×844, 320×568 | 1/3/2 | identity checks only |

- **Identity check.** The F1, T1, T2 and breakpoint-study screenshots are **byte-identical** at 1440×900, 1024×768, 861×1180, 390×844 and 320×568 (CA and ES at 390/320), and at 660×1000 for T1/T2. Neither variant changes the approved desktop or mobile renders.
- *y* values are CSS px from the top of the viewport. "Air" is the empty paper above the topbar and below the footer.

---

## 1. Diagnosis: F1 at 661–860px

![F1 768×1024](../../design-explorations/phase-2-1-tablet/screenshots/f1-768.png)

Measured at 768×1024 (`f1-768`):

| Problem | Evidence |
| --- | --- |
| **Copy uses the left half only** | Eyebrow to daily row spans x = 24–417, which is 54% of the width. The right 327px beside the H1 and the buttons is empty. |
| **The illustration is wider than the controls** | The band is 720×197, against a 385px button pair. At 820 it is 772px; at 860 it is 812px. |
| **The band is detached** | The 32px grid gap plus the band's own frame read as a new section, not as part of the hero. |
| **It is a third image of the drawing** | The drawing (136px) sits **beside** `_ E _ J _ T`, 48px apart. Desktop and mobile both stack the drawing above the word, so 661–860 is the only range where the familiar composition breaks. |
| **The page floats** | 163px of air above the topbar at 768, and 240px at 820×1180. The page is vertically centred, and the composition is only about 700px tall. |

The **mobile side of the boundary** is also weak. This finding is not in the brief, but it decides the 660/661 transition:

- Between **513 and 659px**, the mobile layout (`h1 { max-width: none }`) breaks the H1 as **"Juga al penjat online en / català."**, leaving an orphaned word (`f1-599.png`).
- From about 650px it fits on **one line** (`f1-660.png`).
- The stacked buttons stretch to 551–612px. That layout was approved at 390 and 320; nobody evaluated it at 600+.

## 2. T1 — Centred single column

| 661×1000 | 700×1000 | 768×1024 | 820×1180 | 860×1180 |
| --- | --- | --- | --- | --- |
| ![T1 661](../../design-explorations/phase-2-1-tablet/screenshots/t1-661.png) | ![T1 700](../../design-explorations/phase-2-1-tablet/screenshots/t1-700.png) | ![T1 768](../../design-explorations/phase-2-1-tablet/screenshots/t1-768.png) | ![T1 820](../../design-explorations/phase-2-1-tablet/screenshots/t1-820.png) | ![T1 860](../../design-explorations/phase-2-1-tablet/screenshots/t1-860.png) |

**Composition.**
- The whole page is set on one centred **560px measure**: topbar, copy, illustration card and footer share both edges.
- Inside it, everything stays left-aligned: brand, eyebrow, H1, lede, buttons and the daily title start on the same x.
- The compact pair is unchanged.
- The daily hairline and the card span the full measure, as the hairline already does on phones. Together they draw the column's right edge, which the text never reaches.
- The card keeps F1's **stacked** drawing (196px) above 32px slots, the same proportions as the desktop card (250/32).
- The H1 grows with the measure, `clamp(40px, 5.6vw, 46px)`: 40px at 661–714, 43 at 768, 46 from 820. So "online en català." ends near the pair's right edge (456 vs 489 at 768).
- The lede is 16px, as on phones.

**What works.**
- **It fills a portrait screen.** At 768×1024 the air is 104/56px, against F1's band at 163/115. At 700 it is 95/47.
- **The primary sits highest of the three options:** y=376 at 661–700, 391 at 768, 472 at 820–860. With F1's band it sat at 444, 456 and 534.
- **One alignment system.** Measured shell edges are 104 and 664 at 768: the card's edges are exactly the topbar's and the footer's. The illustration reads as the foot of the content, not as a separate strip.
- **The drawing is the familiar stacked image,** at the same proportions as desktop.
- **It is resilient.** The H1 holds 2 lines at every width in CA and ES, including with the narrow serif and with a 20px minimum font size. There is no overflow and no clipping. The completed-state caption ("No ha podido ser · vuelve mañana") fits on one line at 700.

**Weaknesses.**
- In the upper half of the measure, the H1 and the pair fill about 60–70% of the 560px (63% and 69% at 768). The right third beside them is empty. It reads as the ragged right of a text column, because the hairline and the card below define the full width. Narrowing the measure further would pull the card in too, and the drawing would then crowd its frame.
- **The card is landscape (560×336, 1.67:1).** The drawing occupies its central 35%. I kept it at the full measure on purpose:
  - a narrower centred card no longer aligns with the text edge;
  - a narrower left-aligned card recreates the empty right side.
- **861 is a full recomposition:** one column becomes two, the primary moves 472 → 649 and the H1 46 → 40. See §5.

## 3. T2 — Compact two columns

| 661×1000 | 700×1000 | 768×1024 | 820×1180 | 860×1180 |
| --- | --- | --- | --- | --- |
| ![T2 661](../../design-explorations/phase-2-1-tablet/screenshots/t2-661.png) | ![T2 700](../../design-explorations/phase-2-1-tablet/screenshots/t2-700.png) | ![T2 768](../../design-explorations/phase-2-1-tablet/screenshots/t2-768.png) | ![T2 820](../../design-explorations/phase-2-1-tablet/screenshots/t2-820.png) | ![T2 860](../../design-explorations/phase-2-1-tablet/screenshots/t2-860.png) |

**Composition.**
- The desktop grid simply continues below 861, with one change: the copy column has a floor, `minmax(max-content, 1.1fr) minmax(0, .9fr)`. The H1 (17ch), the pair and the lede therefore never narrow, and the illustration column absorbs all the lost width.
- The card keeps the stacked drawing and scales with **container query units**: drawing `min(100%, 250px)`, slots `clamp(18px, 13cqi, 32px)`.
- The H1 stays at desktop's 40px.

**What works.**
- **The upper boundary disappears.** At 860 the layout is almost pixel-identical to 861 (card 351×375 vs 351×379, primary 650 vs 649).
- It is the closest thing to "desktop, smaller". Text and illustration sit side by side, as at 1024 and 1440.
- The copy column never becomes narrow. The H1 is 2 lines everywhere.

**Weaknesses.**
- **It floats in the middle of a portrait screen.** The composition is about 520px tall, so the air is **266/218px at 661–700, 276/228 at 768 and 353/305 at 820–860**. That is more empty paper than F1's band, and it is the defining problem of this variant. Top-aligning the page would just move all of that paper below.
- **The primary drops:** y=560 at 661–700, 572 at 768, 650 at 820–860. That is 116px lower than F1's band at every width, and 178–184px lower than T1. It is still above the fold, but it is no longer in the upper half.
- **The illustration shrinks to a thumbnail at the narrow end.**

  | Width | Card | Drawing | Slots |
  | --- | --- | --- | --- |
  | 661 | 176px | 134px | 18px |
  | 661, ES | 166px | | |
  | 700 | 211px | 167px | 22px |

  The identity anchor becomes the smallest element in the hero.
- **The edge is crowded.** The secondary button ends 32px from the card at 661–768. The two columns touch rather than relate: no edge, axis or height aligns.
- **The 660/661 jump is the largest of the three:** full-width stacked mobile becomes two columns with a 176px card (`t2-661.png`).
- **It cannot start lower.** At 600 the card column would be about 112px, so the 660/661 weakness of the mobile layout cannot be fixed with T2.

## 4. Direct comparison

| Width | F1 (approved band) | **T1** | T2 |
| --- | --- | --- | --- |
| 700 | ![](../../design-explorations/phase-2-1-tablet/screenshots/f1-700.png) | ![](../../design-explorations/phase-2-1-tablet/screenshots/t1-700.png) | ![](../../design-explorations/phase-2-1-tablet/screenshots/t2-700.png) |
| 768 | ![](../../design-explorations/phase-2-1-tablet/screenshots/f1-768.png) | ![](../../design-explorations/phase-2-1-tablet/screenshots/t1-768.png) | ![](../../design-explorations/phase-2-1-tablet/screenshots/t2-768.png) |
| 820 | ![](../../design-explorations/phase-2-1-tablet/screenshots/f1-820.png) | ![](../../design-explorations/phase-2-1-tablet/screenshots/t1-820.png) | ![](../../design-explorations/phase-2-1-tablet/screenshots/t2-820.png) |
| 860 | ![](../../design-explorations/phase-2-1-tablet/screenshots/f1-860.png) | ![](../../design-explorations/phase-2-1-tablet/screenshots/t1-860.png) | ![](../../design-explorations/phase-2-1-tablet/screenshots/t2-860.png) |

Measured, Catalan (Spanish gives identical positions; T2's card is 9–10px narrower at 661–768):

| | 700×1000 | 768×1024 | 820×1180 | 860×1180 |
| --- | --- | --- | --- | --- |
| **Primary y** F1 / **T1** / T2 | 444 / **376** / 560 | 456 / **391** / 572 | 534 / **472** / 650 | 534 / **472** / 650 |
| **H1** F1 / **T1** / T2 | 40 / **40** / 40 | 40 / **43** / 40 | 40 / **46** / 40 | 40 / **46** / 40 |
| **Illustration** F1 / **T1** / T2 | 652×197 / **560×336** / 211×264 | 720×197 / **560×336** / 272×339 | 772×197 / **560×336** / 333×374 | 812×197 / **560×336** / 351×375 |
| **Drawing** F1 / **T1** / T2 | 136 / **196** / 167 | 136 / **196** / 224 | 136 / **196** / 250 | 136 / **196** / 250 |
| **Air above / below** F1 | 152 / 104 | 163 / 115 | 240 / 192 | 239 / 191 |
| **Air above / below** **T1** | **95 / 47** | **104 / 56** | **179 / 131** | **179 / 131** |
| **Air above / below** T2 | 265 / 217 | 276 / 228 | 353 / 305 | 352 / 304 |
| **Side margins** F1 / **T1** / T2 | 24 / **70** / 24 | 24 / **104** / 24 | 24 / **130** / 24 | 24 / **150** / 24 |

## 5. Breakpoint transitions

| Boundary | T1 | T2 |
| --- | --- | --- |
| **660 → 661** (current) | Mobile at 660 has a one-line H1 and 612px buttons. T1 at 661 has a 2-line H1, the compact pair and a 560 card. The jump is large, but it comes from the stretched mobile layout. | The same mobile layout becomes two columns with a **176px card**. The largest jump of the three. |
| **860 → 861** | Full recomposition: one column becomes two, the primary moves 472 → 649 and the H1 46 → 40. | **Seamless**: pixel-near identical. |
| **1024×768** | Unchanged (byte-identical to F1). | Unchanged. |
| **844×390 landscape phone** | Primary at y=365, below the 390 fold. | y=370, below the fold. |

The landscape phone is the same for F1's band (y=367): the 72px top padding plus the topbar fill the first screen, and no tablet treatment changes that.

**How much do the boundaries matter?** A device sits at one width per orientation. Rotating an iPad goes from 768 to 1024 (T1 to desktop), and a recomposition on rotation is expected. Only a desktop window being dragged crosses 860/861 continuously. **The per-device composition is what users actually see.** T2's seamless 861 is real but rarely seen, while its floating composition shows on every portrait iPad.

### 5.1 Breakpoint study: T1 from 600px

`t1-600.html` simulates moving the mobile/tablet boundary from 660/661 to **599/600**. 600dp is also Material's compact/medium window-size boundary: all phones in portrait are ≤430, and 7″ Android tablets are 600 wide.

| Mobile 599 (approved) | Mobile 599 + H1 17ch | **T1 600** | T1 640 |
| --- | --- | --- | --- |
| ![](../../design-explorations/phase-2-1-tablet/screenshots/f1-599.png) | ![](../../design-explorations/phase-2-1-tablet/screenshots/bp-599-h1cap.png) | ![](../../design-explorations/phase-2-1-tablet/screenshots/bp-600.png) | ![](../../design-explorations/phase-2-1-tablet/screenshots/bp-640.png) |

**What changes.**
- The stretched mobile range shrinks from 431–660 to 431–599.
- Across 599/600, the **side margins stay at 24px**: at 600 the 560 measure is capped by the viewport, so T1 starts full-width and only gains margins as the screen widens. The H1 also stays the same, as long as the cap below is applied. The primary moves 316 → 356, the pair goes from stacked to side by side, and the bare 100px drawing becomes the card.
- **Mobile H1 cap.** Replacing the mobile `h1 { max-width: none }` with `17ch`, the value desktop and tablet already use, removes the "online en / català." orphan everywhere from 431 to 599. **It is byte-identical at 390 and 320 in both languages**, because 17ch is wider than those phones' content box. It is a fix to an unreviewed width range, not a change to the approved mobile design.
- **Cost:** production's `max-width: 660px` block mixes homepage rules with match, how-to and lobby rules, so it has to be split (§7.2). The multiplayer form and invitation branches also use `.home-page`. At 600–660 they get the centred shell they already have at 661–1100.

## 6. Evaluation

| Criterion | T1 Centred column | T2 Compact two columns |
| --- | --- | --- |
| 1. **Visual balance** | **Good.** Fills the portrait height (air 95–179 above). Symmetric margins with a left-aligned interior; the ragged right of the copy is contained by the full-width hairline and card. | Balanced horizontally, but the hero floats with 266–353px of empty paper above and 218–305 below. |
| 2. **Content alignment** | **One measure.** Brand, copy, hairline, card and footer share both edges. | Copy aligns to the shell; the card aligns to nothing, and the secondary ends 32px from it. |
| 3. **Illustration integration** | **Stacked image** at 196px. The card is the foot of the measure and as wide as the hairline above it. A landscape frame, though. | Stacked image, portrait card, but 134–167px at 661–700 and slots of 18–22px. A thumbnail where width is short. |
| 4. **Multiplayer CTA** | **Highest:** y=356–472 across 600–860, and the first full-colour block under the H1. | Lowest: y=560–650. Still above the fold, but in the lower half at every width. |
| 5. **Readability and typography** | H1 40→46 tracks the measure. 16px lede. 2 lines everywhere, in both serifs and with large text. | H1 fixed at 40, 2 lines everywhere. 16px lede. Fine. |
| 6. **Consistency with F1** | It is the mobile structure (copy, then a stacked drawing) given the desktop's card, pair and topbar. Each element is borrowed from an approved breakpoint. | It is the desktop composition, compressed. It matches 861+ exactly, and matches mobile not at all. |
| 7. **Transitions** | 861 recomposes (rarely seen; rotation is the common case). With the 600 boundary, 599/600 keeps the same margins and H1. | **861 seamless.** 661 has the worst jump, and the variant cannot move lower to fix it. |
| 8. **Accessibility and keyboard** | DOM, visual and tab order are identical (topbar link, primary, secondary, daily, CA/ES). The focus ring on the daily row spans the measure, as on phones. Targets ≥48 (50 with large text), captions 14px. | Same DOM and tab order; the card is `aria-hidden`. Same targets and captions. |
| 9. **Implementation complexity** | **8 rules** in one media block, with no new technique. The optional 600 boundary needs the 660 block split (mechanical). | A similar amount of CSS (one grid rule plus card scaling), but it needs container queries (`container-type`, `cqi`) and a content-dependent `max-content` track. Its sizes then differ per language (as noted, the card is 9–10px narrower in Spanish at 661–768). |

**Which looks more intentional.** T1 does. On a portrait tablet it uses the dimension the screen actually has, height. The card's width is the same rule that places every other element, so nothing looks like an accident of the breakpoint. T2 is a well-behaved shrink of desktop: correct at 860, but at 661–768 it looks like a desktop page that has not noticed it is on a tall screen, with a thumbnail illustration pressed against the buttons. Its main advantage, a seamless 861, appears only when a desktop window is resized.

## 7. Recommendation

**Adopt T1, from 600px.** Concretely:

1. At **600–860**, use the centred 560px measure (§7.1). This replaces F1's 661–860 landscape band.
2. **Move the homepage's mobile boundary from 660 to 599** (§7.2).
3. In the mobile block, give the **H1 `max-width: 17ch`** instead of `none` (byte-identical at 390/320).
4. **≥861 is unchanged** (F1 §6.4).

If the team prefers not to touch the mobile boundary now, steps 2–3 can ship later. T1 alone at 661–860 is already a clear improvement over the band; only the 660/661 jump remains.

### 7.1 Tablet CSS (production selectors, on top of F1 §6.3)

```css
/* Portrait tablet (replaces F1's 661–860 landscape band). One centred measure: topbar, copy,
   illustration card and footer share both edges; the card keeps the stacked drawing. */
@media (min-width: 600px) and (max-width: 860px) {
  .home-shell { width: min(100%, 560px); }
  .home-hero { grid-template-columns: minmax(0, 1fr); gap: 32px; }
  .home-copy { padding: 0; }
  .home-copy h1 { font-size: clamp(40px, 5.6vw, 46px); }
  .home-lede { font-size: 16px; }
  /* Compact pair kept; the empty third track lets the daily row and its hairline span the measure. */
  .mode-pair { grid-template-columns: auto auto minmax(0, 1fr); width: 100%; }
  .home-hero .home-preview { justify-self: stretch; width: 100%; max-width: none; aspect-ratio: auto; padding: 32px; }
  .home-hero .preview-drawing { width: 196px; }
}
```

**Notes.**
- **Inherited from F1's desktop card:** the board's 16px row gap and the 32×42px / 25px letters. **Inherited from F1's desktop shell:** the topbar "Com es juga?" link, the row footer, and the centred page with 72px top padding.
- **Specificity:** keep the `.home-hero` prefix on the card rules, as F1 §6.4 already notes, or the desktop card rules win.
- **`order`:** F1 §6.4 already removes production's `.home-preview { order: -1 }`. T1 depends on that, because the card must follow the copy.
- **`.preview-drawing`:** production wraps the SVG in `.preview-drawing`; the prototype sizes `.hangman` directly. Size the wrapper, because production's `.preview-drawing .hangman` fills it.
- **iOS install card:** at `min(100%, 620px)` inside the 560 shell, it takes the full measure on iPads. It was not captured, because emulation has no touch points.

### 7.2 Mobile boundary (≤599) and H1 cap

- **Move every homepage-menu rule from production's `@media (max-width: 660px)` block,** and F1 §6.4's "≤660" row, into `@media (max-width: 599px)`. That covers:
  - `.home-page`
  - `.home-shell`
  - `.home-topbar`
  - `.home-topbar-actions`
  - `.home-help-link*`
  - `.home-hero`
  - `.home-copy*`
  - `.home-modes` / `.mode-*`
  - `.home-preview`
  - `.preview-*`
  - `.home-domain`
  - `.home-footer`
  - `.ios-install-*`
- **Split the mixed selector lists:** `.home-topbar, .howto-header` becomes two rules.
- **Leave everything else at 660:** match, how-to, lobby, chat.
- In the moved block, write `.home-copy h1 { max-width: 17ch; … }` where F1 has `max-width: none`.
- Keep F1's `≤380px` rules as they are.

### 7.3 Updated F1 §6.4 table

| Width | Behaviour |
| --- | --- |
| ≥1101 | Unchanged |
| 861–1100 | Unchanged |
| **600–860** | **T1:** one centred 560px measure. Copy left-aligned. Compact pair. Daily hairline and illustration card span the measure; the card has the stacked 196px drawing above 32px slots. H1 `clamp(40px, 5.6vw, 46px)`, lede 16px. |
| **≤599** | F1's mobile rules (formerly ≤660), with H1 `max-width: 17ch` |
| ≤380 | Unchanged |

## 8. Verification criteria

Use the F1 capture method (Noto fallback, Firefox, desktop UA). Tolerances: positions ±12px; card height ±24px, because production's `.preview-board`/`.preview-word` padding differs slightly from the prototype.

| Viewport | Primary top | H1 | Shell (left–right) | Card | Other |
| --- | --- | --- | --- | --- | --- |
| 599×960 | 316 | 40px, 2 lines, "Juga al penjat / online en català." | 24–575 | bare 100px drawing | Stacked full-width buttons (approved mobile) |
| 600×960 | 356 | 40px, 2 lines, same break | 24–576 | 552×336 | Pair side by side; topbar link visible |
| 700×1000 | 376 | 40px, 2 lines | 70–630 | 560×336 | Air above ≤ 100 |
| 768×1024 | 391 | 43px, 2 lines | 104–664 | 560×336 | Card edges = hairline edges = footer edges |
| 820×1180 | 472 | 46px, 2 lines | 130–690 | 560×336 | |
| 860×1180 | 472 | 46px, 2 lines | 150–710 | 560×336 | |
| 861, 1024, 1440, 390, 320 | as F1 §6.8 | as F1 §6.8 | | | Pixel-compare against the F1 captures: no change |

**Also check:**
- No horizontal overflow at 480–1440, CA and ES. Captions compute to 14px; targets are ≥48px.
- The H1 is 2 lines at 431–860 in CA and ES. "català." never stands alone on a line.
- Tab order: topbar "Com es juga?", primary, secondary, daily, CA/ES at 600–860. The focus ring is fully visible on all three links.
- The multiplayer form, the invitation page, the how-to page and the match page render **unchanged** at 600–660. The only exception is the multiplayer form/invitation `.home-page` shell, which is centred like at 661+.
- `?estat` equivalents: completed captions fit on one line (captured: "Encertada amb 2 errors · torna demà" at 768 CA, "No ha podido ser · vuelve mañana" at 700 ES).

## 9. Limitations

- **Gecko only, with Noto in place of Georgia.** T1's 46px H1 at 820–860 holds 2 lines with Liberation Serif (narrower) and Noto Serif (wider), so Georgia should too. Confirm once on a real iPad.
- **Landscape phones (844×390)** show the primary below the fold in F1, T1 and T2 alike. Fixing that needs a height-based rule, which is outside this task.
- **Portrait 1024×1366** (iPad Pro 12.9″ / iPad Air 13″) falls in the desktop range and will float in the same way T2 does (cf. 861×1180: 354px of air above). It is outside the requested range, but worth a follow-up using the same T1 measure behind an orientation or aspect-ratio query, if the team cares about large iPads.
- **Real iPads report a Mac user agent with touch, so production shows the iOS install card.** It was not captured; by construction it takes the 560 measure under the card.
