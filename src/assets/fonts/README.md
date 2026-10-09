# Penjat UI font

`penjat-ui-variable.woff2` (30,580 bytes) is a subset of **Source Sans 3** 3.052 by Paul D. Hunt / Adobe, licensed under the SIL Open Font License 1.1. The license is shipped with the site at `public/licenses/source-sans-3-OFL.txt` (served as `/licenses/source-sans-3-OFL.txt`).

The upstream copyright reserves the font name "Source", and subsetting creates a Modified Version under the OFL. The modified font is therefore renamed **Penjat UI** in its `name` table and in CSS. Its copyright, trademark and license records are preserved.

- Upstream: `ofl/sourcesans3/SourceSans3[wght].ttf` from https://github.com/google/fonts. SHA-256 `042fe2cc0b933e328410d7acbd0aa6a1873dca5aef81875f4bc214b08825c7b9`.
- Weight axis limited to 400–700, roman only. No italics, widths or alternate figure sets.
- Coverage: Basic Latin, Latin-1 (all Catalan and Spanish letters, `·`, `¡ ¿ « »`), `Ŀ ŀ`, `Œ œ`, combining grave, acute, circumflex, tilde, diaeresis and cedilla, typographic quotes and dashes, `…`, `€` and arrows. Glyphs outside the subset (emoji, `✓`, `★`) fall back to system fonts.
- Rebuild: `python3 scripts/build-ui-font.py 'SourceSans3[wght].ttf' OUTDIR`. This needs fontTools and `woff2_compress`, and the build is deterministic.

## Fraunces display font (Phase 3A)

`fraunces-latin-variable.woff2` (56,080 bytes) is a local subset of Fraunces by The Fraunces Project Authors, under OFL 1.1 (no Reserved Font Name). License: `public/licenses/Fraunces-OFL.txt`.

- Upstream: https://github.com/google/fonts/tree/main/ofl/fraunces, `Fraunces[SOFT,WONK,opsz,wght].ttf`; source SHA-256 `177ff6c0f14e5550a3c624247cd1189611d4eb65d000b14944c63d967958abbb`.
- Same Catalan/Spanish repertoire as the UI font, including combining accents and `l·l`. Weight 400–900 and optical size 9–144 remain variable; SOFT=100 and WONK=1 match Lovable's headings. Roman only; Georgia/`ui-serif`/`serif` are local fallbacks.
- Rebuild: `python3 scripts/build-display-font.py upstream.ttf src/assets/fonts/fraunces-latin-variable.woff2` (fontTools and `woff2_compress`). No runtime third-party requests. Both fonts are preloaded in the production build and use `font-display: swap`.
- Fraunces serves brand, expressive headings and dictionary words. Controls, body, names, chat and functional titles retain Penjat UI.
