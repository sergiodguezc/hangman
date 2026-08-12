# Catalan vocabulary data

This directory contains the reproducible dataset loaded by the Catalan-learning Hangman mode.

## Sources and licenses

- **Softcatalà `ca-text-corpus`** at commit `5b87343960f72c0a61e5d86651302f0acd42a5a7`. The upstream README releases the repository's `data/` directory under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). It supplies every target word occurrence and Catalan example sentence.
- **Softcatalà `catalan-dict-tools`** at commit `7a076098331b5ad1af3983eae22b952d3b5c54fe`. Its `frequencies/frequencies-dict-forms.txt` improves ranking. Upstream is dual-licensed GPL-2.0-or-later / LGPL-2.1-or-later; see its `LICENSE` and component notices. The resulting field is named `frequencyRank`, not language frequency, because this is an approximate source-specific rank.
- **Apertium `apertium-spa-cat`** at commit `7635fe703b25455efc38e3c22a35b0f9af2a8790`. Its bilingual `apertium-spa-cat.spa-cat.metadix` supplies Spanish translations, lexical validation, and POS tags. Upstream is GPL-2.0; redistribution of derived translation data must retain the applicable GPL obligations and attribution. See upstream `COPYING` and `AUTHORS`.

No proprietary dictionary is used. Raw repositories are downloaded into ignored `data/raw/` directories and are not committed.

## Corpus selection

Included, in descending example priority:

1. `common-voice-sentences.txt` — short, conversational sentences
2. `common-short-sentences.txt` — common short sentences
3. `riuraueditors.txt` — varied edited prose
4. `softcatala.txt` — general/technology prose
5. `proverbs.txt` — useful but idiomatic, deliberately lower priority

Excluded are `dogc.txt` and `dogv.txt` (administrative/legal language), `muni-*` and `cities2.txt` (place names), `wiki.ca*` (very large and proper-name/domain noise), `tocqueville.txt` (literary/political prose), `programari-lliure-llibre.txt` (narrow technical domain), and `incoming/` (unreviewed staging material).

## Pipeline

Extraction reads line by line, normalizes to NFC and lowercase, and preserves Catalan accents, `ç`, `ï`/`ü`, middle dots, and internal hyphens. Apostrophe forms are not targets: the conservative prototype extracts the portion after an apostrophe (`l'avi` → `avi`) without attempting deeper clitic analysis. A small stop list lives at `config/excluded-words.txt`.

Candidates are 4–15 letters, contain only supported characters, and exclude URLs, email-like text, numbers, and malformed fragments. Up to eight examples are retained. A deterministic score prefers 4–14-token sentences near eight tokens, higher-priority sources, and fewer numbers, proper names, or punctuation marks.

Selection requires a one-word Apertium lexical mapping, excludes proper-noun-tagged entries, then ranks by Softcatalà form-frequency rank, weighted corpus-source evidence, corpus count, length, and spelling. `intermediate/translations-es.json` contains raw candidate senses only.

## Contextual meaning review

Known expressions are declared in `config/expressions.json` and detected while candidate examples are selected, before lexical resolution. `npm run vocab:clean` then resolves the complete Catalan example using its target, word class, expression match, curated contextual rules, preferences, translation-quality penalties, and Apertium candidates as evidence. Linguistic data lives under `config/`; the Python resolver applies it generically.

Every result has `accept`, `review`, or `reject` status, a deterministic heuristic confidence, reason, source, evidence, and a content hash that invalidates stale decisions. Acceptance requires one contextual `translationEs` and a learner-facing `definitionCa`; entries without a trustworthy definition go to review rather than receiving an invented one. Accepted production records expose `answerCa`, `type`, `definitionCa`, and `translationEs`. `hintEs`, `translationsEs: [translationEs]`, and `targetExpression` remain compatibility aliases.

Human decisions take precedence. Put accepted corrections (including `translationEs` and `definitionCa`) in `config/translation-overrides.json`, and put one normalized Catalan word per line in `config/rejected-vocabulary.txt`. Review and rejected records are omitted from production. `review/summary.json` and the deterministic 50-record `review/sample.json` support an offline human or future LLM-assisted review step; the runtime has no API dependency.

Difficulty is an approximate, deterministic game label—not CEFR. It uses selection rank, total letters, and expression word count; spaces do not inflate the letter count, though expressions of four words are hard.

## Regeneration

Requires Python 3, Git, and the project's existing npm installation; there are no Python dependencies.

```sh
npm run vocab:fetch
npm run vocab:extract
npm run vocab:enrich
npm run vocab:clean
npm run vocab:build
npm run vocab:validate
```

`npm run vocab` performs the full sequence. Production builds fail if a selected word has no Spanish translation. Run `python3 scripts/vocab_pipeline.py build --allow-incomplete` only for explicitly incomplete development output.

Generated files are UTF-8, readable Unicode JSON. Metadata records pinned source commits instead of a volatile timestamp.
