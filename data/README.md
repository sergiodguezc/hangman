# Catalan vocabulary data

This directory contains the dataset loaded by the Catalan-learning Hangman mode. The approved lexical baseline is [Vocabulary v1](../docs/vocabulary-v1.md). Current production has 544 entries with complete CEFR metadata; gameplay groups are A1/A2 (basic), B1/B2 (intermediate), C1/C2 (advanced). The October metadata repair is documented in [the audit report](../docs/audit-2026-10-08.md).

The experiment sections below describe the historical review pipeline. Its ignored outputs are not runtime dependencies. Validate current data with `npm run vocab:validate` and `npm run test:vocabulary`; do not blindly regenerate approved v1 lexical fields from older intermediate files.

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

For ambiguous or incomplete meanings that need contextual enrichment, the pipeline can generate an additional offline LLM input/output pair:

- `data/intermediate/meaning-enrichment-input.json`
- `data/intermediate/meaning-enrichment-output.json`

Run `npm run vocab:enrich-llm` with `OPENAI_API_KEY` set to produce those files. The command paces requests, retries request-rate limits, checkpoints each result, and resumes valid cached results. `npm run vocab:build` will use cached enrichment output if it is present, but it never calls the API itself.

Every result has `accept`, `review`, or `reject` status, a deterministic heuristic confidence, reason, source, evidence, and a content hash that invalidates stale decisions. Acceptance requires one contextual `translationEs` and a learner-facing `definitionCa`; entries without a trustworthy definition go to review rather than receiving an invented one. Accepted production records expose `answerCa`, `type`, `definitionCa`, and `translationEs`. `hintEs`, `translationsEs: [translationEs]`, and `targetExpression` remain compatibility aliases.

Human decisions take precedence. Put accepted corrections (including `translationEs` and `definitionCa`) in `config/translation-overrides.json`, and put one normalized Catalan word per line in `config/rejected-vocabulary.txt`. Review and rejected records are omitted from production. `review/summary.json` and the deterministic 50-record `review/sample.json` support an offline human or future LLM-assisted review step; the runtime has no API dependency.

Difficulty is an approximate, deterministic game label, not CEFR or an official linguistic level. It uses selection rank, total letters, and expression word count; spaces do not inflate the letter count, though expressions of four words are hard. `Aprendre català` filters by `linguistics.cefr`; `difficulty` remains a compatibility/game label and is not a substitute for CEFR.

## Optional linguistic metadata

The schema permits an optional `linguistics` object for compatibility with older/pipeline records. The current production corpus has complete metadata and learning gameplay requires CEFR coverage; `test:vocabulary` guards this coverage and parity with the reviewed artifact.

Reviewed metadata is stored separately in `data/review/linguistic-metadata.json`, keyed by the stable production `id`:

```json
{
  "example-id": {
    "cefr": "A2",
    "confidence": 0.9,
    "thematicCategory": "food-and-kitchen",
    "partOfSpeech": "noun",
    "provenance": {
      "source": "review",
      "version": "2026-08-26",
      "method": "manual-cefr-estimate"
    }
  }
}
```

The checked-in artifact now contains all 544 completed classifications, with targeted rechecks taking precedence. Preserve the reviewed artifact and runtime metadata together; do not invent replacement classifications to fill a level.

Supported CEFR values are `A1`, `A2`, `B1`, `B2`, `C1`, and `C2`. These values will be estimates for learner-facing organization, not official certification. If `confidence` is present, it must be a number from `0.0` to `1.0` inclusive and represents confidence in the linguistic classification, not confidence in the existing game difficulty. `thematicCategory`, if present, must be a non-empty string. `partOfSpeech`, if present, uses the same values as the top-level compatibility field: `noun`, `verb`, `adjective`, `adverb`, or `other`. `provenance.source` is required when `provenance` exists; `version` and `method` are optional strings.

`npm run vocab:build` loads `data/review/linguistic-metadata.json` if present, validates every reviewed item, and merges matching entries as `linguistics`. The merge is additive only: metadata may not alter `id`, `word`, `answerCa`, `difficulty`, translations, definitions, examples, or the daily pool. The build fails if the artifact references an unknown vocabulary ID.

## CEFR classification experiment

Phase 3 adds an isolated 60-entry OpenAI experiment. Its outputs are experimental evidence only and are not promoted into `data/review/linguistic-metadata.json`, `data/vocabulary.json`, gameplay, or the UI.

Generate or inspect the deterministic sample:

```sh
npm run vocab:cefr-sample
```

This writes `data/experiments/cefr-sample-60.json`. The sample is chosen from the current production dataset and intentionally covers difficulty labels, frequency buckets, word length, POS, possible length/frequency distortions, concrete and abstract vocabulary, verbs/nouns/adjectives/adverbs, and existing expressions. The sample includes the current `difficulty` for later comparison, but that field is never sent to the model.

The model request classifies `classificationTarget`, which is always the learner-facing `answerCa`. For ordinary words this is the word itself; for expressions it is the complete phrase, such as `una mica`, `de tant en tant`, or `d'altra banda`. The original pipeline token is sent only as `sourceWord` provenance/context, and `type` tells the model whether the target is a `word` or an `expression`.

Run the explicit OpenAI experiment only when you intend to spend API credits:

```sh
npm run vocab:cefr-experiment -- --model gpt-5.4-mini
```

The model can also be configured with `VOCAB_CEFR_MODEL` or, secondarily, `VOCAB_LLM_MODEL`; the documented default is `gpt-5.4-mini`. The command requires `OPENAI_API_KEY`, uses structured JSON output, writes `data/experiments/cefr-sample-60-output.json`, and refuses to repeat a complete cached run for the same sample hash, prompt version, and model unless `--force` is provided.

Generate the evaluation report after the experiment output exists:

```sh
npm run vocab:cefr-report
```

This writes `docs/cefr-classification-experiment.md`, comparing the isolated CEFR estimates with the existing Penjat difficulty heuristic. Disagreement is expected and should be reviewed, not treated as a pipeline error.

Phase 4 repeats the same 60-entry CEFR experiment independently and compares stability. The second run uses the same sample and same prompt criteria, but writes a separate artifact and does not read the first run's classifications:

```sh
npm run vocab:cefr-experiment-run2 -- --model gpt-5.4-mini
npm run vocab:cefr-stability
```

The stability command reads `data/experiments/cefr-sample-60-output.json` and `data/experiments/cefr-sample-60-output-run2.json`, writes `data/experiments/cefr-sample-60-consensus.json`, and generates `docs/cefr-classification-stability.md`. CEFR distance is ordinal (`A1=1` through `C2=6`): distance 0 is exact agreement, distance 1 is adjacent disagreement, and distance >=2 is major disagreement. Consensus status is `stable` for exact agreement, `review-adjacent` for adjacent disagreement, and `review-major` for major disagreement.

Phase 4 also adds a separate data-quality audit over the same 60 entries. This is a distinct API operation from CEFR classification and checks whether `answerCa`, `type`, POS, Catalan definition, Spanish translation, and example appear internally consistent:

```sh
npm run vocab:cefr-data-quality -- --model gpt-5.4-mini
npm run vocab:cefr-data-quality-report
```

The audit writes `data/experiments/cefr-sample-60-data-quality.json` and `docs/cefr-sample-data-quality.md`. It can flag `pos-mismatch`, `sense-mismatch`, `translation-mismatch`, `example-mismatch`, `expression-mismatch`, `possible-polysemy`, or `other` with `low`, `medium`, or `high` severity. It never rewrites vocabulary records.

Phase 5 scales the same methodology to the current 544-entry production vocabulary, still as isolated experimental evidence:

```sh
npm run vocab:cefr-full -- --model gpt-5.4-mini
npm run vocab:cefr-quality-full -- --model gpt-5.4-mini
npm run vocab:cefr-full-report
```

`vocab:cefr-full` writes `data/experiments/cefr-full-544-output.json`. `vocab:cefr-quality-full` writes `data/experiments/cefr-full-544-data-quality.json`. These are separate paid API operations with separate caches keyed by production input hash, prompt version, and model. `vocab:cefr-full-report` is local-only after both outputs exist; it writes `data/experiments/cefr-full-544-review.json` and `docs/cefr-full-vocabulary-analysis.md`.

The full quality audit is resumable and batched. If `data/experiments/cefr-full-544-data-quality.json` already contains valid results for some IDs, rerunning `npm run vocab:cefr-quality-full` validates and preserves them, then requests only missing entries. Defaults are 20 entries per request and 3 concurrent requests:

```sh
npm run vocab:cefr-quality-full -- --model gpt-5.4-mini --batch-size 20 --concurrency 3
```

Progress is checkpointed atomically after every successful batch, while results are cached by individual vocabulary ID, with output such as `Cached: 26`, `Remaining: 518`, and `Quality audit: 146 / 544 complete`. If a large batch repeatedly fails because of size/structured-output limits, it is split into smaller batches and retried without losing completed entries.

The quality audit model receives only compact consistency-audit input: `id`, `answerCa`, source `word`, `type`, `partOfSpeech`, `definitionCa`, `translationEs`, and `exampleCa`. It does not receive Penjat `difficulty`, CEFR level, CEFR confidence, CEFR reason, thematic category, diagnostic buckets, or game metadata.

Phase 6A proposes repairs for only the entries flagged by the completed full data-quality audit. This is still proposal-only experimental work; it does not modify `data/vocabulary.json`, CEFR outputs, approved metadata, gameplay, or daily-word IDs.

```sh
npm run vocab:repair-propose -- --model gpt-5.4-mini --batch-size 20 --concurrency 3
npm run vocab:repair-validate
npm run vocab:repair-report
```

`vocab:repair-propose` reads the 139 entries whose full quality audit status is `review` and writes `data/experiments/vocabulary-repair-proposals.json`. It is resumable and uses the same default batch size/concurrency as the full quality audit. The repair model receives `id`, source `word`, learner-facing `answerCa`, `type`, `partOfSpeech`, `definitionCa`, `translationEs`, `exampleCa`, quality issues, and optional compact CEFR context (`cefr`, `confidence`) when the completed CEFR output exists. It does not receive Penjat `difficulty`.

Repair proposals are intentionally minimal. Unchanged fields should be omitted or set to `null`; proposed examples must contain the exact `answerCa`, and expression examples must contain the complete expression. `vocab:repair-validate` checks IDs, duplicate/unknown entries, review-only coverage, unsupported fields, unchanged rewrites, valid POS/type values, expression/example containment, no ID changes, and manual/CEFR-recheck flags for risky answer/type changes. `vocab:repair-report` writes `docs/vocabulary-repair-analysis.md`.

The full review queue uses these statuses:

- `auto-candidate`: valid classification, confidence >= 0.90, and no medium/high data-quality issue.
- `review-confidence`: confidence < 0.90 only.
- `review-quality`: medium/high data-quality issue only.
- `review-both`: both low confidence and medium/high data-quality issue.

These statuses are triage labels only. They do not approve, rewrite, or promote metadata.

For future vocabulary additions, use a combined one-request enrichment command instead of separately calling CEFR classification and quality audit:

```sh
npm run vocab:cefr-combined -- --input path/to/input.json --output path/to/output.json --model gpt-5.4-mini
```

The combined output returns both `classification` and `quality` in one structured response. It uses the same batch/concurrency/checkpoint machinery and supports `--batch-size` and `--concurrency`. This is for future entries and must not be used to rerun the already completed 544-entry CEFR classification.

## Regeneration

Requires Python 3, Git, and the project's existing npm installation; there are no Python dependencies.

```sh
npm run vocab:fetch
npm run vocab:extract
npm run vocab:enrich
npm run vocab:clean
npm run vocab:enrich-llm
npm run vocab:build
npm run vocab:validate
```

`npm run vocab` performs the full sequence. Production builds fail if a selected word has no Spanish translation. Run `python3 scripts/vocab_pipeline.py build --allow-incomplete` only for explicitly incomplete development output.

Generated files are UTF-8, readable Unicode JSON. Metadata records pinned source commits instead of a volatile timestamp.
