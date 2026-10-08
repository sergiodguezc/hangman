# Vocabulary v1

Vocabulary v1 is the approved production dataset of 544 entries. It resulted from the completed vocabulary audit and repair pipeline: semantic repairs received independent verification and explicit human resolution, followed by targeted CEFR reclassification of affected entries.

The final pass rechecked 40 entries and changed 14 CEFR classifications. No lexical splits were performed. Vocabulary v1 was explicitly approved for production and is now the baseline; future changes are ordinary incremental improvements or a future Vocabulary v2.

Generated Phase 6 and CEFR artifacts remain locally available under `data/experiments/` and are intentionally Git-ignored. Production validation and final application checks passed.

## CEFR metadata completeness (October 8 audit)

The v1 lexical records were correctly promoted, but only the final 40 targeted CEFR rechecks had been attached. The full 544-entry classification and an earlier 20-entry recheck remained in local artifacts. The repair merges full classification → earlier targeted recheck → final targeted recheck; the earlier `industrial` recheck is retained even though it is not in the final 40. No classification requests were rerun and no lexical fields changed.

`data/review/linguistic-metadata.json` is now the checked-in merge source, with per-entry provenance; `data/vocabulary.json` carries matching metadata. Future checkout/build verification does not need ignored experiment files. These remain estimated learner levels, not official certification.

Final coverage: A1 173, A2 242, B1 104, B2 21, C1 3, C2 1. Thus basic has 415 words, intermediate 125, advanced 4, and all 544. The small advanced pool is real and can repeat quickly; expanding/reviewing it is a separate editorial task.
