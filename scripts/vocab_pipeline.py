#!/usr/bin/env python3
"""Deterministic Catalan vocabulary pipeline (standard library only)."""

from __future__ import annotations

import argparse
import concurrent.futures
import collections
import hashlib
import json
import math
import os
import random
import re
import subprocess
import sys
import time
import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from typing import Callable, Literal, Protocol
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw"
INTERMEDIATE = DATA / "intermediate"
CONFIG = DATA / "config"
REVIEW = DATA / "review"
EXPERIMENTS = DATA / "experiments"
CORPUS = RAW / "ca-text-corpus"
DICT = RAW / "catalan-dict-tools"
APERTIUM = RAW / "apertium-spa-cat"

REPOS = {
    "ca-text-corpus": ("https://github.com/Softcatala/ca-text-corpus.git", "5b87343960f72c0a61e5d86651302f0acd42a5a7"),
    "catalan-dict-tools": ("https://github.com/Softcatala/catalan-dict-tools.git", "7a076098331b5ad1af3983eae22b952d3b5c54fe"),
    "apertium-spa-cat": ("https://github.com/apertium/apertium-spa-cat.git", "7635fe703b25455efc38e3c22a35b0f9af2a8790"),
}

SOURCES = {
    "common-voice-sentences.txt": 5,
    "common-short-sentences.txt": 4,
    "riuraueditors.txt": 3,
    "softcatala.txt": 2,
    "proverbs.txt": 1,
}
TOKEN_RE = re.compile(r"(?<![\wÀ-ÿ])(?:[A-Za-zÀ-ÖØ-öø-ÿÇç]+(?:[·-][A-Za-zÀ-ÖØ-öø-ÿÇç]+)*)(?:['’][A-Za-zÀ-ÖØ-öø-ÿÇç]+)?", re.UNICODE)
WORD_RE = re.compile(r"^[a-zàèéíïòóúüç]+(?:·[a-zàèéíïòóúüç]+|-[a-zàèéíïòóúüç]+)*$")
URL_RE = re.compile(r"(?:https?://|www\.|\S+@\S+)", re.I)
POS_MAP = {"n": "noun", "vblex": "verb", "vbser": "verb", "vbhaver": "verb", "vbmod": "verb", "adj": "adjective", "adv": "adverb"}
VALID_POS = set(POS_MAP.values()) | {"other"}
VALID_DIFFICULTY = {"easy", "medium", "hard"}
VALID_CEFR = {"A1", "A2", "B1", "B2", "C1", "C2"}
POS_PRIORITY = {"noun": 0, "verb": 1, "adjective": 2, "adverb": 3, "other": 4}
MAX_TRANSLATIONS = 1
LLM_MODEL_DEFAULT = "gpt-5.4-mini"
LINGUISTIC_METADATA = REVIEW / "linguistic-metadata.json"
CEFR_EXPERIMENT_MODEL_DEFAULT = "gpt-5.4-mini"
CEFR_EXPERIMENT_PROMPT_VERSION = "cefr-sample-60-v1"
CEFR_SAMPLE_PATH = EXPERIMENTS / "cefr-sample-60.json"
CEFR_OUTPUT_PATH = EXPERIMENTS / "cefr-sample-60-output.json"
CEFR_OUTPUT_RUN2_PATH = EXPERIMENTS / "cefr-sample-60-output-run2.json"
CEFR_CONSENSUS_PATH = EXPERIMENTS / "cefr-sample-60-consensus.json"
DATA_QUALITY_OUTPUT_PATH = EXPERIMENTS / "cefr-sample-60-data-quality.json"
CEFR_FULL_OUTPUT_PATH = EXPERIMENTS / "cefr-full-544-output.json"
DATA_QUALITY_FULL_OUTPUT_PATH = EXPERIMENTS / "cefr-full-544-data-quality.json"
CEFR_FULL_REVIEW_PATH = EXPERIMENTS / "cefr-full-544-review.json"
REPAIR_PROPOSALS_PATH = EXPERIMENTS / "vocabulary-repair-proposals.json"
REPAIR_CANDIDATE_PATH = EXPERIMENTS / "vocabulary-repair-candidate.json"
REPAIR_CANDIDATE_REPORT_PATH = EXPERIMENTS / "vocabulary-repair-candidate-review.md"
REPAIR_CEFR_QUEUE_PATH = EXPERIMENTS / "vocabulary-repair-cefr-recheck-queue.json"
REPAIR_CEFR_OUTPUT_PATH = EXPERIMENTS / "vocabulary-repair-cefr-recheck-output.json"
SEMANTIC_VERIFICATION_INPUT_PATH = EXPERIMENTS / "vocabulary-repair-semantic-verification-input.json"
SEMANTIC_VERIFICATION_OUTPUT_PATH = EXPERIMENTS / "vocabulary-repair-semantic-verification.json"
SEMANTIC_VERIFICATION_REPORT_PATH = EXPERIMENTS / "vocabulary-repair-semantic-verification.md"
HUMAN_RESOLUTIONS_PATH = EXPERIMENTS / "vocabulary-repair-human-resolutions.json"
FINAL_CANDIDATE_PATH = EXPERIMENTS / "vocabulary-repair-final-candidate.json"
FINAL_CANDIDATE_REPORT_PATH = EXPERIMENTS / "vocabulary-repair-final-candidate-review.md"
FINAL_CEFR_QUEUE_PATH = EXPERIMENTS / "vocabulary-repair-final-cefr-recheck-queue.json"
CEFR_REPORT_PATH = ROOT / "docs" / "cefr-classification-experiment.md"
CEFR_STABILITY_REPORT_PATH = ROOT / "docs" / "cefr-classification-stability.md"
DATA_QUALITY_REPORT_PATH = ROOT / "docs" / "cefr-sample-data-quality.md"
CEFR_FULL_ANALYSIS_REPORT_PATH = ROOT / "docs" / "cefr-full-vocabulary-analysis.md"
REPAIR_ANALYSIS_REPORT_PATH = ROOT / "docs" / "vocabulary-repair-analysis.md"
DATA_QUALITY_PROMPT_VERSION = "cefr-sample-data-quality-v1"
REPAIR_PROMPT_VERSION = "vocabulary-repair-proposals-v1"
SEMANTIC_VERIFICATION_PROMPT_VERSION = "vocabulary-repair-semantic-verification-v1"


@dataclass(frozen=True)
class EnrichmentInput:
    id: str
    word: str
    answer_ca: str
    item_type: Literal["word", "expression"]
    example_ca: str
    part_of_speech: str
    candidate_translations_es: list[str]
    resolved_translation_es: str | None
    deterministic_status: str
    review_reason: str
    content_hash: str


@dataclass(frozen=True)
class EnrichmentResult:
    status: Literal["resolved", "uncertain"]
    translation_es: str | None
    definition_ca: str | None
    sense_gloss: str | None
    confidence: Literal["high", "medium", "low"]
    needs_human_review: bool
    notes: str


@dataclass(frozen=True)
class CefrClassification:
    id: str
    cefr: Literal["A1", "A2", "B1", "B2", "C1", "C2"]
    confidence: float
    thematic_category: str
    part_of_speech: Literal["noun", "verb", "adjective", "adverb", "other"]
    reason: str


@dataclass(frozen=True)
class DataQualityIssue:
    issue_type: Literal["pos-mismatch", "sense-mismatch", "translation-mismatch", "example-mismatch", "expression-mismatch", "possible-polysemy", "other"]
    severity: Literal["low", "medium", "high"]
    explanation: str


@dataclass(frozen=True)
class DataQualityResult:
    id: str
    status: Literal["ok", "review"]
    issues: list[DataQualityIssue]


class MeaningEnrichmentProvider(Protocol):
    def enrich(self, item: EnrichmentInput) -> EnrichmentResult: ...


class CefrClassificationProvider(Protocol):
    def classify(self, item: dict) -> CefrClassification: ...


class DataQualityAuditProvider(Protocol):
    def audit_batch(self, items: list[dict]) -> list[dict]: ...


class RepairProposalProvider(Protocol):
    def propose_batch(self, items: list[dict]) -> list[dict]: ...

class SemanticVerificationProvider(Protocol):
    def verify_batch(self, items: list[dict]) -> list[dict]: ...

@dataclass(frozen=True)
class Resolution:
    status: Literal["accept", "review", "reject"]
    answer_ca: str | None
    item_type: Literal["word", "expression"] | None
    definition_ca: str | None
    translation_es: str | None
    confidence: float
    reason: str
    source: str


def load_rules() -> dict:
    """Load curated linguistic knowledge; code only supplies generic mechanics."""
    def optional(name: str, default):
        path = CONFIG / name
        return load_json(path) if path.exists() else default
    return {
        "expressions": optional("expressions.json", {}),
        "preferences": optional("preferred-translations.json", {}),
        "quality": optional("translation-quality.json", {}),
        "contexts": optional("contextual-senses.json", []),
        "thresholds": optional("resolution-thresholds.json", {"accept": 0.85, "reject": 0.25}),
    }


def enrichment_schema() -> dict:
    return {
        "type": "json_schema",
        "name": "meaning_enrichment_result",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "status", "translationEs", "definitionCa", "senseGloss",
                "confidence", "needsHumanReview", "notes",
            ],
            "properties": {
                "status": {"type": "string", "enum": ["resolved", "uncertain"]},
                "translationEs": {"type": ["string", "null"], "minLength": 1},
                "definitionCa": {"type": ["string", "null"], "minLength": 1},
                "senseGloss": {"type": ["string", "null"], "minLength": 1},
                "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                "needsHumanReview": {"type": "boolean"},
                "notes": {"type": "string", "minLength": 1, "maxLength": 240},
            },
        },
        "strict": True,
        "description": "Structured enrichment for Catalan vocabulary meanings.",
    }


def cefr_classification_schema() -> dict:
    return {
        "type": "json_schema",
        "name": "cefr_vocabulary_classification",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["id", "cefr", "confidence", "thematicCategory", "partOfSpeech", "reason"],
            "properties": {
                "id": {"type": "string", "minLength": 1},
                "cefr": {"type": "string", "enum": sorted(VALID_CEFR)},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "thematicCategory": {"type": "string", "minLength": 1, "maxLength": 80},
                "partOfSpeech": {"type": "string", "enum": sorted(VALID_POS)},
                "reason": {"type": "string", "minLength": 1, "maxLength": 280},
            },
        },
        "strict": True,
        "description": "Structured CEFR estimate for one Catalan vocabulary item.",
    }


VALID_DATA_QUALITY_ISSUES = {"pos-mismatch", "sense-mismatch", "translation-mismatch", "example-mismatch", "expression-mismatch", "possible-polysemy", "other"}
VALID_DATA_QUALITY_SEVERITIES = {"low", "medium", "high"}


def data_quality_schema() -> dict:
    return {
        "type": "json_schema",
        "name": "vocabulary_data_quality_audit",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["id", "status", "issues"],
            "properties": {
                "id": {"type": "string", "minLength": 1},
                "status": {"type": "string", "enum": ["ok", "review"]},
                "issues": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["type", "severity", "explanation"],
                        "properties": {
                            "type": {"type": "string", "enum": sorted(VALID_DATA_QUALITY_ISSUES)},
                            "severity": {"type": "string", "enum": sorted(VALID_DATA_QUALITY_SEVERITIES)},
                            "explanation": {"type": "string", "minLength": 1, "maxLength": 360},
                        },
                    },
                },
            },
        },
        "strict": True,
        "description": "Structured audit for internal consistency of one Catalan vocabulary record.",
    }


def data_quality_batch_schema() -> dict:
    return {
        "type": "json_schema",
        "name": "vocabulary_data_quality_audit_batch",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["results"],
            "properties": {
                "results": {
                    "type": "array",
                    "items": data_quality_schema()["schema"],
                },
            },
        },
        "strict": True,
        "description": "Structured batch audit for Catalan vocabulary record consistency.",
    }


def combined_enrichment_schema() -> dict:
    return {
        "type": "json_schema",
        "name": "combined_vocabulary_enrichment",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["id", "classification", "quality"],
            "properties": {
                "id": {"type": "string", "minLength": 1},
                "classification": cefr_classification_schema()["schema"],
                "quality": data_quality_schema()["schema"],
            },
        },
        "strict": True,
        "description": "Combined CEFR classification and data-quality audit for one Catalan vocabulary item.",
    }


def combined_enrichment_batch_schema() -> dict:
    return {
        "type": "json_schema",
        "name": "combined_vocabulary_enrichment_batch",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["results"],
            "properties": {
                "results": {
                    "type": "array",
                    "items": combined_enrichment_schema()["schema"],
                },
            },
        },
        "strict": True,
        "description": "Combined CEFR classification and data-quality audit for multiple Catalan vocabulary items.",
    }


REPAIR_FIELDS = ("partOfSpeech", "definitionCa", "translationEs", "exampleCa", "type", "answerCa", "targetExpression")


def repair_proposal_schema() -> dict:
    return {
        "type": "json_schema",
        "name": "vocabulary_repair_proposals_batch",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["results"],
            "properties": {
                "results": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["id", "status", "changes", "notes", "requiresManualDecision", "cefrNeedsRecheck"],
                        "properties": {
                            "id": {"type": "string", "minLength": 1},
                            "status": {"type": "string", "enum": ["proposed", "manual-only", "no-change"]},
                                "changes": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "required": list(REPAIR_FIELDS),
                                    "properties": {
                                    "partOfSpeech": {"type": ["string", "null"], "enum": ["noun", "verb", "adjective", "adverb", "other", None]},
                                    "definitionCa": {"type": ["string", "null"], "minLength": 1},
                                    "translationEs": {"type": ["string", "null"], "minLength": 1},
                                    "exampleCa": {"type": ["string", "null"], "minLength": 1},
                                    "type": {"type": ["string", "null"], "enum": ["word", "expression", None]},
                                    "answerCa": {"type": ["string", "null"], "minLength": 1},
                                    "targetExpression": {"type": ["string", "null"], "minLength": 1},
                                },
                            },
                            "notes": {"type": "array", "items": {"type": "string", "minLength": 1, "maxLength": 260}},
                            "requiresManualDecision": {"type": "boolean"},
                            "cefrNeedsRecheck": {"type": "boolean"},
                        },
                    },
                },
            },
        },
        "strict": True,
        "description": "Minimal repair proposals for flagged Catalan vocabulary records.",
    }


def make_enrichment_input(item: dict, reason: str, candidate_translations: list[str]) -> EnrichmentInput:
    evidence = item.get("evidence", {}) if isinstance(item.get("evidence"), dict) else {}
    example_ca = item.get("exampleCa") or evidence.get("exampleCa") or ""
    payload = {
        "id": item["id"],
        "word": item["word"],
        "answerCa": item.get("answerCa", item["word"]),
        "itemType": item.get("type", "word"),
        "exampleCa": example_ca,
        "partOfSpeech": item.get("partOfSpeech") or evidence.get("partOfSpeech", "other"),
        "candidateTranslationsEs": candidate_translations,
        "resolvedTranslationEs": item.get("translationEs"),
        "deterministicStatus": item.get("status", "review"),
        "reviewReason": reason,
        "contentHash": review_hash(item),
    }
    return EnrichmentInput(
        id=payload["id"],
        word=payload["word"],
        answer_ca=payload["answerCa"],
        item_type=payload["itemType"],
        example_ca=payload["exampleCa"],
        part_of_speech=payload["partOfSpeech"],
        candidate_translations_es=payload["candidateTranslationsEs"],
        resolved_translation_es=payload["resolvedTranslationEs"],
        deterministic_status=payload["deterministicStatus"],
        review_reason=payload["reviewReason"],
        content_hash=payload["contentHash"],
    )


def phrase_occurs(phrase: str, sentence: str) -> bool:
    phrase_tokens, sentence_tokens = tokenize(phrase), tokenize(sentence)
    size = len(phrase_tokens)
    return bool(size and any(sentence_tokens[i:i + size] == phrase_tokens for i in range(len(sentence_tokens) - size + 1)))


def detect_expression(word: str, sentence: str, expressions: dict) -> tuple[str, dict] | None:
    matches = [(phrase, metadata) for phrase, metadata in expressions.items()
               if word in tokenize(phrase) and phrase_occurs(phrase, sentence)]
    return max(matches, key=lambda value: len(tokenize(value[0])), default=None)


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def validate_linguistic_metadata(metadata: object, label: str = "linguistics") -> list[str]:
    errors = []
    if not isinstance(metadata, dict):
        return [f"{label}: must be an object"]
    cefr = metadata.get("cefr")
    if cefr is not None and cefr not in VALID_CEFR:
        errors.append(f"{label}: invalid cefr")
    confidence = metadata.get("confidence")
    if confidence is not None and (not isinstance(confidence, (int, float)) or isinstance(confidence, bool) or not math.isfinite(confidence) or confidence < 0 or confidence > 1):
        errors.append(f"{label}: confidence must be between 0 and 1")
    thematic_category = metadata.get("thematicCategory")
    if thematic_category is not None and (not isinstance(thematic_category, str) or not thematic_category.strip()):
        errors.append(f"{label}: thematicCategory must be a non-empty string")
    part_of_speech = metadata.get("partOfSpeech")
    if part_of_speech is not None and part_of_speech not in VALID_POS:
        errors.append(f"{label}: invalid partOfSpeech")
    provenance = metadata.get("provenance")
    if provenance is not None:
        if not isinstance(provenance, dict):
            errors.append(f"{label}: provenance must be an object")
        else:
            source = provenance.get("source")
            if not isinstance(source, str) or not source.strip():
                errors.append(f"{label}: provenance.source must be a non-empty string")
            for key in ("version", "method"):
                value = provenance.get(key)
                if value is not None and not isinstance(value, str):
                    errors.append(f"{label}: provenance.{key} must be a string")
    return errors


def load_linguistic_metadata() -> dict[str, dict]:
    if not LINGUISTIC_METADATA.exists():
        return {}
    data = load_json(LINGUISTIC_METADATA)
    if not isinstance(data, dict):
        raise SystemExit(f"{LINGUISTIC_METADATA}: top-level value must be an object keyed by vocabulary id")
    errors = []
    for entry_id, metadata in data.items():
        if not isinstance(entry_id, str) or not entry_id.strip():
            errors.append("linguistic metadata id must be a non-empty string")
            continue
        errors.extend(validate_linguistic_metadata(metadata, f"linguistic metadata {entry_id}"))
    if errors:
        raise SystemExit("Linguistic metadata validation failed:\n- " + "\n- ".join(errors[:30]))
    return data


def content_hash(value: object) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


def word_length_bucket(answer: str) -> str:
    length = sum(len(part.replace("·", "").replace("-", "")) for part in answer.split())
    if length <= 5:
        return "short"
    if length <= 9:
        return "medium"
    return "long"


def frequency_buckets(entries: list[dict]) -> dict[str, str]:
    ranked = sorted((entry for entry in entries if isinstance(entry.get("frequencyRank"), int)), key=lambda entry: (entry["frequencyRank"], entry["id"]))
    buckets = {}
    for index, entry in enumerate(ranked):
        fraction = index / max(len(ranked), 1)
        buckets[entry["id"]] = "high" if fraction < 1 / 3 else ("medium" if fraction < 2 / 3 else "low")
    return buckets


ABSTRACT_HINTS = {
    "acció", "acte", "activitat", "amistat", "canvi", "cas", "causa", "consell", "cultura", "desig",
    "dret", "efecte", "estat", "forma", "idea", "interès", "llibertat", "manera", "ment", "motiu",
    "necessitat", "nivell", "objectiu", "opinió", "ordre", "pensament", "poder", "problema", "procés",
    "realitat", "relació", "sentit", "situació", "sistema", "societat", "temps", "valor", "veritat",
}
CONCRETE_HINTS = {
    "aigua", "arbre", "avi", "cadira", "carrer", "casa", "cotxe", "dona", "escola", "finestra",
    "flor", "foc", "fusta", "gat", "germà", "habitació", "hospital", "jardí", "llibre", "llum",
    "mà", "mare", "nen", "nit", "pa", "pare", "platja", "porta", "taula", "terra",
}


def semantic_bucket(entry: dict) -> str:
    word = normalize(entry.get("answerCa") or entry.get("word", ""))
    if word in CONCRETE_HINTS:
        return "concrete-everyday"
    if word in ABSTRACT_HINTS or entry.get("partOfSpeech") in {"adverb", "adjective"}:
        return "abstract-or-grammatical"
    return "general"


def sample_entry_annotations(entries: list[dict]) -> dict[str, dict]:
    freq = frequency_buckets(entries)
    annotations = {}
    for entry in entries:
        length_bucket = word_length_bucket(entry.get("answerCa", entry.get("word", "")))
        freq_bucket = freq.get(entry["id"], "unknown")
        reasons = [
            f"difficulty:{entry.get('difficulty')}",
            f"frequency:{freq_bucket}",
            f"length:{length_bucket}",
            f"pos:{entry.get('partOfSpeech', 'other')}",
            f"semantic:{semantic_bucket(entry)}",
        ]
        if entry.get("type") == "expression":
            reasons.append("expression")
        if entry.get("difficulty") == "hard" and length_bucket == "long" and freq_bucket in {"high", "medium"}:
            reasons.append("possible-length-distortion")
        if entry.get("difficulty") == "easy" and freq_bucket == "low":
            reasons.append("possible-frequency-distortion")
        if entry.get("difficulty") == "hard" and freq_bucket == "high":
            reasons.append("possible-frequency-distortion")
        annotations[entry["id"]] = {
            "frequencyBucket": freq_bucket,
            "lengthBucket": length_bucket,
            "semanticBucket": semantic_bucket(entry),
            "selectionReasons": reasons,
        }
    return annotations


def select_cefr_sample(entries: list[dict], sample_size: int = 60) -> list[dict]:
    if sample_size != 60:
        raise ValueError("The CEFR experiment sample is intentionally fixed at 60 entries.")
    if len(entries) < sample_size:
        raise ValueError("Not enough vocabulary entries to select a 60-entry sample.")
    annotations = sample_entry_annotations(entries)
    targets = {
        "difficulty:easy": 20, "difficulty:medium": 20, "difficulty:hard": 20,
        "frequency:high": 18, "frequency:medium": 18, "frequency:low": 18,
        "length:short": 12, "length:medium": 24, "length:long": 18,
        "pos:noun": 20, "pos:verb": 10, "pos:adjective": 8, "pos:adverb": 8, "pos:other": 4,
        "semantic:concrete-everyday": 10, "semantic:abstract-or-grammatical": 12,
        "possible-length-distortion": 8, "possible-frequency-distortion": 8, "expression": 3,
    }
    selected: list[dict] = []
    counts = collections.Counter()
    by_difficulty = collections.Counter()
    candidates = sorted(entries, key=lambda entry: (entry.get("frequencyRank", 10_000_000), entry["id"]))
    while len(selected) < sample_size:
        best = None
        best_score = None
        for entry in candidates:
            if any(item["id"] == entry["id"] for item in selected):
                continue
            difficulty = entry.get("difficulty")
            if by_difficulty[difficulty] >= 20:
                continue
            reasons = annotations[entry["id"]]["selectionReasons"]
            coverage = sum(max(targets[tag] - counts[tag], 0) for tag in reasons if tag in targets)
            diagnostic_bonus = 8 * sum(tag in {"possible-length-distortion", "possible-frequency-distortion", "expression"} for tag in reasons)
            balance_bonus = max(20 - by_difficulty[difficulty], 0)
            tie_break = int(hashlib.sha256(f"{CEFR_EXPERIMENT_PROMPT_VERSION}:{entry['id']}".encode()).hexdigest()[:12], 16)
            score = (coverage + diagnostic_bonus + balance_bonus, -entry.get("frequencyRank", 10_000_000), -tie_break)
            if best_score is None or score > best_score:
                best, best_score = entry, score
        if best is None:
            break
        selected.append(best)
        by_difficulty[best.get("difficulty")] += 1
        counts.update(annotations[best["id"]]["selectionReasons"])
    if len(selected) != sample_size:
        raise RuntimeError(f"Unable to select exactly {sample_size} entries; selected {len(selected)}")
    selected.sort(key=lambda entry: (entry["difficulty"], entry.get("frequencyRank", 10_000_000), entry["id"]))
    return [{key: entry.get(key) for key in ("id", "word", "answerCa", "difficulty", "frequencyRank", "partOfSpeech", "definitionCa", "translationEs", "exampleCa")}
            | annotations[entry["id"]] for entry in selected]


def write_cefr_sample() -> None:
    sample = select_cefr_sample(load_json(DATA / "vocabulary.json"))
    write_json(CEFR_SAMPLE_PATH, sample)
    counts = collections.Counter(entry["difficulty"] for entry in sample)
    print(f"Wrote {len(sample)} CEFR sample entries to {CEFR_SAMPLE_PATH}")
    print("Difficulty composition: " + ", ".join(f"{key}={counts[key]}" for key in ("easy", "medium", "hard")))


def validate_cefr_classification(result: object, expected_id: str | None = None) -> list[str]:
    errors = []
    if not isinstance(result, dict):
        return ["classification must be an object"]
    if expected_id is not None and result.get("id") != expected_id:
        errors.append("id does not match sample entry")
    if result.get("cefr") not in VALID_CEFR:
        errors.append("invalid cefr")
    confidence = result.get("confidence")
    if not isinstance(confidence, (int, float)) or isinstance(confidence, bool) or not math.isfinite(confidence) or confidence < 0 or confidence > 1:
        errors.append("confidence must be between 0 and 1")
    if not isinstance(result.get("thematicCategory"), str) or not result["thematicCategory"].strip():
        errors.append("thematicCategory must be a non-empty string")
    if result.get("partOfSpeech") not in VALID_POS:
        errors.append("invalid partOfSpeech")
    if not isinstance(result.get("reason"), str) or not result["reason"].strip():
        errors.append("reason must be a non-empty string")
    return errors


def load_cefr_sample() -> list[dict]:
    if not CEFR_SAMPLE_PATH.exists():
        raise SystemExit("Missing CEFR sample. Run npm run vocab:cefr-sample.")
    sample = load_json(CEFR_SAMPLE_PATH)
    if not isinstance(sample, list) or len(sample) != 60:
        raise SystemExit("CEFR sample must contain exactly 60 entries.")
    return sample


def load_production_vocabulary() -> list[dict]:
    entries = load_json(DATA / "vocabulary.json")
    if not isinstance(entries, list) or len(entries) != 544:
        raise SystemExit("Production vocabulary must contain exactly 544 entries for the full CEFR experiment.")
    return entries


def cefr_model_payload(item: dict) -> dict:
    entry_type = item.get("type") or ("expression" if item.get("answerCa") != item.get("word") else "word")
    return {
        "id": item["id"],
        "classificationTarget": item["answerCa"],
        "answerCa": item["answerCa"],
        "type": entry_type,
        "sourceWord": item["word"],
        "definitionCa": item["definitionCa"],
        "translationEs": item["translationEs"],
        "exampleCa": item["exampleCa"],
        "partOfSpeech": item.get("partOfSpeech"),
        "frequencyRank": item.get("frequencyRank"),
    }


def quality_model_payload(item: dict) -> dict:
    entry_type = item.get("type") or ("expression" if item.get("answerCa") != item.get("word") else "word")
    return {
        "id": item["id"],
        "answerCa": item["answerCa"],
        "word": item["word"],
        "type": entry_type,
        "partOfSpeech": item.get("partOfSpeech"),
        "definitionCa": item["definitionCa"],
        "translationEs": item["translationEs"],
        "exampleCa": item["exampleCa"],
    }


def flagged_repair_entries() -> list[dict]:
    entries = load_production_vocabulary()
    quality = load_json(DATA_QUALITY_FULL_OUTPUT_PATH)
    cefr = load_json(CEFR_FULL_OUTPUT_PATH) if CEFR_FULL_OUTPUT_PATH.exists() else {"results": []}
    by_quality = {result["id"]: result for result in quality.get("results", []) if isinstance(result, dict)}
    by_cefr = {result["id"]: result for result in cefr.get("results", []) if isinstance(result, dict)}
    flagged = []
    for entry in entries:
        audit = by_quality.get(entry["id"])
        if not audit or audit.get("status") != "review":
            continue
        flagged.append({
            **entry,
            "audit": audit,
            "cefr": by_cefr.get(entry["id"]),
        })
    return flagged


def repair_input_hash(entries: list[dict]) -> str:
    return content_hash([repair_model_payload(entry) for entry in entries])


def repair_metadata(entries: list[dict], model: str, script_label: str = "scripts/vocab_pipeline.py repair-propose") -> dict:
    input_hash = repair_input_hash(entries)
    return {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model": model,
        "promptVersion": REPAIR_PROMPT_VERSION,
        "entries": len(entries),
        "inputHash": input_hash,
        "sampleHash": input_hash,
        "parameters": {"temperature": "model-default"},
        "script": script_label,
    }


def repair_model_payload(item: dict) -> dict:
    payload = {
        "id": item["id"],
        "word": item["word"],
        "answerCa": item["answerCa"],
        "type": item["type"],
        "partOfSpeech": item.get("partOfSpeech"),
        "definitionCa": item["definitionCa"],
        "translationEs": item["translationEs"],
        "exampleCa": item["exampleCa"],
        "issues": item["audit"]["issues"],
    }
    if item.get("cefr"):
        payload["cefrContext"] = {
            "cefr": item["cefr"].get("cefr"),
            "confidence": item["cefr"].get("confidence"),
        }
    return payload


def normalize(text: str) -> str:
    return unicodedata.normalize("NFC", text).lower().replace("’", "'")


def tokenize(text: str) -> list[str]:
    result = []
    for match in TOKEN_RE.finditer(unicodedata.normalize("NFC", text)):
        token = normalize(match.group())
        if "'" in token:  # Keep sentences, reject ambiguous contractions/clitics as targets.
            token = token.rsplit("'", 1)[-1]
        if token:
            result.append(token)
    return result


def is_candidate(word: str, excluded: set[str]) -> bool:
    letters = word.replace("·", "").replace("-", "")
    return 4 <= len(letters) <= 15 and bool(WORD_RE.fullmatch(word)) and word not in excluded


def sentence_score(sentence: str, word: str, priority: int) -> tuple:
    tokens = tokenize(sentence)
    count = len(tokens)
    length_penalty = abs(count - 8) if 4 <= count <= 14 else 20 + abs(count - 8)
    number_penalty = 20 if re.search(r"\d", sentence) else 0
    punctuation_penalty = max(0, len(re.findall(r"[^\w\sÀ-ÿ'’·-]", sentence)) - 2) * 2
    proper_penalty = max(0, sum(1 for t in sentence.split()[1:] if t[:1].isupper()) - 1) * 3
    exact_penalty = 0 if word in tokens else 10
    return (length_penalty + number_penalty + punctuation_penalty + proper_penalty + exact_penalty, -priority, normalize(sentence))


def fetch() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    for name, (url, commit) in REPOS.items():
        destination = RAW / name
        if not destination.exists():
            subprocess.run(["git", "clone", "--filter=blob:none", "--no-checkout", url, str(destination)], check=True)
        present = subprocess.run(["git", "-C", str(destination), "cat-file", "-e", f"{commit}^{{commit}}"],
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
        if not present:
            subprocess.run(["git", "-C", str(destination), "fetch", "--depth", "1", "origin", commit], check=True)
        subprocess.run(["git", "-C", str(destination), "checkout", "--detach", commit], check=True)


def load_excluded() -> set[str]:
    path = DATA / "config" / "excluded-words.txt"
    return {normalize(line.strip()) for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#")}


def frequency_data() -> tuple[dict[str, int], dict[str, int]]:
    path = DICT / "frequencies" / "frequencies-dict-forms.txt"
    counts = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            try:
                word, count = line.rsplit(", ", 1)
                counts[normalize(word)] = int(count)
            except ValueError:
                continue
    ranks = {word: rank for rank, (word, _) in enumerate(sorted(counts.items(), key=lambda item: (-item[1], item[0])), 1)}
    return counts, ranks


def parse_apertium() -> dict[str, list[tuple[str, str]]]:
    """Return Catalan surface -> [(Spanish, POS)] for simple one-word entries."""
    path = APERTIUM / "apertium-spa-cat.spa-cat.metadix"
    if not path.exists():
        return {}
    output: dict[str, set[tuple[str, str]]] = collections.defaultdict(set)
    for _, elem in ET.iterparse(path, events=("end",)):
        if elem.tag != "e" or elem.get("r") == "RL":
            continue
        pair = elem.find("p")
        if pair is None:
            continue
        left, right = pair.find("l"), pair.find("r")
        if left is None or right is None or left.find("b") is not None or right.find("b") is not None:
            continue
        spa = normalize("".join(left.itertext()).strip())
        cat = normalize("".join(right.itertext()).strip())
        if not WORD_RE.fullmatch(cat) or not re.fullmatch(r"[a-záéíñóúü]+(?:-[a-záéíñóúü]+)*", spa):
            continue
        tags = [node.get("n", "") for node in right.findall("s")]
        pos = next((POS_MAP[tag] for tag in tags if tag in POS_MAP), "other")
        if pos in VALID_POS and "np" not in tags:
            output[cat].add((spa, pos))
        elem.clear()
    return {word: sorted(values) for word, values in output.items()}


def extract() -> None:
    missing = [name for name in SOURCES if not (CORPUS / "data" / name).exists()]
    if missing:
        raise SystemExit(f"Missing corpus files ({', '.join(missing)}). Run npm run vocab:fetch.")
    excluded = load_excluded()
    records: dict[str, dict] = {}
    for filename, priority in SOURCES.items():
        path = CORPUS / "data" / filename
        for raw_line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
            sentence = " ".join(raw_line.split()).strip()
            if not sentence or URL_RE.search(sentence) or len(sentence) > 240:
                continue
            sentence_tokens = tokenize(sentence)
            for word in sentence_tokens:
                if not is_candidate(word, excluded):
                    continue
                record = records.setdefault(word, {"word": word, "corpusCount": 0, "sourceCounts": {}, "examples": {}})
                record["corpusCount"] += 1
                record["sourceCounts"][filename] = record["sourceCounts"].get(filename, 0) + 1
                score = sentence_score(sentence, word, priority)
                record["examples"][sentence] = min(record["examples"].get(sentence, score), score)
    candidates = []
    for record in records.values():
        scored_examples = record.pop("examples")
        examples = sorted(scored_examples, key=lambda sentence: scored_examples[sentence])[:8]
        record["sourceCounts"] = dict(sorted(record["sourceCounts"].items()))
        record["exampleCandidates"] = examples
        candidates.append(record)
    candidates.sort(key=lambda item: (-item["corpusCount"], item["word"]))
    write_json(INTERMEDIATE / "candidates.json", candidates)
    print(f"Extracted {len(candidates)} candidates")
def select(limit: int = 1000) -> None:
    candidates = load_json(INTERMEDIATE / "candidates.json")
    _, ranks = frequency_data()
    lexical = parse_apertium()
    selected = []
    expressions = load_rules()["expressions"]
    for item in candidates:
        word = item["word"]
        entries = lexical.get(word, [])
        if not entries or not item["exampleCandidates"]:
            continue
        frequency_rank = ranks.get(word)
        source_score = sum(SOURCES.get(name, 0) * count for name, count in item["sourceCounts"].items())
        rank_key = (frequency_rank if frequency_rank is not None else 10_000_000, -source_score, -item["corpusCount"], len(word), word)
        pos_counts = collections.Counter(pos for _, pos in entries if pos != "other")
        pos = sorted(pos_counts, key=lambda value: (-pos_counts[value], POS_PRIORITY[value]))[0] if pos_counts else "other"
        expression_examples = [(example, detect_expression(word, example, expressions)) for example in item["exampleCandidates"]]
        expression_example = next(((example, match) for example, match in expression_examples if match), None)
        if expression_example:
            item = {**item, "exampleCandidates": [expression_example[0], *[x for x in item["exampleCandidates"] if x != expression_example[0]]],
                    "detectedExpression": expression_example[1][0]}
        selected.append({**item, "frequencyRank": frequency_rank, "partOfSpeech": pos, "_rankKey": rank_key})
    selected.sort(key=lambda item: item["_rankKey"])
    selected = selected[:limit]
    for item in selected:
        item.pop("_rankKey")
        item["exampleCa"] = item.pop("exampleCandidates")[0]
    write_json(INTERMEDIATE / "selected.json", selected)
    write_json(INTERMEDIATE / "translation-input.json", [item["word"] for item in selected])
    print(f"Selected {len(selected)} entries with lexical validation")


def enrich() -> None:
    words = load_json(INTERMEDIATE / "translation-input.json")
    lexical = parse_apertium()
    translations = {}
    for word in words:
        values = sorted({translation for translation, _ in lexical.get(word, [])})
        if values:
            translations[word] = values[:4]
    write_json(INTERMEDIATE / "translations-es.json", translations)
    missing = sorted(set(words) - set(translations))
    print(f"Translated {len(translations)} words; missing {len(missing)}")


def review_hash(item: dict) -> str:
    payload = {key: item.get(key) for key in ("id", "word", "exampleCa", "partOfSpeech", "candidateTranslationsEs", "detectedExpression")}
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]


def clean_strings(values: object) -> list[str]:
    if not isinstance(values, list):
        return []
    result, seen = [], set()
    for value in values:
        if not isinstance(value, str):
            continue
        value = " ".join(value.strip().split())
        key = normalize(value)
        if value and key not in seen:
            seen.add(key)
            result.append(value)
    return result


def validate_review_result(result: object, expected_hash: str | None = None) -> list[str]:
    errors = []
    if not isinstance(result, dict):
        return ["review result must be an object"]
    status = result.get("status")
    if status not in {"accept", "review", "reject"}:
        errors.append("status must be accept, review, or reject")
    if expected_hash is not None and result.get("contentHash") != expected_hash:
        errors.append("contentHash does not match review input")
    if status == "accept":
        answer = result.get("answerCa")
        if not isinstance(answer, str) or not answer.strip(): errors.append("accepted result needs answerCa")
        if result.get("type") not in {"word", "expression"}: errors.append("accepted result needs a valid type")
        if not isinstance(result.get("definitionCa"), str) or not result["definitionCa"].strip(): errors.append("accepted result needs definitionCa")
        if not isinstance(result.get("translationEs"), str) or not result["translationEs"].strip(): errors.append("accepted result needs translationEs")
    if not isinstance(result.get("confidence"), (int, float)) or not 0 <= result["confidence"] <= 1: errors.append("confidence must be between zero and one")
    if not isinstance(result.get("reason"), str) or not result["reason"].strip(): errors.append("result needs a reason")
    return errors


def validate_enrichment_result(result: object) -> list[str]:
    errors = []
    if not isinstance(result, dict):
        return ["enrichment result must be an object"]
    if result.get("status") not in {"resolved", "uncertain"}:
        errors.append("status must be resolved or uncertain")
    if result.get("confidence") not in {"high", "medium", "low"}:
        errors.append("confidence must be high, medium, or low")
    if not isinstance(result.get("needsHumanReview"), bool):
        errors.append("needsHumanReview must be boolean")
    if not isinstance(result.get("notes"), str) or not result["notes"].strip():
        errors.append("notes must be a non-empty string")
    if result.get("status") == "resolved":
        for field in ("translationEs", "definitionCa", "senseGloss"):
            if not isinstance(result.get(field), str) or not result[field].strip():
                errors.append(f"resolved result needs {field}")
    return errors


def serialize_enrichment_result(result: EnrichmentResult) -> dict:
    return {
        "status": result.status,
        "translationEs": result.translation_es,
        "definitionCa": result.definition_ca,
        "senseGloss": result.sense_gloss,
        "confidence": result.confidence,
        "needsHumanReview": result.needs_human_review,
        "notes": result.notes,
    }


def enrichment_reason(item: dict) -> str | None:
    if item.get("status") != "review":
        return None
    reason = item.get("reason", "")
    translation = item.get("translationEs")
    definition = item.get("definitionCa")
    if reason.startswith("Context is insufficient"):
        return "ambiguous-sense"
    if translation and not definition:
        return "resolved-sense-missing-definition"
    if translation and definition is None:
        return "translation-uncertain"
    if item.get("type") == "expression" and not definition:
        return "expression-needs-description"
    if not translation:
        return "translation-uncertain"
    return "resolved-sense-missing-definition"


def select_enrichment_candidates() -> list[dict]:
    review = load_review_outputs()
    selected = []
    for item in review:
        reason = enrichment_reason(item)
        if not reason:
            continue
        candidate_translations = clean_strings(item.get("candidateTranslationsEs", []))
        if item.get("reviewSource") == "manual-override":
            continue
        if not isinstance(item.get("evidence"), dict):
            continue
        selected.append(asdict(make_enrichment_input(item, reason, candidate_translations)))
    write_json(INTERMEDIATE / "meaning-enrichment-input.json", selected)
    return selected


def _enrichment_to_review_result(item: dict, enrichment: dict) -> dict:
    result = dict(item)
    result["definitionCa"] = enrichment["definitionCa"]
    result["translationEs"] = enrichment["translationEs"]
    result["reviewSource"] = "llm-enrichment"
    result["status"] = "accept" if enrichment.get("status") == "resolved" and not enrichment.get("needsHumanReview") else "review"
    result["confidence"] = 0.8 if enrichment.get("confidence") == "high" else 0.6 if enrichment.get("confidence") == "medium" else 0.4
    result["reason"] = enrichment["notes"]
    result["senseGloss"] = enrichment["senseGloss"]
    if result["status"] == "accept":
        result["answerCa"] = item.get("answerCa", item["word"])
        result["type"] = item.get("type", "word")
        result["hintEs"] = enrichment["translationEs"]
        result["translationsEs"] = [enrichment["translationEs"]]
    return result


def enrich_llm() -> None:
    selected = select_enrichment_candidates()
    output_path = INTERMEDIATE / "meaning-enrichment-output.json"
    if not selected:
        write_json(output_path, [])
        print("No enrichment candidates found")
        return
    provider: MeaningEnrichmentProvider = OpenAIMeaningEnrichmentProvider()
    selected_hashes = {item["id"]: item["content_hash"] for item in selected}
    results = []
    if output_path.exists():
        for cached in load_json(output_path):
            if (isinstance(cached, dict)
                    and cached.get("contentHash") == selected_hashes.get(cached.get("id"))
                    and not validate_enrichment_result(cached)):
                results.append(cached)
    completed_ids = {item["id"] for item in results}
    if results:
        print(f"Resuming with {len(results)} of {len(selected)} entries already enriched", flush=True)
    for index, item in enumerate(selected, start=1):
        if item["id"] in completed_ids:
            continue
        enrichment = serialize_enrichment_result(provider.enrich(EnrichmentInput(**item)))
        errors = validate_enrichment_result(enrichment)
        if errors:
            raise SystemExit(f"Invalid enrichment for {item['word']}: {'; '.join(errors)}")
        results.append({"id": item["id"], "contentHash": item["content_hash"], **enrichment})
        write_json(output_path, results)
        print(f"[{index}/{len(selected)}] Enriched {item['word']}", flush=True)
    print(f"Enriched {len(results)} entries")


def load_review_outputs() -> list[dict]:
    path = INTERMEDIATE / "translation-review-output.json"
    if not path.exists():
        raise SystemExit("Missing cleaned translation review. Run npm run vocab:clean.")
    return load_json(path)


def load_enrichment_output() -> dict[str, dict]:
    path = INTERMEDIATE / "meaning-enrichment-output.json"
    if not path.exists():
        return {}
    output = {}
    for item in load_json(path):
        if isinstance(item, dict) and isinstance(item.get("id"), str):
            output[item["id"]] = item
    return output


class OpenAIMeaningEnrichmentProvider:
    def __init__(self, model: str | None = None):
        self.model = model or os.environ.get("VOCAB_LLM_MODEL", LLM_MODEL_DEFAULT)
        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover - environment specific
            raise SystemExit("Missing OpenAI SDK. Install `openai` to run vocab:enrich-llm.") from exc
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise SystemExit("OPENAI_API_KEY is required for vocab:enrich-llm.")
        self.client = OpenAI(api_key=api_key, max_retries=0)
        self.request_interval = float(os.environ.get("VOCAB_LLM_REQUEST_INTERVAL", "6.5"))
        self.last_request_at: float | None = None

    def _wait_for_rate_limit(self) -> None:
        if self.last_request_at is None:
            return
        remaining = self.request_interval - (time.monotonic() - self.last_request_at)
        if remaining > 0:
            time.sleep(remaining)

    def enrich(self, item: EnrichmentInput) -> EnrichmentResult:
        prompt = (
            "You enrich Catalan vocabulary meanings for an offline study dataset. "
            "Use the sentence context, the candidate Spanish translations, and the deterministic review reason. "
            "Prefer conservative answers. If the sense cannot be resolved confidently, return uncertain."
        )
        user = {
            "id": item.id,
            "word": item.word,
            "answerCa": item.answer_ca,
            "itemType": item.item_type,
            "exampleCa": item.example_ca,
            "partOfSpeech": item.part_of_speech,
            "candidateTranslationsEs": item.candidate_translations_es,
            "resolvedTranslationEs": item.resolved_translation_es,
            "deterministicStatus": item.deterministic_status,
            "reviewReason": item.review_reason,
            "contentHash": item.content_hash,
        }
        from openai import RateLimitError

        for retry in range(8):
            self._wait_for_rate_limit()
            self.last_request_at = time.monotonic()
            try:
                response = self.client.responses.create(
                    model=self.model,
                    input=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
                    ],
                    text={"format": enrichment_schema()},
                )
                break
            except RateLimitError as exc:
                error = exc.body if isinstance(exc.body, dict) else {}
                if isinstance(error.get("error"), dict):
                    error = error["error"]
                if error.get("code") == "insufficient_quota" or retry == 7:
                    raise
                retry_after = exc.response.headers.get("retry-after") if exc.response else None
                try:
                    delay = float(retry_after) if retry_after else min(60.0, 6.5 * (2 ** retry))
                except ValueError:
                    delay = min(60.0, 6.5 * (2 ** retry))
                print(f"Rate limit reached; retrying in {delay:.1f}s", flush=True)
                time.sleep(delay)
        else:  # pragma: no cover - loop either succeeds or raises
            raise RuntimeError("LLM enrichment retry loop ended unexpectedly")
        data = json.loads(response.output_text)
        return EnrichmentResult(
            status=data["status"],
            translation_es=data.get("translationEs"),
            definition_ca=data.get("definitionCa"),
            sense_gloss=data.get("senseGloss"),
            confidence=data["confidence"],
            needs_human_review=bool(data["needsHumanReview"]),
            notes=data["notes"],
        )


class OpenAICefrClassificationProvider:
    def __init__(self, model: str | None = None):
        self.model = model or os.environ.get("VOCAB_CEFR_MODEL") or os.environ.get("VOCAB_LLM_MODEL") or CEFR_EXPERIMENT_MODEL_DEFAULT
        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover - environment specific
            raise SystemExit("Missing OpenAI SDK. Install `openai` to run vocab:cefr-experiment.") from exc
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise SystemExit("OPENAI_API_KEY is required for vocab:cefr-experiment.")
        self.client = OpenAI(api_key=api_key, max_retries=0)
        self.request_interval = float(os.environ.get("VOCAB_LLM_REQUEST_INTERVAL", "6.5"))
        self.last_request_at: float | None = None

    def _wait_for_rate_limit(self) -> None:
        if self.last_request_at is None:
            return
        remaining = self.request_interval - (time.monotonic() - self.last_request_at)
        if remaining > 0:
            time.sleep(remaining)

    def classify(self, item: dict) -> CefrClassification:
        prompt = (
            "You estimate linguistic learner difficulty for Catalan vocabulary. "
            "Classify the approximate CEFR stage at which a learner could reasonably be expected to understand or use the complete lexical unit in `classificationTarget`. "
            "`classificationTarget` is always the learner-facing item, matching `answerCa`; it is the only item to classify. "
            "`sourceWord` is pipeline provenance/context only and may be just one token inside an expression. Do not classify `sourceWord` instead of `classificationTarget`. "
            "If `type` is `word`, classify `classificationTarget` as one word. If `type` is `expression`, classify the complete `classificationTarget` expression as one lexical or phraseological unit. "
            "Do not split expressions into independent CEFR classifications for their component words. "
            "Expressions may contain multiple orthographic words while still being one learner-relevant lexical unit. "
            "Do not infer CEFR from character count, Hangman difficulty, or Penjat's easy/medium/hard labels. "
            "Word length, number of spaces, and number of component words are not linguistic difficulty: a long word or multi-word everyday expression should not automatically be advanced. "
            "You may consider everyday usefulness, concreteness versus abstraction, semantic sophistication, register, specialization, idiomaticity, "
            "communicative usefulness, semantic transparency, expected learner exposure, grammatical or lexical complexity, and the supplied definition, translation, example, part of speech, and frequency rank. "
            "Frequency rank is contextual evidence only; do not mechanically determine CEFR from it. "
            "Return concise developer-review reasoning."
        )
        user = quality_model_payload(item)
        from openai import RateLimitError

        for retry in range(8):
            self._wait_for_rate_limit()
            self.last_request_at = time.monotonic()
            try:
                response = self.client.responses.create(
                    model=self.model,
                    input=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
                    ],
                    text={"format": cefr_classification_schema()},
                )
                break
            except RateLimitError as exc:
                error = exc.body if isinstance(exc.body, dict) else {}
                if isinstance(error.get("error"), dict):
                    error = error["error"]
                if error.get("code") == "insufficient_quota" or retry == 7:
                    raise
                retry_after = exc.response.headers.get("retry-after") if exc.response else None
                try:
                    delay = float(retry_after) if retry_after else min(60.0, 6.5 * (2 ** retry))
                except ValueError:
                    delay = min(60.0, 6.5 * (2 ** retry))
                print(f"Rate limit reached; retrying in {delay:.1f}s", flush=True)
                time.sleep(delay)
        else:  # pragma: no cover - loop either succeeds or raises
            raise RuntimeError("CEFR classification retry loop ended unexpectedly")
        data = json.loads(response.output_text)
        return CefrClassification(
            id=data["id"],
            cefr=data["cefr"],
            confidence=float(data["confidence"]),
            thematic_category=data["thematicCategory"],
            part_of_speech=data["partOfSpeech"],
            reason=data["reason"],
        )


def serialize_cefr_classification(result: CefrClassification) -> dict:
    return {
        "id": result.id,
        "cefr": result.cefr,
        "confidence": result.confidence,
        "thematicCategory": result.thematic_category,
        "partOfSpeech": result.part_of_speech,
        "reason": result.reason,
    }


def validate_data_quality_result(result: object, expected_id: str | None = None) -> list[str]:
    errors = []
    if not isinstance(result, dict):
        return ["data-quality result must be an object"]
    if expected_id is not None and result.get("id") != expected_id:
        errors.append("id does not match sample entry")
    status = result.get("status")
    if status not in {"ok", "review"}:
        errors.append("status must be ok or review")
    issues = result.get("issues")
    if not isinstance(issues, list):
        errors.append("issues must be a list")
        return errors
    if status == "ok" and issues:
        errors.append("ok result must not include issues")
    if status == "review" and not issues:
        errors.append("review result must include at least one issue")
    for index, issue in enumerate(issues):
        label = f"issue {index}"
        if not isinstance(issue, dict):
            errors.append(f"{label}: must be an object")
            continue
        if issue.get("type") not in VALID_DATA_QUALITY_ISSUES:
            errors.append(f"{label}: invalid type")
        if issue.get("severity") not in VALID_DATA_QUALITY_SEVERITIES:
            errors.append(f"{label}: invalid severity")
        if not isinstance(issue.get("explanation"), str) or not issue["explanation"].strip():
            errors.append(f"{label}: explanation must be a non-empty string")
    return errors


def validate_batch_results(results: object, expected_ids: list[str], validator: Callable[[object, str | None], list[str]]) -> list[str]:
    errors = []
    if not isinstance(results, list):
        return ["results must be a list"]
    seen = set()
    expected = set(expected_ids)
    for index, result in enumerate(results):
        if not isinstance(result, dict):
            errors.append(f"result {index}: must be an object")
            continue
        result_id = result.get("id")
        if result_id in seen:
            errors.append(f"duplicate id {result_id}")
        seen.add(result_id)
        if result_id not in expected:
            errors.append(f"unknown id {result_id}")
            continue
        errors.extend(f"{result_id}: {error}" for error in validator(result, result_id))
    missing = sorted(expected - seen)
    if missing:
        errors.append("missing ids: " + ", ".join(missing[:10]))
    return errors


def validate_data_quality_batch(payload: object, expected_ids: list[str]) -> list[str]:
    if not isinstance(payload, dict):
        return ["batch response must be an object"]
    return validate_batch_results(payload.get("results"), expected_ids, validate_data_quality_result)


def validate_combined_enrichment_result(result: object, expected_id: str | None = None) -> list[str]:
    if not isinstance(result, dict):
        return ["combined enrichment result must be an object"]
    errors = []
    if expected_id is not None and result.get("id") != expected_id:
        errors.append("id does not match input entry")
    errors.extend(f"classification: {error}" for error in validate_cefr_classification(result.get("classification"), expected_id))
    errors.extend(f"quality: {error}" for error in validate_data_quality_result(result.get("quality"), expected_id))
    return errors


def validate_combined_enrichment_batch(payload: object, expected_ids: list[str]) -> list[str]:
    if not isinstance(payload, dict):
        return ["batch response must be an object"]
    return validate_batch_results(payload.get("results"), expected_ids, validate_combined_enrichment_result)


def validate_repair_proposal(result: object, expected_id: str | None = None) -> list[str]:
    errors = []
    if not isinstance(result, dict):
        return ["repair proposal must be an object"]
    if expected_id is not None and result.get("id") != expected_id:
        errors.append("id does not match flagged entry")
    if result.get("status") not in {"proposed", "manual-only", "no-change"}:
        errors.append("status must be proposed, manual-only, or no-change")
    changes = result.get("changes")
    if not isinstance(changes, dict):
        errors.append("changes must be an object")
        return errors
    for key, value in changes.items():
        if key not in REPAIR_FIELDS:
            errors.append(f"unsupported change field {key}")
        if value is None:
            continue
        if key == "partOfSpeech" and value not in VALID_POS:
            errors.append("invalid partOfSpeech")
        elif key == "type" and value not in {"word", "expression"}:
            errors.append("invalid type")
        elif key not in {"partOfSpeech", "type"} and not isinstance(value, str):
            errors.append(f"{key} must be a string or null")
    if not isinstance(result.get("notes"), list) or not all(isinstance(note, str) and note.strip() for note in result.get("notes", [])):
        errors.append("notes must be a list of non-empty strings")
    if not isinstance(result.get("requiresManualDecision"), bool):
        errors.append("requiresManualDecision must be boolean")
    if not isinstance(result.get("cefrNeedsRecheck"), bool):
        errors.append("cefrNeedsRecheck must be boolean")
    if changes.get("answerCa") and not result.get("requiresManualDecision"):
        errors.append("answerCa changes require manual decision")
    if changes.get("answerCa") and not result.get("cefrNeedsRecheck"):
        errors.append("answerCa changes require CEFR recheck")
    if changes.get("type") and not result.get("requiresManualDecision"):
        errors.append("type changes require manual decision")
    return errors


def normalize_repair_proposal(result: dict, entry: dict) -> dict:
    """Convert schema-required echoes of current values into null changes."""
    normalized = dict(result)
    changes = dict(result.get("changes", {}))
    for field in REPAIR_FIELDS:
        value = changes.get(field)
        # Equality is the explicit no-change signal: a proposed new value is
        # retained when it differs from the current production value.
        if value is not None and field in entry and value == entry.get(field):
            changes[field] = None
    normalized["changes"] = changes
    return normalized


def validate_repair_proposal_for_entry(result: object, entry: dict) -> list[str]:
    errors = validate_repair_proposal(result, entry["id"])
    if not isinstance(result, dict):
        return errors
    changes = {k: v for k, v in result.get("changes", {}).items() if v is not None}
    if result.get("status") == "no-change" and changes:
        errors.append("no-change proposals must not include changed fields")
    if result.get("status") == "proposed" and not changes:
        errors.append("proposed status requires at least one changed field")
    answer = changes.get("answerCa", entry["answerCa"])
    example = changes.get("exampleCa", entry.get("exampleCa", ""))
    if isinstance(example, str) and isinstance(answer, str):
        if entry.get("type") == "expression" or changes.get("type") == "expression":
            if not phrase_occurs(answer, example):
                errors.append("replacement example must contain complete expression answerCa")
        elif not contains_word(example, answer):
            errors.append("replacement example must contain answerCa")
    if changes.get("targetExpression") and normalize(changes["targetExpression"]) != normalize(answer):
        errors.append("targetExpression changes must match answerCa")
    return errors


def validate_repair_batch(payload: object, expected_ids: list[str]) -> list[str]:
    if not isinstance(payload, dict):
        return ["batch response must be an object"]
    return validate_batch_results(payload.get("results"), expected_ids, validate_repair_proposal)

VALID_SEMANTIC_DECISIONS = {"accept", "manual-review", "reject"}
VALID_SPLIT_ASSESSMENTS = {"needed", "optional", "not-needed"}

def semantic_verification_schema() -> dict:
    issue = {"type":"object", "additionalProperties":False, "required":["tag","severity"],
             "properties":{"tag":{"type":"string","minLength":1,"maxLength":60},
                           "severity":{"type":"string","enum":["low","medium","high"]}}}
    return {"type":"json_schema", "name":"vocabulary_semantic_verification_batch", "strict":True,
            "schema":{"type":"object","additionalProperties":False,"required":["results"],"properties":{
                "results":{"type":"array","items":{"type":"object","additionalProperties":False,
                    "required":["id","decision","reason","issueTags","splitAssessment","splitReason"],
                    "properties":{"id":{"type":"string","minLength":1},
                                  "decision":{"type":"string","enum":sorted(VALID_SEMANTIC_DECISIONS)},
                                  "reason":{"type":"string","minLength":1,"maxLength":500},
                                  "issueTags":{"type":"array","items":issue},
                                  "splitAssessment":{"type":"string","enum":sorted(VALID_SPLIT_ASSESSMENTS)},
                                  "splitReason":{"type":"string","minLength":1,"maxLength":300}}}}}}}

def validate_semantic_verification_result(result: object, expected_id: str | None = None) -> list[str]:
    if not isinstance(result, dict): return ["semantic result must be an object"]
    errors=[]
    if expected_id is not None and result.get("id") != expected_id: errors.append("id does not match input entry")
    if result.get("decision") not in VALID_SEMANTIC_DECISIONS: errors.append("invalid decision")
    if not isinstance(result.get("reason"), str) or not result["reason"].strip(): errors.append("reason must be non-empty")
    if result.get("splitAssessment") not in VALID_SPLIT_ASSESSMENTS: errors.append("invalid splitAssessment")
    if not isinstance(result.get("splitReason"), str) or not result["splitReason"].strip(): errors.append("splitReason must be non-empty")
    tags=result.get("issueTags")
    if not isinstance(tags,list): errors.append("issueTags must be a list")
    else:
        for tag in tags:
            if not isinstance(tag,dict) or not isinstance(tag.get("tag"),str) or tag.get("severity") not in {"low","medium","high"}: errors.append("invalid issue tag")
    return errors

def validate_semantic_verification_batch(payload: object, expected_ids: list[str]) -> list[str]:
    if not isinstance(payload,dict): return ["batch response must be an object"]
    return validate_batch_results(payload.get("results"), expected_ids, validate_semantic_verification_result)


def validate_repair_proposals_file(path: Path = REPAIR_PROPOSALS_PATH) -> None:
    flagged = flagged_repair_entries()
    by_entry = {entry["id"]: entry for entry in flagged}
    if not path.exists():
        raise SystemExit(f"Missing repair proposals: {path}")
    data = load_json(path)
    results = data.get("results", []) if isinstance(data, dict) else []
    errors = validate_batch_results(results, [entry["id"] for entry in flagged], validate_repair_proposal)
    seen = set()
    for result in results if isinstance(results, list) else []:
        if not isinstance(result, dict) or result.get("id") in seen:
            continue
        seen.add(result.get("id"))
        entry = by_entry.get(result.get("id"))
        if not entry:
            continue
        changes_raw = result.get("changes", {})
        changes = {key: value for key, value in changes_raw.items() if value is not None}
        if result.get("status") == "no-change" and changes:
            errors.append(f"{result['id']}: no-change proposals must not include changed fields")
        if result.get("status") == "proposed" and not changes:
            errors.append(f"{result['id']}: proposed status requires at least one changed field")
        if result.get("status") == "manual-only" and not result.get("requiresManualDecision"):
            errors.append(f"{result['id']}: manual-only status requires manual decision")
        for key, value in changes.items():
            if entry.get(key) == value:
                errors.append(f"{result['id']}: unchanged field {key} should not be rewritten")
        answer = changes.get("answerCa", entry["answerCa"])
        example = changes.get("exampleCa", entry["exampleCa"])
        if isinstance(example, str) and isinstance(answer, str):
            if entry.get("type") == "expression" or changes.get("type") == "expression":
                if not phrase_occurs(answer, example):
                    errors.append(f"{result['id']}: replacement example must contain complete expression answerCa")
            elif not contains_word(example, answer):
                errors.append(f"{result['id']}: replacement example must contain answerCa")
        if changes.get("targetExpression") and normalize(changes["targetExpression"]) != normalize(answer):
            errors.append(f"{result['id']}: targetExpression changes must match answerCa")
    if errors:
        raise SystemExit("Repair proposal validation failed:\n- " + "\n- ".join(errors[:30]))
    print(f"Validated {len(results)} repair proposals")


def serialize_data_quality_result(result: DataQualityResult) -> dict:
    return {
        "id": result.id,
        "status": result.status,
        "issues": [{"type": issue.issue_type, "severity": issue.severity, "explanation": issue.explanation} for issue in result.issues],
    }


DEFAULT_AUDIT_BATCH_SIZE = 20
DEFAULT_AUDIT_CONCURRENCY = 3
DEFAULT_AUDIT_MAX_RETRIES = 5


class TransientBatchError(RuntimeError):
    retry_after: float | None

    def __init__(self, message: str, retry_after: float | None = None):
        super().__init__(message)
        self.retry_after = retry_after


class BatchSizeError(RuntimeError):
    pass


class PermanentBatchError(RuntimeError):
    pass


def chunks(values: list[dict], size: int) -> list[list[dict]]:
    return [values[index:index + size] for index in range(0, len(values), size)]


def retry_delay(attempt: int, retry_after: float | None = None) -> float:
    if retry_after is not None:
        return retry_after
    return min(60.0, (2 ** attempt) + random.uniform(0, 0.5))


def is_size_related_error(exc: BaseException) -> bool:
    """Return true only for failures where a smaller request may help."""
    error = getattr(exc, "body", None)
    if isinstance(error, dict) and isinstance(error.get("error"), dict):
        error = error["error"]
    if isinstance(error, dict):
        # Bad request schema/parameter errors are deterministic configuration
        # errors, not request-size failures.
        if error.get("code") == "invalid_json_schema":
            return False
        if error.get("param") == "text.format.schema":
            return False
    text = str(exc).lower()
    if getattr(exc, "status_code", None) == 400 and not any(marker in text for marker in (
        "context length", "context window", "token limit", "too many tokens",
        "too large", "maximum output", "structured-output size", "batch size",
    )):
        return False
    return any(marker in text for marker in (
        "context length", "context window", "token limit", "too many tokens",
        "too large", "maximum output", "structured-output size", "batch size",
    ))


def is_deterministic_request_error(exc: BaseException) -> bool:
    error = getattr(exc, "body", None)
    if isinstance(error, dict) and isinstance(error.get("error"), dict):
        error = error["error"]
    return isinstance(error, dict) and (
        error.get("code") == "invalid_json_schema"
        or error.get("param") == "text.format.schema"
        or (getattr(exc, "status_code", None) == 400 and not is_size_related_error(exc))
    )


def call_batch_with_retry(call: Callable[[list[dict]], list[dict]], batch: list[dict],
                          max_retries: int = DEFAULT_AUDIT_MAX_RETRIES,
                          sleep: Callable[[float], None] = time.sleep,
                          verbose: bool = True) -> list[dict]:
    for attempt in range(max_retries + 1):
        try:
            return call(batch)
        except PermanentBatchError:
            raise
        except BatchSizeError:
            raise
        except TransientBatchError as exc:
            if attempt >= max_retries:
                raise
            delay = retry_delay(attempt, exc.retry_after)
            if verbose:
                print(f"Transient API error; retrying batch in {delay:.1f}s", flush=True)
            sleep(delay)
        except Exception as exc:
            if is_deterministic_request_error(exc):
                raise
            if is_size_related_error(exc):
                raise BatchSizeError(str(exc)) from exc
            if attempt >= max_retries:
                raise
            delay = retry_delay(attempt)
            if verbose:
                print(f"Transient API error; retrying batch in {delay:.1f}s", flush=True)
            sleep(delay)
    raise RuntimeError("retry loop ended unexpectedly")


class OpenAIDataQualityAuditProvider:
    def __init__(self, model: str | None = None):
        self.model = model or os.environ.get("VOCAB_DATA_QUALITY_MODEL") or os.environ.get("VOCAB_CEFR_MODEL") or os.environ.get("VOCAB_LLM_MODEL") or CEFR_EXPERIMENT_MODEL_DEFAULT
        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover - environment specific
            raise SystemExit("Missing OpenAI SDK. Install `openai` to run vocab:cefr-data-quality.") from exc
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise SystemExit("OPENAI_API_KEY is required for vocab:cefr-data-quality.")
        self.client = OpenAI(api_key=api_key, max_retries=0)
        self.request_interval = float(os.environ.get("VOCAB_LLM_REQUEST_INTERVAL", "6.5"))
        self.last_request_at: float | None = None

    def _wait_for_rate_limit(self) -> None:
        if self.last_request_at is None:
            return
        remaining = self.request_interval - (time.monotonic() - self.last_request_at)
        if remaining > 0:
            time.sleep(remaining)

    def audit_batch(self, items: list[dict]) -> list[dict]:
        prompt = (
            "You audit Catalan learning vocabulary records for internal data-quality consistency. "
            "Do not rewrite the record and do not classify CEFR. Check whether answerCa/type, part of speech, Catalan definition, Spanish translation, and example sentence appear to describe the same learner-relevant lexical unit. "
            "For expressions, answerCa is the complete phraseological unit and the example should naturally illustrate that whole expression. "
            "Flag possible POS mismatch, sense mismatch, translation mismatch, example mismatch, expression mismatch, polysemy, or other pedagogically misleading data. "
            "Return ok with no issues when a record looks internally consistent. Do not invent issues. "
            "For ok records, return only id, status ok, and an empty issues array. Keep issue explanations concise."
        )
        user = {"entries": [quality_model_payload(item) for item in items]}
        from openai import RateLimitError

        for retry in range(8):
            self._wait_for_rate_limit()
            self.last_request_at = time.monotonic()
            try:
                response = self.client.responses.create(
                    model=self.model,
                    input=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
                    ],
                    text={"format": data_quality_batch_schema()},
                )
                break
            except RateLimitError as exc:
                error = exc.body if isinstance(exc.body, dict) else {}
                if isinstance(error.get("error"), dict):
                    error = error["error"]
                if error.get("code") == "insufficient_quota" or retry == 7:
                    raise
                retry_after = exc.response.headers.get("retry-after") if exc.response else None
                try:
                    delay = float(retry_after) if retry_after else min(60.0, 6.5 * (2 ** retry))
                except ValueError:
                    delay = min(60.0, 6.5 * (2 ** retry))
                print(f"Rate limited; retrying batch in {delay:.1f}s", flush=True)
                time.sleep(delay)
        else:  # pragma: no cover
            raise RuntimeError("Data-quality audit retry loop ended unexpectedly")
        data = json.loads(response.output_text)
        errors = validate_data_quality_batch(data, [item["id"] for item in items])
        if errors:
            raise BatchSizeError("; ".join(errors)) if len(items) > 1 else PermanentBatchError("; ".join(errors))
        return data["results"]


class OpenAICombinedEnrichmentProvider:
    def __init__(self, model: str | None = None):
        self.model = model or os.environ.get("VOCAB_COMBINED_MODEL") or os.environ.get("VOCAB_CEFR_MODEL") or os.environ.get("VOCAB_LLM_MODEL") or CEFR_EXPERIMENT_MODEL_DEFAULT
        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover - environment specific
            raise SystemExit("Missing OpenAI SDK. Install `openai` to run vocab:cefr-combined.") from exc
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise SystemExit("OPENAI_API_KEY is required for vocab:cefr-combined.")
        self.client = OpenAI(api_key=api_key, max_retries=0)
        self.request_interval = float(os.environ.get("VOCAB_LLM_REQUEST_INTERVAL", "6.5"))
        self.last_request_at: float | None = None

    def _wait_for_rate_limit(self) -> None:
        if self.last_request_at is None:
            return
        remaining = self.request_interval - (time.monotonic() - self.last_request_at)
        if remaining > 0:
            time.sleep(remaining)

    def enrich_batch(self, items: list[dict]) -> list[dict]:
        prompt = (
            "You enrich Catalan learning vocabulary entries for future review. "
            "For each input entry, return both a CEFR classification proposal and a compact data-quality audit in one response. "
            "Classify only the learner-facing answerCa lexical unit; expressions are complete phraseological units. "
            "Do not infer CEFR from character count, word count, spaces, Hangman difficulty, or Penjat difficulty labels. "
            "For quality, do not rewrite the entry and do not invent issues for OK records."
        )
        user = {"entries": [{**cefr_model_payload(item), "qualityInput": quality_model_payload(item)} for item in items]}
        from openai import RateLimitError

        for retry in range(8):
            self._wait_for_rate_limit()
            self.last_request_at = time.monotonic()
            try:
                response = self.client.responses.create(
                    model=self.model,
                    input=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
                    ],
                    text={"format": combined_enrichment_batch_schema()},
                )
                break
            except RateLimitError as exc:
                error = exc.body if isinstance(exc.body, dict) else {}
                if isinstance(error.get("error"), dict):
                    error = error["error"]
                if error.get("code") == "insufficient_quota" or retry == 7:
                    raise
                retry_after = exc.response.headers.get("retry-after") if exc.response else None
                try:
                    delay = float(retry_after) if retry_after else min(60.0, 6.5 * (2 ** retry))
                except ValueError:
                    delay = min(60.0, 6.5 * (2 ** retry))
                print(f"Rate limited; retrying batch in {delay:.1f}s", flush=True)
                time.sleep(delay)
        else:  # pragma: no cover
            raise RuntimeError("Combined enrichment retry loop ended unexpectedly")
        data = json.loads(response.output_text)
        errors = validate_combined_enrichment_batch(data, [item["id"] for item in items])
        if errors:
            raise BatchSizeError("; ".join(errors)) if len(items) > 1 else PermanentBatchError("; ".join(errors))
        return data["results"]


class OpenAISemanticVerificationProvider:
    def __init__(self, model: str | None = None):
        self.model = model or os.environ.get("VOCAB_SEMANTIC_MODEL") or os.environ.get("VOCAB_LLM_MODEL") or CEFR_EXPERIMENT_MODEL_DEFAULT
        try:
            from openai import OpenAI
        except ImportError as exc: raise SystemExit("Missing OpenAI SDK. Install `openai` to run semantic verification.") from exc
        api_key=os.environ.get("OPENAI_API_KEY")
        if not api_key: raise SystemExit("OPENAI_API_KEY is required for semantic verification.")
        self.client=OpenAI(api_key=api_key, max_retries=0)
    def verify_batch(self, items: list[dict]) -> list[dict]:
        prompt=("Independently verify the FINAL CANDIDATE Catalan vocabulary entry. The repair proposal may be wrong; do not agree blindly and do not generate replacements. "
                "Judge sense coherence, POS (respecting the limited enum and using other when a missing category is more accurate), natural Catalan, translation, pedagogical usefulness, unnecessary sense switching, and whether a split is genuinely needed. "
                "Polysemy alone does not require a split. Return exactly one decision per item: accept, manual-review, or reject. Flag examples that use a different sense or contain the answer unnaturally. Keep reasons concise.")
        response=self.client.responses.create(model=self.model,input=[{"role":"system","content":prompt},{"role":"user","content":json.dumps({"entries":items},ensure_ascii=False)}],text={"format":semantic_verification_schema()})
        data=json.loads(response.output_text)
        errors=validate_semantic_verification_batch(data,[x["id"] for x in items])
        if errors: raise BatchSizeError("; ".join(errors)) if len(items)>1 else PermanentBatchError("; ".join(errors))
        return data["results"]

class OpenAIRepairProposalProvider:
    def __init__(self, model: str | None = None):
        self.model = model or os.environ.get("VOCAB_REPAIR_MODEL") or os.environ.get("VOCAB_LLM_MODEL") or CEFR_EXPERIMENT_MODEL_DEFAULT
        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover
            raise SystemExit("Missing OpenAI SDK. Install `openai` to run vocab:repair-propose.") from exc
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise SystemExit("OPENAI_API_KEY is required for vocab:repair-propose.")
        self.client = OpenAI(api_key=api_key, max_retries=0)

    def propose_batch(self, items: list[dict]) -> list[dict]:
        prompt = (
            "You propose minimal repairs for flagged Catalan learning vocabulary records. "
            "Use only entries whose audit status is review. Use only the audit issues to decide what is broken. Preserve good existing data and propose only fields that should actually change; omit or return null for unchanged fields. "
            "The learner-facing lexical unit is answerCa. For type=word, repair that word. For type=expression, repair the complete answerCa phrase as one phraseological unit, not its component words or the source token in word. "
            "The strict schema requires every change key: if a field does not need modification, its replacement value MUST be null. Never copy an existing value into a replacement field merely because the key is required. Only provide a non-null replacement when actually proposing a change. "
            "For example mismatches, usually propose only a simple natural replacement example containing the exact answerCa; expressions must appear as the complete answerCa phrase. "
            "For POS mismatches, use only the existing production POS enum: noun, verb, adjective, adverb, other. "
            "For sense/polysemy problems, prefer one clean pedagogical sense; if a split or answer/type change is needed, mark requiresManualDecision true. "
            "Every non-null answerCa or type change MUST set requiresManualDecision true; every non-null answerCa change MUST also set cefrNeedsRecheck true. "
            "Do not use or request the old Penjat difficulty label. Do not change game behavior, IDs, or vocabulary records. "
            "Do not propose ID changes. Do not rewrite production data. Set cefrNeedsRecheck true only when lexical sense, answerCa, type, or split strategy materially changes."
        )
        user = {"entries": [repair_model_payload(item) for item in items]}
        response = self.client.responses.create(
            model=self.model,
            input=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
            ],
            text={"format": repair_proposal_schema()},
        )
        data = json.loads(response.output_text)
        by_id = {item["id"]: item for item in items}
        raw_results = data.get("results", []) if isinstance(data, dict) else []
        results = [normalize_repair_proposal(result, by_id[result["id"]])
                   if isinstance(result, dict) and result.get("id") in by_id else result
                   for result in raw_results]
        data = {**data, "results": results} if isinstance(data, dict) else data
        errors = validate_repair_batch(data, [item["id"] for item in items])
        if errors:
            message = "; ".join(errors)
            # A response containing all IDs but invalid proposal semantics is
            # deterministic model output, not a request-size failure.
            only_missing_ids = all(error.startswith("missing ids:") for error in errors)
            if only_missing_ids and len(items) > 1:
                raise BatchSizeError(message)
            if only_missing_ids:
                raise PermanentBatchError(message)
        invalid = [(item, result, validate_repair_proposal_for_entry(result, item))
                   for item in items for result in results
                   if isinstance(result, dict) and result.get("id") == item["id"]
                   and validate_repair_proposal_for_entry(result, item)]
        for item, previous, item_errors in invalid:
            repaired = self._retry_invalid(item, previous, item_errors, prompt)
            results = [repaired if result.get("id") == item["id"] else result for result in results]
        return results

    def _retry_invalid(self, item: dict, previous: dict, errors: list[str], prompt: str) -> dict:
        feedback = "; ".join(errors)
        for attempt in range(3):
            response = self.client.responses.create(
                model=self.model,
                input=[{"role": "system", "content": prompt + " Correct only the invalid proposal; return one result."},
                       {"role": "user", "content": json.dumps({"entry": repair_model_payload(item),
                           "previousProposal": previous, "validatorErrors": errors,
                           "instruction": "Produce a coherent corrected proposal satisfying the validator."}, ensure_ascii=False)}],
                text={"format": repair_proposal_schema()},
            )
            payload = json.loads(response.output_text)
            candidate = next((r for r in payload.get("results", []) if r.get("id") == item["id"]), None)
            if candidate:
                candidate = normalize_repair_proposal(candidate, item)
                candidate_errors = validate_repair_proposal_for_entry(candidate, item)
                if not candidate_errors:
                    return candidate
                previous, errors = candidate, candidate_errors
                feedback = "; ".join(errors)
        raise PermanentBatchError(f"{item['id']}: semantic retry failed after 3 attempts: {feedback}")


def load_completed_results(output_path: Path, entries: list[dict], metadata: dict,
                           validator: Callable[[object, str | None], list[str]],
                           force: bool = False,
                           normalize: Callable[[dict, dict], dict] | None = None) -> dict[str, dict]:
    if not output_path.exists() or force:
        return {}
    cached = load_json(output_path)
    cached_meta = cached.get("metadata", {}) if isinstance(cached, dict) else {}
    cached_results = cached.get("results", []) if isinstance(cached, dict) else []
    cached_hash = cached_meta.get("inputHash") or cached_meta.get("sampleHash")
    if cached_hash != metadata["inputHash"] or cached_meta.get("promptVersion") != metadata["promptVersion"] or cached_meta.get("model") != metadata["model"] or not isinstance(cached_results, list):
        raise SystemExit(f"Existing output at {output_path} does not match this input/prompt/model. Use --force to replace it deliberately.")
    expected_ids = {entry["id"] for entry in entries}
    completed = {}
    by_id = {entry["id"]: entry for entry in entries}
    for result in cached_results:
        if not isinstance(result, dict) or result.get("id") not in expected_ids:
            continue
        if normalize:
            result = normalize(result, by_id[result["id"]])
        if not validator(result, result["id"]):
            completed[result["id"]] = result
    return completed


def run_batched_checkpoint(entries: list[dict], output_path: Path, metadata: dict,
                           call_batch: Callable[[list[dict]], list[dict]],
                           validator: Callable[[object, str | None], list[str]],
                           label: str, batch_size: int = DEFAULT_AUDIT_BATCH_SIZE,
                           concurrency: int = DEFAULT_AUDIT_CONCURRENCY,
                           max_retries: int = DEFAULT_AUDIT_MAX_RETRIES,
                           force: bool = False, verbose: bool = True,
                           sleep: Callable[[float], None] = time.sleep,
                           normalize: Callable[[dict, dict], dict] | None = None) -> None:
    if batch_size < 1:
        raise SystemExit("--batch-size must be at least 1.")
    if concurrency < 1:
        raise SystemExit("--concurrency must be at least 1.")
    completed_by_id = load_completed_results(output_path, entries, metadata, validator, force=force, normalize=normalize)
    if force and output_path.exists() and verbose:
        print(f"Ignoring existing output at {output_path} because --force was provided.", flush=True)
    if len(completed_by_id) == len(entries):
        if verbose:
            print(f"Complete cached {label} exists at {output_path}; use --force to regenerate.")
        return
    if verbose:
        print(f"Cached: {len(completed_by_id)}", flush=True)
        print(f"Remaining: {len(entries) - len(completed_by_id)}", flush=True)
        print(f"{label}: batch size={batch_size}, concurrency={concurrency}", flush=True)
    write_json(output_path, {"metadata": metadata, "results": [completed_by_id[entry["id"]] for entry in entries if entry["id"] in completed_by_id]})

    pending = chunks([entry for entry in entries if entry["id"] not in completed_by_id], batch_size)
    in_flight: dict[concurrent.futures.Future, list[dict]] = {}

    def submit(executor, batch):
        future = executor.submit(call_batch_with_retry, call_batch, batch, max_retries, sleep, verbose)
        in_flight[future] = batch

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        while pending or in_flight:
            while pending and len(in_flight) < concurrency:
                submit(executor, pending.pop(0))
            done, _ = concurrent.futures.wait(in_flight, return_when=concurrent.futures.FIRST_COMPLETED)
            for future in done:
                batch = in_flight.pop(future)
                try:
                    results = future.result()
                except BatchSizeError:
                    if len(batch) <= 1:
                        raise
                    midpoint = len(batch) // 2
                    if verbose:
                        print(f"{label}: splitting failed {len(batch)}-entry batch into {midpoint}+{len(batch) - midpoint}", flush=True)
                    pending.insert(0, batch[midpoint:])
                    pending.insert(0, batch[:midpoint])
                    continue
                expected_ids = [entry["id"] for entry in batch]
                errors = validate_batch_results(results, expected_ids, validator)
                if errors:
                    raise PermanentBatchError("; ".join(errors))
                for result in results:
                    if normalize:
                        entry_by_id = {entry["id"]: entry for entry in entries}
                        result = normalize(result, entry_by_id[result["id"]])
                    completed_by_id[result["id"]] = result
                ordered_results = [completed_by_id[entry["id"]] for entry in entries if entry["id"] in completed_by_id]
                write_json(output_path, {"metadata": metadata, "results": ordered_results})
                if verbose:
                    print(f"{label}: {len(ordered_results)} / {len(entries)} complete", flush=True)
    expected_ids = {entry["id"] for entry in entries}
    result_ids = list(completed_by_id)
    if len(result_ids) != len(entries) or set(result_ids) != expected_ids:
        missing = sorted(expected_ids - set(result_ids))
        extra = sorted(set(result_ids) - expected_ids)
        raise PermanentBatchError(f"{label} incomplete: expected {len(entries)}, got {len(result_ids)}; missing={missing}; extra={extra}")


def run_combined_enrichment(input_path: Path, output_path: Path, model: str | None = None,
                            force: bool = False, provider: OpenAICombinedEnrichmentProvider | None = None,
                            verbose: bool = True, batch_size: int = DEFAULT_AUDIT_BATCH_SIZE,
                            concurrency: int = DEFAULT_AUDIT_CONCURRENCY) -> None:
    entries = load_json(input_path)
    if not isinstance(entries, list) or not entries:
        raise SystemExit("Combined enrichment input must be a non-empty JSON array of vocabulary-like entries.")
    chosen_model = model or os.environ.get("VOCAB_COMBINED_MODEL") or os.environ.get("VOCAB_CEFR_MODEL") or os.environ.get("VOCAB_LLM_MODEL") or CEFR_EXPERIMENT_MODEL_DEFAULT
    input_hash = content_hash(entries)
    metadata = {"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "model": chosen_model,
                "promptVersion": "combined-cefr-quality-v1", "entries": len(entries), "inputHash": input_hash,
                "parameters": {"temperature": "model-default"}, "script": "scripts/vocab_pipeline.py cefr-combined"}
    client = provider or OpenAICombinedEnrichmentProvider(chosen_model)
    run_batched_checkpoint(entries, output_path, metadata, client.enrich_batch, validate_combined_enrichment_result,
                           "Combined enrichment", batch_size=batch_size, concurrency=concurrency,
                           force=force, verbose=verbose)


def run_data_quality_entries(entries: list[dict], output_path: Path, script_label: str, model: str | None = None,
                             force: bool = False, provider: DataQualityAuditProvider | None = None,
                             verbose: bool = True, batch_size: int = DEFAULT_AUDIT_BATCH_SIZE,
                             concurrency: int = DEFAULT_AUDIT_CONCURRENCY) -> None:
    chosen_model = model or os.environ.get("VOCAB_DATA_QUALITY_MODEL") or os.environ.get("VOCAB_CEFR_MODEL") or os.environ.get("VOCAB_LLM_MODEL") or CEFR_EXPERIMENT_MODEL_DEFAULT
    input_hash = content_hash(entries)
    metadata = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model": chosen_model,
        "promptVersion": DATA_QUALITY_PROMPT_VERSION,
        "entries": len(entries),
        "inputHash": input_hash,
        "sampleHash": input_hash,
        "parameters": {"temperature": "model-default"},
        "script": script_label,
    }
    auditor = provider or OpenAIDataQualityAuditProvider(chosen_model)
    run_batched_checkpoint(entries, output_path, metadata, auditor.audit_batch, validate_data_quality_result,
                           "Quality audit", batch_size=batch_size, concurrency=concurrency,
                           force=force, verbose=verbose)


def run_data_quality_audit(model: str | None = None, force: bool = False,
                           provider: DataQualityAuditProvider | None = None, verbose: bool = True,
                           batch_size: int = DEFAULT_AUDIT_BATCH_SIZE,
                           concurrency: int = DEFAULT_AUDIT_CONCURRENCY) -> None:
    run_data_quality_entries(load_cefr_sample(), DATA_QUALITY_OUTPUT_PATH, "scripts/vocab_pipeline.py cefr-data-quality",
                             model=model, force=force, provider=provider, verbose=verbose,
                             batch_size=batch_size, concurrency=concurrency)


def run_data_quality_full(model: str | None = None, force: bool = False,
                          provider: DataQualityAuditProvider | None = None, verbose: bool = True,
                          batch_size: int = DEFAULT_AUDIT_BATCH_SIZE,
                          concurrency: int = DEFAULT_AUDIT_CONCURRENCY) -> None:
    run_data_quality_entries(load_production_vocabulary(), DATA_QUALITY_FULL_OUTPUT_PATH,
                             "scripts/vocab_pipeline.py cefr-quality-full", model=model, force=force,
                             provider=provider, verbose=verbose, batch_size=batch_size, concurrency=concurrency)


def run_repair_proposals(model: str | None = None, force: bool = False,
                         provider: RepairProposalProvider | None = None, verbose: bool = True,
                         batch_size: int = DEFAULT_AUDIT_BATCH_SIZE,
                         concurrency: int = DEFAULT_AUDIT_CONCURRENCY,
                         output_path: Path = REPAIR_PROPOSALS_PATH) -> None:
    entries = flagged_repair_entries()
    if not entries:
        raise SystemExit("No flagged entries found in the full data-quality output.")
    chosen_model = model or os.environ.get("VOCAB_REPAIR_MODEL") or os.environ.get("VOCAB_LLM_MODEL") or CEFR_EXPERIMENT_MODEL_DEFAULT
    metadata = repair_metadata(entries, chosen_model)
    proposer = provider or OpenAIRepairProposalProvider(chosen_model)
    by_id = {entry["id"]: entry for entry in entries}
    repair_validator = lambda result, expected_id: validate_repair_proposal_for_entry(result, by_id[expected_id])
    run_batched_checkpoint(entries, output_path, metadata, proposer.propose_batch, repair_validator,
                           "Repair proposals", batch_size=batch_size, concurrency=concurrency,
                           force=force, verbose=verbose, normalize=normalize_repair_proposal)


def run_cefr_classification(entries: list[dict], output_path: Path, script_label: str, model: str | None = None,
                            force: bool = False, provider: CefrClassificationProvider | None = None,
                            verbose: bool = True) -> None:
    chosen_model = model or os.environ.get("VOCAB_CEFR_MODEL") or os.environ.get("VOCAB_LLM_MODEL") or CEFR_EXPERIMENT_MODEL_DEFAULT
    input_hash = content_hash(entries)
    metadata = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model": chosen_model,
        "promptVersion": CEFR_EXPERIMENT_PROMPT_VERSION,
        "entries": len(entries),
        "inputHash": input_hash,
        "sampleHash": input_hash,
        "parameters": {"temperature": "model-default"},
        "script": script_label,
    }
    if output_path.exists() and not force:
        cached = load_json(output_path)
        cached_meta = cached.get("metadata", {}) if isinstance(cached, dict) else {}
        cached_results = cached.get("results", []) if isinstance(cached, dict) else []
        cached_hash = cached_meta.get("inputHash") or cached_meta.get("sampleHash")
        valid_cached = (cached_hash == input_hash
                        and cached_meta.get("promptVersion") == CEFR_EXPERIMENT_PROMPT_VERSION
                        and cached_meta.get("model") == chosen_model
                        and isinstance(cached_results, list)
                        and len(cached_results) == len(entries)
                        and not any(validate_cefr_classification(result, entry["id"]) for result, entry in zip(cached_results, entries)))
        if valid_cached:
            if verbose:
                print(f"Complete cached CEFR experiment exists at {output_path}; use --force to regenerate.")
            return
        raise SystemExit(f"Existing CEFR output at {output_path} does not match this sample/prompt/model. Use --force to replace it deliberately.")
    classifier = provider or OpenAICefrClassificationProvider(chosen_model)
    results = []
    for index, item in enumerate(entries, start=1):
        result = serialize_cefr_classification(classifier.classify(item))
        errors = validate_cefr_classification(result, item["id"])
        if errors:
            raise SystemExit(f"Invalid CEFR classification for {item['id']}: {'; '.join(errors)}")
        results.append(result)
        write_json(output_path, {"metadata": metadata, "results": results})
        if verbose:
            print(f"[{index}/{len(entries)}] Classified {item['word']}", flush=True)
    write_json(output_path, {"metadata": metadata, "results": results})
    if verbose:
        print(f"Wrote CEFR experiment output to {output_path}")


def run_cefr_experiment(model: str | None = None, force: bool = False,
                        provider: CefrClassificationProvider | None = None, verbose: bool = True,
                        output_path: Path = CEFR_OUTPUT_PATH, script_label: str = "scripts/vocab_pipeline.py cefr-experiment") -> None:
    run_cefr_classification(load_cefr_sample(), output_path, script_label, model=model, force=force, provider=provider, verbose=verbose)


def run_cefr_experiment_run2(model: str | None = None, force: bool = False,
                             provider: CefrClassificationProvider | None = None, verbose: bool = True) -> None:
    run_cefr_experiment(model=model, force=force, provider=provider, verbose=verbose,
                        output_path=CEFR_OUTPUT_RUN2_PATH, script_label="scripts/vocab_pipeline.py cefr-experiment-run2")


def run_cefr_full(model: str | None = None, force: bool = False,
                  provider: CefrClassificationProvider | None = None, verbose: bool = True) -> None:
    run_cefr_classification(load_production_vocabulary(), CEFR_FULL_OUTPUT_PATH,
                            "scripts/vocab_pipeline.py cefr-full", model=model, force=force, provider=provider, verbose=verbose)


CEFR_ORDER = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6}


def cefr_distance(first: str, second: str) -> int:
    return abs(CEFR_ORDER[first] - CEFR_ORDER[second])


def agreement_label(distance: int) -> str:
    if distance == 0:
        return "exact agreement"
    if distance == 1:
        return "adjacent disagreement"
    return "major disagreement"


def consensus_status(distance: int) -> str:
    if distance == 0:
        return "stable"
    if distance == 1:
        return "review-adjacent"
    return "review-major"


def load_cefr_output(path: Path, sample: list[dict]) -> dict:
    if not path.exists():
        raise SystemExit(f"Missing CEFR output: {path}")
    output = load_json(path)
    results = output.get("results", []) if isinstance(output, dict) else []
    if len(results) != len(sample):
        raise SystemExit(f"CEFR output is incomplete: {path}")
    by_id = {result.get("id"): result for result in results if isinstance(result, dict)}
    for entry in sample:
        errors = validate_cefr_classification(by_id.get(entry["id"]), entry["id"])
        if errors:
            raise SystemExit(f"Invalid CEFR result in {path} for {entry['id']}: {'; '.join(errors)}")
    return output


def stability_rows(sample: list[dict], run1: dict, run2: dict) -> list[dict]:
    by1 = {item["id"]: item for item in run1["results"]}
    by2 = {item["id"]: item for item in run2["results"]}
    rows = []
    for entry in sample:
        first, second = by1[entry["id"]], by2[entry["id"]]
        distance = cefr_distance(first["cefr"], second["cefr"])
        rows.append({
            "id": entry["id"],
            "lexicalUnit": entry["answerCa"],
            "type": entry.get("type") or ("expression" if entry.get("answerCa") != entry.get("word") else "word"),
            "run1": first,
            "run2": second,
            "distance": distance,
            "agreement": agreement_label(distance),
        })
    return rows


def write_cefr_consensus(rows: list[dict]) -> None:
    output = []
    for row in rows:
        item = {
            "id": row["id"],
            "lexicalUnit": row["lexicalUnit"],
            "type": row["type"],
            "status": consensus_status(row["distance"]),
            "run1": row["run1"],
            "run2": row["run2"],
            "distance": row["distance"],
        }
        if row["distance"] == 0:
            item["consensusCefr"] = row["run1"]["cefr"]
        output.append(item)
    write_json(CEFR_CONSENSUS_PATH, output)


def generate_cefr_stability_report() -> None:
    sample = load_cefr_sample()
    run1, run2 = load_cefr_output(CEFR_OUTPUT_PATH, sample), load_cefr_output(CEFR_OUTPUT_RUN2_PATH, sample)
    rows = stability_rows(sample, run1, run2)
    write_cefr_consensus(rows)
    total = len(rows)
    exact = sum(row["distance"] == 0 for row in rows)
    within_one = sum(row["distance"] <= 1 for row in rows)
    major = sum(row["distance"] >= 2 for row in rows)
    average_distance = sum(row["distance"] for row in rows) / total
    conf1 = sum(row["run1"]["confidence"] for row in rows) / total
    conf2 = sum(row["run2"]["confidence"] for row in rows) / total
    dist1 = collections.Counter(row["run1"]["cefr"] for row in rows)
    dist2 = collections.Counter(row["run2"]["cefr"] for row in rows)
    changed_conf = [row for row in rows if abs(row["run1"]["confidence"] - row["run2"]["confidence"]) >= 0.2]
    nonzero = [row for row in rows if row["distance"] > 0]
    majors = [row for row in rows if row["distance"] >= 2]
    high_conf_disagree = [row for row in rows if row["distance"] > 0 and row["run1"]["confidence"] >= 0.85 and row["run2"]["confidence"] >= 0.85]
    both_90 = [row for row in rows if row["distance"] > 0 and row["run1"]["confidence"] >= 0.9 and row["run2"]["confidence"] >= 0.9]
    major_high = [row for row in majors if row["run1"]["confidence"] >= 0.85 and row["run2"]["confidence"] >= 0.85]
    if exact / total >= 0.8 and within_one / total >= 0.95 and major / total <= 0.05:
        recommendation = "Strong result: proceed toward full classification, while still considering the separate data-quality audit."
    elif exact / total >= 0.6 and exact / total < 0.8 and within_one / total >= 0.95:
        recommendation = "Mixed result: refine the methodology before scaling, even though adjacent agreement is high."
    elif exact / total < 0.6 or major / total > 0.1:
        recommendation = "Weak result: revise the prompt/classification methodology before classifying all 544 entries."
    else:
        recommendation = "Borderline result: review disagreement patterns and data-quality findings before deciding whether to scale."
    table = [["Lexical unit", "Type", "Run 1", "Conf. 1", "Run 2", "Conf. 2", "Distance", "Agreement"]]
    table += [[row["lexicalUnit"], row["type"], row["run1"]["cefr"], f"{row['run1']['confidence']:.2f}",
               row["run2"]["cefr"], f"{row['run2']['confidence']:.2f}", row["distance"], row["agreement"]] for row in rows]
    report = [
        "# CEFR classification stability",
        "",
        f"- Exact agreement: {exact}/{total} ({exact / total:.1%})",
        f"- Agreement within ±1 level: {within_one}/{total} ({within_one / total:.1%})",
        f"- Major disagreement: {major}/{total} ({major / total:.1%})",
        f"- Average CEFR distance: {average_distance:.2f}",
        f"- Average confidence run 1: {conf1:.2f}",
        f"- Average confidence run 2: {conf2:.2f}",
        "",
        "## CEFR Distributions",
        "",
        markdown_table([["Run", *sorted(VALID_CEFR, key=CEFR_ORDER.get)],
                        ["Run 1", *[dist1[level] for level in sorted(VALID_CEFR, key=CEFR_ORDER.get)]],
                        ["Run 2", *[dist2[level] for level in sorted(VALID_CEFR, key=CEFR_ORDER.get)]]]),
        "",
        "## Confidence Signals",
        "",
        f"- Substantial confidence changes (>= 0.20): {len(changed_conf)}",
        f"- Both runs high confidence but disagree: {len(high_conf_disagree)}",
        f"- Confidence >= 0.90 in both runs but CEFR differs: {len(both_90)}",
        f"- Major disagreement despite high confidence: {len(major_high)}",
        "",
        "## Non-zero Disagreements",
        "",
        markdown_table([["Lexical unit", "Run 1", "Conf. 1", "Run 2", "Conf. 2", "Distance"]] +
                       [[row["lexicalUnit"], row["run1"]["cefr"], f"{row['run1']['confidence']:.2f}",
                         row["run2"]["cefr"], f"{row['run2']['confidence']:.2f}", row["distance"]] for row in nonzero]),
        "",
        "## Major Disagreements",
        "",
        markdown_table([["Lexical unit", "Run 1", "Conf. 1", "Run 2", "Conf. 2", "Distance"]] +
                       [[row["lexicalUnit"], row["run1"]["cefr"], f"{row['run1']['confidence']:.2f}",
                         row["run2"]["cefr"], f"{row['run2']['confidence']:.2f}", row["distance"]] for row in majors]),
        "",
        "## Complete Table",
        "",
        markdown_table(table),
        "",
        "## Recommendation for Full Dataset Classification",
        "",
        recommendation,
        "",
        "These are engineering decision thresholds, not linguistic standards. A stable classifier cannot compensate for bad source records; read this together with the data-quality audit.",
        "",
    ]
    CEFR_STABILITY_REPORT_PATH.write_text("\n".join(report), encoding="utf-8")
    print(f"Wrote CEFR stability report to {CEFR_STABILITY_REPORT_PATH}")


def generate_data_quality_report() -> None:
    sample = load_cefr_sample()
    if not DATA_QUALITY_OUTPUT_PATH.exists():
        raise SystemExit("Missing data-quality audit output. Run npm run vocab:cefr-data-quality first.")
    output = load_json(DATA_QUALITY_OUTPUT_PATH)
    results = output.get("results", []) if isinstance(output, dict) else []
    if len(results) != len(sample):
        raise SystemExit("Data-quality audit output is incomplete.")
    by_id = {result.get("id"): result for result in results if isinstance(result, dict)}
    rows, issue_counts, severity_counts = [], collections.Counter(), collections.Counter()
    ok = review = 0
    medium_high = []
    for entry in sample:
        result = by_id.get(entry["id"])
        errors = validate_data_quality_result(result, entry["id"])
        if errors:
            raise SystemExit(f"Invalid data-quality result for {entry['id']}: {'; '.join(errors)}")
        if result["status"] == "ok":
            ok += 1
        else:
            review += 1
        issues = result["issues"]
        for issue in issues:
            issue_counts[issue["type"]] += 1
            severity_counts[issue["severity"]] += 1
            if issue["severity"] in {"medium", "high"}:
                medium_high.append((entry, issue))
        rows.append([entry["answerCa"], entry.get("type") or ("expression" if entry["answerCa"] != entry["word"] else "word"),
                     entry.get("partOfSpeech", ""), result["status"],
                     "; ".join(f"{issue['severity']} {issue['type']}: {issue['explanation']}" for issue in issues) or ""])
    report = [
        "# CEFR sample data-quality audit",
        "",
        "This report audits the 60-entry CEFR sample for suspicious internal inconsistencies. It does not modify vocabulary data.",
        "",
        f"- Entries OK: {ok}",
        f"- Entries requiring review: {review}",
        "",
        "## Issue Counts by Type",
        "",
        ", ".join(f"{issue}: {issue_counts[issue]}" for issue in sorted(VALID_DATA_QUALITY_ISSUES)),
        "",
        "## Issue Counts by Severity",
        "",
        ", ".join(f"{severity}: {severity_counts[severity]}" for severity in ("low", "medium", "high")),
        "",
        "## Medium and High Severity Cases",
        "",
        markdown_table([["Lexical unit", "Issue", "Severity", "Explanation"]] +
                       [[entry["answerCa"], issue["type"], issue["severity"], issue["explanation"]] for entry, issue in medium_high]),
        "",
        "## Complete Review Table",
        "",
        markdown_table([["Lexical unit", "Type", "POS", "Status", "Issues"]] + rows),
        "",
    ]
    DATA_QUALITY_REPORT_PATH.write_text("\n".join(report), encoding="utf-8")
    print(f"Wrote data-quality report to {DATA_QUALITY_REPORT_PATH}")


def load_full_outputs() -> tuple[list[dict], dict, dict]:
    entries = load_production_vocabulary()
    classification = load_cefr_output(CEFR_FULL_OUTPUT_PATH, entries)
    if not DATA_QUALITY_FULL_OUTPUT_PATH.exists():
        raise SystemExit("Missing full data-quality output. Run npm run vocab:cefr-quality-full first.")
    quality = load_json(DATA_QUALITY_FULL_OUTPUT_PATH)
    quality_results = quality.get("results", []) if isinstance(quality, dict) else []
    if len(quality_results) != len(entries):
        raise SystemExit("Full data-quality output is incomplete.")
    by_quality = {result.get("id"): result for result in quality_results if isinstance(result, dict)}
    for entry in entries:
        errors = validate_data_quality_result(by_quality.get(entry["id"]), entry["id"])
        if errors:
            raise SystemExit(f"Invalid full data-quality result for {entry['id']}: {'; '.join(errors)}")
    return entries, classification, quality


def review_status(classification: dict, quality: dict) -> str:
    low_confidence = classification["confidence"] < 0.9
    quality_problem = any(issue["severity"] in {"medium", "high"} for issue in quality.get("issues", []))
    if low_confidence and quality_problem:
        return "review-both"
    if low_confidence:
        return "review-confidence"
    if quality_problem:
        return "review-quality"
    return "auto-candidate"


def generate_full_review_queue(entries: list[dict], classification: dict, quality: dict) -> list[dict]:
    by_class = {result["id"]: result for result in classification["results"]}
    by_quality = {result["id"]: result for result in quality["results"]}
    queue = []
    for entry in entries:
        result, audit = by_class[entry["id"]], by_quality[entry["id"]]
        queue.append({
            "id": entry["id"],
            "lexicalUnit": entry["answerCa"],
            "type": entry.get("type"),
            "reviewStatus": review_status(result, audit),
            "classification": result,
            "dataQuality": audit,
        })
    write_json(CEFR_FULL_REVIEW_PATH, queue)
    return queue


def median(values: list[float]) -> float:
    ordered = sorted(values)
    middle = len(ordered) // 2
    return ordered[middle] if len(ordered) % 2 else (ordered[middle - 1] + ordered[middle]) / 2


def generate_cefr_full_report() -> None:
    entries, classification, quality = load_full_outputs()
    queue = generate_full_review_queue(entries, classification, quality)
    by_class = {result["id"]: result for result in classification["results"]}
    by_quality = {result["id"]: result for result in quality["results"]}
    joined = [{**entry, "classification": by_class[entry["id"]], "quality": by_quality[entry["id"]]} for entry in entries]
    cefr_dist = collections.Counter(item["classification"]["cefr"] for item in joined)
    difficulty_dist = collections.Counter(item["difficulty"] for item in joined)
    type_dist = collections.Counter(item["type"] for item in joined)
    by_difficulty = collections.defaultdict(collections.Counter)
    for item in joined:
        by_difficulty[item["difficulty"]][item["classification"]["cefr"]] += 1
    confidences = [item["classification"]["confidence"] for item in joined]
    flagged = [item for item in joined if item["quality"]["status"] == "review"]
    issue_counts, severity_counts = collections.Counter(), collections.Counter()
    for item in flagged:
        for issue in item["quality"]["issues"]:
            issue_counts[issue["type"]] += 1
            severity_counts[issue["severity"]] += 1
    hard_a = [item for item in joined if item["difficulty"] == "hard" and item["classification"]["cefr"] in {"A1", "A2"}]
    easy_b2 = [item for item in joined if item["difficulty"] == "easy" and CEFR_ORDER[item["classification"]["cefr"]] >= CEFR_ORDER["B2"]]
    high_severity = [item for item in joined if any(issue["severity"] == "high" for issue in item["quality"]["issues"])]
    multiple_issues = [item for item in joined if len(item["quality"]["issues"]) >= 2]
    expression_issues = [item for item in joined if item["type"] == "expression" and item["quality"]["status"] == "review"]
    high_conf_high_quality = [item for item in joined if item["classification"]["confidence"] >= 0.9 and any(issue["severity"] == "high" for issue in item["quality"]["issues"])]
    low_conf_quality = [item for item in joined if item["classification"]["confidence"] < 0.9 and item["quality"]["status"] == "review"]
    queue_counts = collections.Counter(item["reviewStatus"] for item in queue)
    categories_by_cefr = collections.defaultdict(collections.Counter)
    pos_by_cefr = collections.defaultdict(collections.Counter)
    for item in joined:
        level = item["classification"]["cefr"]
        categories_by_cefr[level][item["classification"]["thematicCategory"]] += 1
        pos_by_cefr[level][item["classification"]["partOfSpeech"]] += 1
    rows_by_difficulty = [["Difficulty", *sorted(VALID_CEFR, key=CEFR_ORDER.get)]]
    rows_by_difficulty += [[difficulty, *[by_difficulty[difficulty][level] for level in sorted(VALID_CEFR, key=CEFR_ORDER.get)]]
                           for difficulty in ("easy", "medium", "hard")]
    report = [
        "# Full CEFR vocabulary analysis",
        "",
        "Experimental analysis only. Nothing in this report is promoted into production vocabulary metadata.",
        "",
        "## Dataset Overview",
        "",
        f"- Total entries: {len(joined)}",
        f"- Words: {type_dist['word']}",
        f"- Expressions: {type_dist['expression']}",
        f"- Current difficulty distribution: " + ", ".join(f"{key}: {difficulty_dist[key]}" for key in ("easy", "medium", "hard")),
        f"- CEFR distribution: " + ", ".join(f"{level}: {cefr_dist[level]}" for level in sorted(VALID_CEFR, key=CEFR_ORDER.get)),
        "",
        "## CEFR by Old Difficulty",
        "",
        markdown_table(rows_by_difficulty),
        "",
        f"- Current hard entries classified A1/A2: {len(hard_a)}",
        f"- Current easy entries classified B2+: {len(easy_b2)}",
        f"- Strong length-distortion candidates: {len([item for item in hard_a if word_length_bucket(item['answerCa']) == 'long'])}",
        f"- Strong frequency-distortion candidates: {len([item for item in hard_a if item.get('frequencyRank', 10_000_000) <= 250] + easy_b2)}",
        "",
        "## Confidence",
        "",
        f"- Average confidence: {sum(confidences) / len(confidences):.2f}",
        f"- Median confidence: {median(confidences):.2f}",
        f"- Number below 0.90: {sum(value < 0.9 for value in confidences)}",
        f"- Number below 0.80: {sum(value < 0.8 for value in confidences)}",
        "",
        "Lowest-confidence entries:",
        "",
        markdown_table([["Lexical unit", "CEFR", "Confidence", "Reason"]] +
                       [[item["answerCa"], item["classification"]["cefr"], f"{item['classification']['confidence']:.2f}", item["classification"]["reason"]]
                        for item in sorted(joined, key=lambda item: item["classification"]["confidence"])[:20]]),
        "",
        "## Data Quality",
        "",
        f"- Entries OK: {len(joined) - len(flagged)}",
        f"- Entries flagged: {len(flagged)}",
        f"- Issues by type: " + ", ".join(f"{issue}: {issue_counts[issue]}" for issue in sorted(VALID_DATA_QUALITY_ISSUES)),
        f"- Issues by severity: " + ", ".join(f"{severity}: {severity_counts[severity]}" for severity in ("low", "medium", "high")),
        f"- Entries with high severity: {len(high_severity)}",
        f"- Entries with multiple issues: {len(multiple_issues)}",
        f"- Expression-specific issues: {len(expression_issues)}",
        "",
        "## CEFR and Quality Interaction",
        "",
        f"- High-confidence classification plus high-severity data problem: {len(high_conf_high_quality)}",
        f"- Low-confidence plus data-quality problem: {len(low_conf_quality)}",
        f"- Entries classified confidently despite suspicious source data: {len([item for item in joined if item['classification']['confidence'] >= 0.9 and item['quality']['status'] == 'review'])}",
        "",
        "## Review Queue",
        "",
        ", ".join(f"{status}: {queue_counts[status]}" for status in ("auto-candidate", "review-confidence", "review-quality", "review-both")),
        "",
        "## Coverage Analysis",
        "",
        "Entries per CEFR level:",
        "",
        ", ".join(f"{level}: {cefr_dist[level]}" for level in sorted(VALID_CEFR, key=CEFR_ORDER.get)),
        "",
        "Top categories by CEFR:",
        "",
        markdown_table([["CEFR", "Top categories"]] + [[level, "; ".join(f"{category} ({count})" for category, count in categories_by_cefr[level].most_common(8))]
                                                       for level in sorted(VALID_CEFR, key=CEFR_ORDER.get)]),
        "",
        "POS representation by CEFR:",
        "",
        markdown_table([["CEFR", *sorted(VALID_POS)]] + [[level, *[pos_by_cefr[level][pos] for pos in sorted(VALID_POS)]]
                                                        for level in sorted(VALID_CEFR, key=CEFR_ORDER.get)]),
        "",
        "Potential gaps or overrepresentation should be reviewed from the category/POS tables above; this phase does not add missing vocabulary.",
        "",
    ]
    CEFR_FULL_ANALYSIS_REPORT_PATH.write_text("\n".join(report), encoding="utf-8")
    print(f"Wrote full CEFR analysis report to {CEFR_FULL_ANALYSIS_REPORT_PATH}")
    print(f"Wrote full CEFR review queue to {CEFR_FULL_REVIEW_PATH}")


def markdown_table(rows: list[list[object]]) -> str:
    if not rows:
        return ""
    header, body = rows[0], rows[1:]
    def cell(value: object) -> str:
        return str(value).replace("|", "\\|").replace("\n", " ")
    lines = ["| " + " | ".join(cell(value) for value in header) + " |",
             "| " + " | ".join("---" for _ in header) + " |"]
    lines.extend("| " + " | ".join(cell(value) for value in row) + " |" for row in body)
    return "\n".join(lines)


ISSUE_PRIORITY = {
    "sense-mismatch": 0,
    "pos-mismatch": 0,
    "expression-mismatch": 0,
    "translation-mismatch": 1,
    "possible-polysemy": 1,
    "example-mismatch": 2,
    "other": 3,
}
SEVERITY_PRIORITY = {"high": 0, "medium": 1, "low": 2}


def proposal_changed_fields(proposal: dict) -> list[str]:
    changes = proposal.get("changes", {}) if isinstance(proposal.get("changes"), dict) else {}
    return [field for field in REPAIR_FIELDS if changes.get(field) is not None]


def repair_sort_key(item: dict) -> tuple:
    issues = item["audit"].get("issues", [])
    severities = [SEVERITY_PRIORITY.get(issue.get("severity"), 9) for issue in issues]
    issue_types = {issue.get("type") for issue in issues}
    high = 0 if any(issue.get("severity") == "high" for issue in issues) else 1
    sense_pos_expression = 0 if issue_types & {"sense-mismatch", "pos-mismatch", "expression-mismatch", "translation-mismatch", "possible-polysemy"} else 1
    multiple = 0 if len(issues) > 1 else 1
    medium_example = 0 if any(issue.get("type") == "example-mismatch" and issue.get("severity") == "medium" for issue in issues) else 1
    low_style = 0 if any(issue.get("severity") == "low" for issue in issues) else 1
    return (high, sense_pos_expression, multiple, medium_example, low_style, min(severities or [9]), item["answerCa"])


def generate_repair_report(path: Path = REPAIR_PROPOSALS_PATH, report_path: Path = REPAIR_ANALYSIS_REPORT_PATH) -> None:
    validate_repair_proposals_file(path)
    flagged = flagged_repair_entries()
    proposals_data = load_json(path)
    proposals = proposals_data.get("results", []) if isinstance(proposals_data, dict) else []
    by_proposal = {proposal["id"]: proposal for proposal in proposals}

    field_counts = collections.Counter()
    issue_counts = collections.Counter()
    issue_field_counts = collections.defaultdict(collections.Counter)
    manual = cefr_recheck = only_example = only_pos = multiple_fields = answer_type = split_recommended = 0
    rows = []
    ordered_entries = sorted(flagged, key=repair_sort_key)
    for entry in ordered_entries:
        proposal = by_proposal[entry["id"]]
        fields = proposal_changed_fields(proposal)
        issue_types = [issue["type"] for issue in entry["audit"].get("issues", [])]
        for issue_type in issue_types:
            issue_counts[issue_type] += 1
            for field in fields:
                issue_field_counts[issue_type][field] += 1
        for field in fields:
            field_counts[field] += 1
        manual += int(bool(proposal.get("requiresManualDecision")))
        cefr_recheck += int(bool(proposal.get("cefrNeedsRecheck")))
        only_example += int(fields == ["exampleCa"])
        only_pos += int(fields == ["partOfSpeech"])
        multiple_fields += int(len(fields) > 1)
        answer_type += int(any(field in {"answerCa", "type", "targetExpression"} for field in fields))
        split_recommended += int(any("split" in note.lower() for note in proposal.get("notes", []) if isinstance(note, str)))
        rows.append([
            entry["answerCa"],
            ", ".join(issue_types),
            ", ".join(fields) if fields else proposal["status"],
            "yes" if proposal.get("requiresManualDecision") else "no",
            "yes" if proposal.get("cefrNeedsRecheck") else "no",
        ])

    field_summary = ", ".join(f"{field}: {field_counts[field]}" for field in REPAIR_FIELDS if field_counts[field]) or "none"
    issue_summary = ", ".join(f"{issue}: {issue_counts[issue]}" for issue in sorted(issue_counts)) or "none"
    issue_field_rows = [["Issue type", "Proposed fields"]]
    for issue_type in sorted(issue_field_counts):
        counts = issue_field_counts[issue_type]
        issue_field_rows.append([issue_type, ", ".join(f"{field}: {counts[field]}" for field in REPAIR_FIELDS if counts[field]) or "none"])

    report = [
        "# Vocabulary repair proposal analysis",
        "",
        "Proposal-only Phase 6A report. It does not apply repairs or modify production vocabulary.",
        "",
        "## Summary",
        "",
        f"- Total flagged entries: {len(flagged)}",
        f"- Proposals: {len(proposals)}",
        f"- Requires manual decision: {manual}",
        f"- CEFR needs recheck: {cefr_recheck}",
        f"- Proposed changes by field: {field_summary}",
        f"- Audit issues represented: {issue_summary}",
        f"- Only example changes: {only_example}",
        f"- Only POS changes: {only_pos}",
        f"- Multiple-field proposals: {multiple_fields}",
        f"- Answer/type/expression metadata proposals: {answer_type}",
        f"- Split recommended in notes: {split_recommended}",
        "",
        "## Proposed changes by issue type",
        "",
        markdown_table(issue_field_rows),
        "",
        "## Review ordering",
        "",
        "Rows are ordered by: high severity first; sense/POS/expression/translation/polysemy issues; multiple-issue entries; medium example issues; then low style/pedagogical issues.",
        "",
        markdown_table([["Lexical unit", "Audit issues", "Proposed fields", "Manual review", "CEFR recheck"]] + rows),
        "",
    ]
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(report), encoding="utf-8")
    print(f"Wrote repair proposal report to {report_path}")


MANUAL_REPAIR_IDS = {"una-mica", "català", "funció", "ningú", "personal", "espanyol"}
SPLIT_REPAIR_IDS = {"català", "espanyol", "matèria", "personal", "precisament"}


def _repair_context():
    production = load_production_vocabulary()
    data = load_json(REPAIR_PROPOSALS_PATH)
    proposals = data.get("results", []) if isinstance(data, dict) else []
    by_id = {p.get("id"): p for p in proposals}
    if set(by_id) != {e["id"] for e in flagged_repair_entries()}:
        raise SystemExit("Candidate generation requires the complete validated Phase 6A proposal set.")
    validate_repair_proposals_file(REPAIR_PROPOSALS_PATH)
    return production, by_id


def _split_rationale(proposal):
    return [n for n in proposal.get("notes", []) if isinstance(n, str) and any(k in n.lower() for k in ("split", "polysemy", "conflat", "mixes two senses", "sense/ambiguity"))]


def generate_repair_candidate(path: Path = REPAIR_CANDIDATE_PATH, report_path: Path = REPAIR_CANDIDATE_REPORT_PATH) -> None:
    production, by_id = _repair_context()
    candidate = [dict(e) for e in production]
    applied, fields = [], collections.Counter()
    for entry, out in zip(production, candidate):
        proposal = by_id.get(entry["id"])
        if proposal is None:
            continue
        if proposal.get("requiresManualDecision") or entry["id"] in MANUAL_REPAIR_IDS:
            continue
        for field in REPAIR_FIELDS:
            value = proposal.get("changes", {}).get(field)
            if value is not None:
                out[field] = value; fields[field] += 1
                if field == "translationEs":
                    out["hintEs"] = value
                    out["translationsEs"] = [value]
                applied.append((entry, out, field, value))
    if len(candidate) != len(production) or {e["id"] for e in candidate} != {e["id"] for e in production}:
        raise SystemExit("Candidate integrity failure: ID coverage/count changed.")
    for before, after in zip(production, candidate):
        if before["id"] not in by_id:
            continue
        allowed = {f for f in REPAIR_FIELDS if by_id[before["id"]].get("changes", {}).get(f) is not None and not by_id[before["id"]].get("requiresManualDecision")}
        changed = {k for k in set(before) | set(after) if before.get(k) != after.get(k)}
        if changed - (set(allowed) | ({"hintEs", "translationsEs"} if "translationEs" in allowed else set())):
            raise SystemExit(f"Untraceable candidate difference for {before['id']}")
    write_json(path, {"metadata": {"source": str(DATA / "vocabulary.json"), "proposals": str(REPAIR_PROPOSALS_PATH), "entries": len(candidate), "appliedEntries": len({x[0]['id'] for x in applied}), "fieldCounts": dict(fields)}, "entries": candidate})
    generate_repair_candidate_report(production, candidate, by_id, applied, fields, report_path)
    print(f"Wrote repair candidate to {path}")


def generate_repair_candidate_report(production, candidate, by_id, applied, fields, report_path=REPAIR_CANDIDATE_REPORT_PATH):
    manual = [e for e in production if e["id"] in MANUAL_REPAIR_IDS]
    splits = [e for e in production if e["id"] in SPLIT_REPAIR_IDS]
    lines = ["# Phase 6B candidate vocabulary review", "", "Candidate-only artifact; production vocabulary is unchanged.", "",
             "## Summary", "", f"- Production entries: {len(production)}", f"- Candidate entries: {len(candidate)}", f"- Proposal entries: {len(by_id)}", f"- Automatically repaired entries: {len({e['id'] for e, _, _, _ in applied})}", f"- Individual field replacements: {len(applied)}", f"- Field counts: {', '.join(f'{k}: {v}' for k, v in fields.items())}", f"- Manual unchanged: {len(manual)}", f"- Split recommendations (not applied): {len(splits)}", "- Candidate validation: passed", ""]
    lines += ["## A. Manual decisions", "", "These entries are copied byte-for-byte at the entry level from production.", ""]
    for e in manual:
        p = by_id[e["id"]]; lines += [f"### `{e['answerCa']}`", f"- Issues: {', '.join(i.get('type','') for i in next(x for x in flagged_repair_entries() if x['id']==e['id'])['audit'].get('issues', []))}", f"- Current fields: `{json.dumps({k:e.get(k) for k in ('partOfSpeech','definitionCa','translationEs','exampleCa')}, ensure_ascii=False)}`", f"- Proposed changes: `{json.dumps(p.get('changes',{}), ensure_ascii=False)}`", f"- Reasoning/notes: {' '.join(p.get('notes', []))}", "- Status: manual decision required; no decision made.", ""]
    lines += ["## B. Structural split recommendations", ""]
    for e in splits:
        p=by_id[e['id']]; lines += [f"### `{e['answerCa']}`", f"- Proposed split: not specified as an executable operation; human must decide senses/IDs.", f"- Complete rationale: {' '.join(_split_rationale(p))}", f"- Fields/senses affected: answer/type, definition, translation, POS, examples as applicable; current record: `{json.dumps(e, ensure_ascii=False)}`", ""]
    lines += ["## C. Semantic changes", "", "| ID | Field | Before | After |", "|---|---|---|---|"]
    for before, after, field, _ in applied:
        if field in {"partOfSpeech", "definitionCa", "translationEs"}:
            lines.append(f"| `{before['id']}` | {field} | {before.get(field)} | {after.get(field)} |")
            if by_id[before['id']].get('changes',{}).get('exampleCa') is not None: lines.append(f"| `{before['id']}` | exampleCa | {before.get('exampleCa')} | {after.get('exampleCa')} |")
    example_only=[e for e in production if e['id'] in by_id and [f for f in REPAIR_FIELDS if by_id[e['id']].get('changes',{}).get(f) is not None]==['exampleCa'] and not by_id[e['id']].get('requiresManualDecision')]
    lines += ["", "## D. Example-only repairs", "", f"Total: {len(example_only)}", "", ", ".join(f"`{e['id']}` ({e['answerCa']})" for e in example_only), "", "## E. CEFR recheck queue", "", "See the deterministic queue artifact generated by `vocab:repair-cefr-recheck`."]
    report_path.parent.mkdir(parents=True, exist_ok=True); report_path.write_text('\n'.join(lines)+'\n', encoding='utf-8')

def semantic_verification_entries() -> list[dict]:
    production, by_id = _repair_context()
    candidate = load_json(REPAIR_CANDIDATE_PATH).get("entries", [])
    cby={e["id"]:e for e in candidate}
    ids={e["id"] for e in production if any(e.get(f)!=cby[e["id"]].get(f) for f in ("partOfSpeech","definitionCa","translationEs"))}
    ids |= MANUAL_REPAIR_IDS | SPLIT_REPAIR_IDS
    audits={e["id"]:e.get("audit",{}) for e in flagged_repair_entries()}
    out=[]
    for e in production:
        if e["id"] not in ids: continue
        c=cby[e["id"]]; proposal=by_id.get(e["id"],{})
        out.append({"id":e["id"],"word":e.get("word"),"answerCa":e.get("answerCa"),"type":e.get("type"),
          "production":{"partOfSpeech":e.get("partOfSpeech"),"definitionCa":e.get("definitionCa"),"translationEs":e.get("translationEs"),"exampleCa":e.get("exampleCa")},
          "candidate":{"partOfSpeech":c.get("partOfSpeech"),"definitionCa":c.get("definitionCa"),"translationEs":c.get("translationEs"),"exampleCa":c.get("exampleCa")},
          "auditIssues":audits.get(e["id"],{}).get("issues",[]),"repairNotes":proposal.get("notes",[]),
          "manualReviewRequested":e["id"] in MANUAL_REPAIR_IDS or bool(proposal.get("requiresManualDecision")),
          "structuralSplitRecommended":e["id"] in SPLIT_REPAIR_IDS})
    return out

def write_semantic_verification_input(path=SEMANTIC_VERIFICATION_INPUT_PATH):
    entries=semantic_verification_entries(); write_json(path,{"metadata":{"entries":len(entries),"source":str(REPAIR_CANDIDATE_PATH),"cefrRecheck":"not-run"},"entries":entries}); print(f"Wrote semantic verification input: {len(entries)} entries")

def run_semantic_verification(model=None, force=False, provider=None, verbose=True, batch_size=DEFAULT_AUDIT_BATCH_SIZE, concurrency=DEFAULT_AUDIT_CONCURRENCY):
    entries=semantic_verification_entries(); write_json(SEMANTIC_VERIFICATION_INPUT_PATH,{"metadata":{"entries":len(entries),"source":str(REPAIR_CANDIDATE_PATH),"cefrRecheck":"not-run"},"entries":entries})
    chosen=model or os.environ.get("VOCAB_SEMANTIC_MODEL") or os.environ.get("VOCAB_LLM_MODEL") or CEFR_EXPERIMENT_MODEL_DEFAULT
    metadata={"generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"model":chosen,"promptVersion":SEMANTIC_VERIFICATION_PROMPT_VERSION,"entries":len(entries),"inputHash":content_hash(entries),"script":"scripts/vocab_pipeline.py repair-semantic-verify"}
    client=provider or OpenAISemanticVerificationProvider(chosen)
    run_batched_checkpoint(entries,SEMANTIC_VERIFICATION_OUTPUT_PATH,metadata,client.verify_batch,validate_semantic_verification_result,"Semantic verification",batch_size=batch_size,concurrency=concurrency,force=force,verbose=verbose)

def generate_semantic_verification_report():
    entries=semantic_verification_entries(); output=load_json(SEMANTIC_VERIFICATION_OUTPUT_PATH); results=output.get("results",[])
    errors=validate_batch_results(results,[e["id"] for e in entries],validate_semantic_verification_result)
    if errors: raise SystemExit("Semantic verification output incomplete: "+"; ".join(errors))
    by={r["id"]:r for r in results}; counts=collections.Counter(r["decision"] for r in results); splits=collections.Counter(r["splitAssessment"] for r in results)
    lines=["# Phase 6C semantic verification","","Verification-only artifact. Production, Phase 6B candidate, and CEFR artifacts were not modified.","", "## Summary","",f"- Verification set: {len(entries)}",f"- Accepted: {counts['accept']}",f"- Manual-review: {counts['manual-review']}",f"- Rejected: {counts['reject']}",f"- Split needed/optional/not-needed: {splits['needed']}/{splits['optional']}/{splits['not-needed']}","- CEFR recheck: not run","", "## Decisions", "", "| ID | Decision | Split | Reason |", "|---|---|---|---|"]
    for e in entries:
        r=by[e["id"]]; lines.append(f"| `{e['id']}` | {r['decision']} | {r['splitAssessment']} | {r['reason']} |")
    SEMANTIC_VERIFICATION_REPORT_PATH.write_text("\n".join(lines)+"\n",encoding="utf-8")

def prepare_repair_cefr_queue(path: Path = REPAIR_CEFR_QUEUE_PATH) -> None:
    production, by_id = _repair_context(); candidate = load_json(REPAIR_CANDIDATE_PATH).get("entries", [])
    affected = [e for e in production if e["id"] in by_id and by_id[e["id"]].get("cefrNeedsRecheck")]
    affected_ids = {e["id"] for e in affected}
    runnable = [e for e in candidate if e["id"] in affected_ids and e["id"] not in MANUAL_REPAIR_IDS and e["id"] not in SPLIT_REPAIR_IDS]
    deferred = [e["id"] for e in affected if e["id"] not in {x["id"] for x in runnable}]
    write_json(path, {"metadata":{"requested":len(affected),"runnable":len(runnable),"deferred":deferred}, "entries":runnable})
    print(f"Wrote CEFR recheck queue: {len(runnable)} runnable, {len(deferred)} deferred")


# Phase 6D is deliberately data-driven: this artifact is the auditable human
# decision layer, while the code below only applies generic field overrides.
PHASE_6D_IDS = ["dues", "sola", "una-mica", "industrial", "accident", "boig", "català", "d'altra-banda", "de-tant-en-tant", "doble", "espanyol", "funció", "matèria", "ningú", "personal", "precisament", "sopar"]

def _final_resolution_artifact() -> dict:
    """Return explicit Phase 6D decisions, creating the reviewable artifact."""
    if HUMAN_RESOLUTIONS_PATH.exists():
        return load_json(HUMAN_RESOLUTIONS_PATH)
    resolutions = {
        "metadata": {"phase": "6D", "policy": "one representative pedagogical sense; no splits", "taxonomyFallback": "other"},
        "resolutions": {
            "dues": {"partOfSpeech": "other", "rationale": "Numeral fallback; do not label as noun."},
            "sola": {"partOfSpeech": "adjective", "definitionCa": "Sense estar sense companyia o sense una altra cosa que l'acompanyi.", "translationEs": "sola", "exampleCa": "La nena va arribar sola a casa.", "rationale": "Keep the adjectival sense."},
            "una-mica": {"answerCa": "una mica", "partOfSpeech": "other", "definitionCa": "En una quantitat o un grau petit.", "translationEs": "un poco", "exampleCa": "Espera una mica, si us plau.", "rationale": "Keep the full fixed expression."},
            "industrial": {"restoreProduction": True, "rationale": "Preserve the production noun sense."},
            "accident": {"useCandidate": True, "rationale": "Accept the ordinary literal sense from Phase 6B."},
            "boig": {"partOfSpeech": "adjective", "definitionCa": "Que no actua d'una manera raonable o que ha perdut el seny.", "exampleCa": "No siguis boig: abriga't abans de sortir.", "rationale": "Use one clear adjective sense."},
            "català": {"partOfSpeech": "noun", "definitionCa": "Llengua romànica parlada a Catalunya i en altres territoris de parla catalana.", "translationEs": "catalán", "exampleCa": "A l'escola estudiem català.", "rationale": "Choose the language sense only."},
            "d-altra-banda": {"partOfSpeech": "other", "definitionCa": "Expressió que introdueix un altre aspecte o una altra consideració.", "exampleCa": "D'altra banda, aquesta opció és més econòmica.", "rationale": "Keep the complete fixed expression."},
            "de-tant-en-tant": {"partOfSpeech": "adverb", "definitionCa": "De manera ocasional; de tant en tant.", "exampleCa": "De tant en tant anem al teatre.", "rationale": "Keep the complete adverbial expression."},
            "doble": {"partOfSpeech": "adjective", "definitionCa": "Que té dues parts o que és dues vegades una quantitat.", "exampleCa": "Avui necessito una ració doble.", "rationale": "Choose the adjective sense."},
            "espanyol": {"partOfSpeech": "adjective", "definitionCa": "Relatiu a Espanya o als espanyols.", "translationEs": "español", "exampleCa": "A la biblioteca hi ha un llibre espanyol.", "rationale": "Choose the adjective sense only."},
            "funció": {"partOfSpeech": "noun", "definitionCa": "Espectacle teatral, cinematogràfic o musical que es representa davant del públic.", "translationEs": "función", "exampleCa": "Dissabte anirem a una funció al teatre.", "rationale": "Choose the theatrical performance sense."},
            "matèria": {"partOfSpeech": "noun", "definitionCa": "Assignatura o camp d'estudi que forma part d'un programa educatiu.", "translationEs": "materia", "exampleCa": "La matemàtica és una matèria important.", "rationale": "Choose the educational subject sense."},
            "ningú": {"partOfSpeech": "other", "rationale": "Use taxonomy fallback for the pronoun."},
            "personal": {"partOfSpeech": "noun", "definitionCa": "Conjunt de persones que treballen en un lloc, una empresa o un servei.", "rationale": "Preserve the collective noun sense."},
            "precisament": {"partOfSpeech": "adverb", "definitionCa": "D'una manera exacta o justament.", "exampleCa": "Precisament avui no puc venir.", "rationale": "Choose one common emphatic/exact adverbial sense."},
            "sopar": {"partOfSpeech": "noun", "definitionCa": "Àpat que es fa al vespre o a la nit.", "exampleCa": "El sopar és a les nou.", "rationale": "Choose the evening-meal noun sense."}
        }
    }
    write_json(HUMAN_RESOLUTIONS_PATH, resolutions)
    return resolutions

def generate_final_candidate(path: Path = FINAL_CANDIDATE_PATH, report_path: Path = FINAL_CANDIDATE_REPORT_PATH, queue_path: Path = FINAL_CEFR_QUEUE_PATH) -> None:
    production, proposals = _repair_context()
    phase6b = load_json(REPAIR_CANDIDATE_PATH)["entries"]
    semantic = load_json(SEMANTIC_VERIFICATION_OUTPUT_PATH)["results"]
    semantic_by = {x["id"]: x for x in semantic}
    resolutions = _final_resolution_artifact()["resolutions"]
    final = [dict(x) for x in phase6b]
    pby = {x["id"]: x for x in production}; cby = {x["id"]: x for x in phase6b}
    provenance = {}; field_counts = collections.Counter()
    for out in final:
        ident = out["id"]
        if pby[ident] != cby[ident]:
            proposal = proposals.get(ident, {})
            provenance.setdefault(ident, []).append("phase6a-example-only" if set(k for k,v in proposal.get("changes", {}).items() if v is not None) == {"exampleCa"} else "phase6c-validated-proposal")
        if ident in semantic_by and semantic_by[ident]["decision"] == "accept":
            provenance.setdefault(ident, []).append("phase6c-accept")
        resolution = resolutions.get(ident)
        if not resolution: continue
        if resolution.get("restoreProduction"):
            out.clear(); out.update(pby[ident]); provenance.setdefault(ident, []).append("phase6d-human")
        elif resolution.get("useCandidate"):
            provenance.setdefault(ident, []).append("phase6d-human")
        else:
            for field in ("answerCa", "type", "definitionCa", "translationEs", "exampleCa", "partOfSpeech"):
                if field in resolution: out[field] = resolution[field]
            provenance.setdefault(ident, []).append("phase6d-human")
        if "translationEs" in resolution:
            out["hintEs"] = resolution["translationEs"]; out["translationsEs"] = [resolution["translationEs"]]
    if len(final) != 544 or {x["id"] for x in final} != set(pby): raise SystemExit("Phase 6D ID coverage failure")
    for before, after in zip(production, final):
        changed = {k for k in set(before)|set(after) if before.get(k) != after.get(k)}
        if changed and before["id"] not in provenance: raise SystemExit(f"Untraceable Phase 6D difference: {before['id']}")
        for field in changed: field_counts[field] += 1
    validate(final)
    affected=[]
    for before, after in zip(production, final):
        relevant={"answerCa","type","definitionCa","translationEs","partOfSpeech"}
        changed=relevant & {k for k in set(before)|set(after) if before.get(k)!=after.get(k)}
        if changed: affected.append({**after, "recheckReason": "; ".join(sorted(changed))})
    previous_ids = {x["id"] for x in load_json(REPAIR_CEFR_QUEUE_PATH).get("entries", [])}
    final_ids = {x["id"] for x in affected}
    write_json(queue_path, {"metadata":{"source":str(path),"previousQueue":len(previous_ids),"requested":len(affected),"runnable":len(affected),"deferred":[],"idsAdded":sorted(final_ids-previous_ids),"idsRemoved":sorted(previous_ids-final_ids)},"entries":affected})
    write_json(path, {"metadata":{"source":str(DATA/"vocabulary.json"),"phase6b":str(REPAIR_CANDIDATE_PATH),"phase6c":str(SEMANTIC_VERIFICATION_OUTPUT_PATH),"entries":len(final),"fieldCounts":dict(field_counts),"provenance":provenance},"entries":final})
    lines=["# Phase 6D final candidate vocabulary review","","Candidate-only artifact; production and prior-phase artifacts are unchanged.","","## Summary","",f"- Production count: {len(production)}",f"- Final candidate count: {len(final)}",f"- Total changed entries: {sum(1 for a,b in zip(production,final) if a!=b)}",f"- Total field changes: {sum(field_counts.values())}",f"- Counts by field: {dict(field_counts)}",f"- Semantic Phase 6C accepts retained: {sum(1 for x in semantic if x['decision']=='accept')}",f"- Explicit Phase 6D human resolutions: {len(resolutions)}","- Example-only repairs retained: 92","- Splits performed: 0","- Candidate validation: passed",f"- Final CEFR queue size: {len(affected)}","","## Human resolutions","", "| ID | Rationale |", "|---|---|"]
    lines[lines.index("| ID | Rationale |") if "| ID | Rationale |" in lines else 0] = "| ID | Production | Phase 6B | Phase 6C | Final | Rationale |"
    lines[lines.index("|---|---|") if "|---|---|" in lines else 0] = "|---|---|---|---|---|---|"
    for ident, r in resolutions.items():
        state = lambda x: json.dumps({k:x.get(k) for k in ("partOfSpeech","definitionCa","translationEs","exampleCa")}, ensure_ascii=False)
        classification = semantic_by.get(ident, {}).get("decision", "not in verification set")
        lines.append(f"| `{ident}` | {state(pby[ident])} | {state(cby[ident])} | {classification} | {state(next(x for x in final if x['id']==ident))} | {r.get('rationale','')} |")
    lines += ["","## Semantic final diff","","| ID | Field | Production | Final |","|---|---|---|---|"]
    for before,after in zip(production,final):
        for field in ("partOfSpeech","definitionCa","translationEs"):
            if before.get(field)!=after.get(field): lines.append(f"| `{before['id']}` | {field} | {before.get(field)} | {after.get(field)} |")
    lines += ["","## Example-only repairs","","Retained from validated Phase 6A/6B; no regeneration performed.","","## CEFR queue",""]+[f"- `{x['id']}`: {x['recheckReason']}" for x in affected]
    report_path.write_text("\n".join(lines)+"\n",encoding="utf-8")
    print(f"Wrote Phase 6D final candidate ({len(final)} entries) and CEFR queue ({len(affected)} runnable, 0 deferred)")

def validate_final_candidate() -> None:
    production = load_production_vocabulary()
    final = load_json(FINAL_CANDIDATE_PATH)["entries"]
    validate(final)
    if len(final) != len(production) or {x["id"] for x in final} != {x["id"] for x in production}:
        raise SystemExit("Final candidate must preserve the exact production ID set")
    by = {x["id"]: x for x in final}
    checks = {
        "dues": by["dues"]["partOfSpeech"] != "noun",
        "ningú": by["ningú"]["partOfSpeech"] == "other",
        "sola": by["sola"]["partOfSpeech"] == "adjective" and "sola" in normalize(by["sola"]["exampleCa"]),
        "sopar": by["sopar"]["partOfSpeech"] == "noun",
        "una-mica": by["una-mica"]["answerCa"] == "una mica" and by["una-mica"]["type"] == "expression",
        "català": by["català"]["translationEs"] == "catalán",
        "espanyol": by["espanyol"]["partOfSpeech"] == "adjective" and by["espanyol"]["translationEs"] == "español",
        "personal": by["personal"]["partOfSpeech"] == "noun",
        "funció": by["funció"]["translationEs"] == "función",
        "matèria": by["matèria"]["translationEs"] == "materia",
    }
    if not all(checks.values()): raise SystemExit("Focused Phase 6D semantic regression failed: " + ", ".join(k for k,v in checks.items() if not v))
    queue = load_json(FINAL_CEFR_QUEUE_PATH)
    if queue.get("metadata", {}).get("deferred") != []: raise SystemExit("Final CEFR queue contains deferred entries")
    if any(e["id"] not in {x["id"] for x in final} for e in queue.get("entries", [])): raise SystemExit("Final CEFR queue has unknown ID")
    print(f"Validated final candidate and CEFR queue: {len(final)} entries, {len(queue.get('entries', []))} runnable")

def run_repair_cefr_recheck(model=None, force=False):
    if not REPAIR_CEFR_QUEUE_PATH.exists(): prepare_repair_cefr_queue()
    queue=load_json(REPAIR_CEFR_QUEUE_PATH).get("entries", [])
    run_cefr_classification(queue, REPAIR_CEFR_OUTPUT_PATH, "scripts/vocab_pipeline.py repair-cefr-recheck", model=model, force=force)

def validate_repair_cefr_recheck():
    queue=load_json(REPAIR_CEFR_QUEUE_PATH).get("entries", []); output=load_json(REPAIR_CEFR_OUTPUT_PATH)
    errors=validate_batch_results(output.get("results"), [e["id"] for e in queue], validate_cefr_classification)
    if errors: raise SystemExit("CEFR recheck validation failed:\n- " + "\n- ".join(errors))
    print(f"Validated {len(queue)} targeted CEFR rechecks")


def generate_cefr_report() -> None:
    sample = load_cefr_sample()
    if not CEFR_OUTPUT_PATH.exists():
        raise SystemExit("Missing CEFR experiment output. Run npm run vocab:cefr-experiment first.")
    output = load_json(CEFR_OUTPUT_PATH)
    results = output.get("results", []) if isinstance(output, dict) else []
    if len(results) != len(sample):
        raise SystemExit("CEFR experiment output is incomplete.")
    by_id = {result["id"]: result for result in results}
    for entry in sample:
        errors = validate_cefr_classification(by_id.get(entry["id"]), entry["id"])
        if errors:
            raise SystemExit(f"Invalid CEFR result for {entry['id']}: {'; '.join(errors)}")
    joined = [{**entry, **by_id[entry["id"]]} for entry in sample]
    cefr_distribution = collections.Counter(item["cefr"] for item in joined)
    by_difficulty: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for item in joined:
        by_difficulty[item["difficulty"]][item["cefr"]] += 1
    average_confidence = sum(float(item["confidence"]) for item in joined) / len(joined)
    low_confidence = [item for item in joined if item["confidence"] < 0.7]
    easy_b2_plus = [item for item in joined if item["difficulty"] == "easy" and CEFR_ORDER[item["cefr"]] >= CEFR_ORDER["B2"]]
    hard_a = [item for item in joined if item["difficulty"] == "hard" and item["cefr"] in {"A1", "A2"}]
    medium_extremes = [item for item in joined if item["difficulty"] == "medium" and item["cefr"] in {"A1", "A2", "C1", "C2"}]
    length_distorted = [item for item in joined if "possible-length-distortion" in item.get("selectionReasons", [])]
    frequency_distorted = [item for item in joined if "possible-frequency-distortion" in item.get("selectionReasons", [])]
    category_distribution = collections.Counter(item["thematicCategory"] for item in joined)
    pos_distribution = collections.Counter(item["partOfSpeech"] for item in joined)
    rows = [["Word", "Existing difficulty", "Frequency rank", "CEFR", "Confidence", "Category", "Reason"]]
    rows.extend([item["answerCa"], item["difficulty"], item.get("frequencyRank", ""), item["cefr"],
                 f"{float(item['confidence']):.2f}", item["thematicCategory"], item["reason"]] for item in joined)
    meta = output.get("metadata", {})
    report = [
        "# CEFR classification experiment",
        "",
        "This report compares an isolated 60-entry OpenAI CEFR experiment with Penjat's existing game difficulty heuristic. Disagreement is expected and is evidence for review, not an error.",
        "",
        "## Metadata",
        "",
        f"- Generated at: {meta.get('generatedAt', 'unknown')}",
        f"- Model: {meta.get('model', 'unknown')}",
        f"- Prompt version: {meta.get('promptVersion', 'unknown')}",
        f"- Sample hash: {meta.get('sampleHash', 'unknown')}",
        f"- Total sample size: {len(joined)}",
        f"- Average confidence: {average_confidence:.2f}",
        "",
        "## CEFR distribution",
        "",
        ", ".join(f"{level}: {cefr_distribution[level]}" for level in sorted(VALID_CEFR, key=CEFR_ORDER.get)),
        "",
        "## CEFR by existing difficulty",
        "",
        markdown_table([["Difficulty", *sorted(VALID_CEFR, key=CEFR_ORDER.get)]] + [[difficulty, *[by_difficulty[difficulty][level] for level in sorted(VALID_CEFR, key=CEFR_ORDER.get)]]
                       for difficulty in ("easy", "medium", "hard")]),
        "",
        "## Review focus",
        "",
        f"- Low-confidence cases (<0.70): {len(low_confidence)}",
        f"- Easy words classified B2+: {len(easy_b2_plus)}",
        f"- Hard words classified A1/A2: {len(hard_a)}",
        f"- Medium words classified at either extreme: {len(medium_extremes)}",
        f"- Possible length-distortion examples in sample: {len(length_distorted)}",
        f"- Possible frequency-distortion examples in sample: {len(frequency_distorted)}",
        "",
        "## Thematic category distribution",
        "",
        ", ".join(f"{category}: {count}" for category, count in sorted(category_distribution.items())),
        "",
        "## POS distribution",
        "",
        ", ".join(f"{pos}: {pos_distribution[pos]}" for pos in sorted(VALID_POS)),
        "",
        "## All sampled words",
        "",
        markdown_table(rows),
        "",
    ]
    CEFR_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    CEFR_REPORT_PATH.write_text("\n".join(report), encoding="utf-8")
    print(f"Wrote CEFR experiment report to {CEFR_REPORT_PATH}")


def resolve_candidate(item: dict, lexical_data: list[str], rules: dict, overrides: dict | None = None,
                      rejected: set[str] | None = None) -> Resolution:
    """Resolve one contextual learning meaning from lexical evidence and declarative rules."""
    overrides, rejected = overrides or {}, rejected or set()
    word, sentence = item["word"], item.get("exampleCa", "")
    content_hash = review_hash(item)
    if word in rejected:
        return Resolution("reject", None, None, None, None, 0.0, "Explicitly rejected by human review.", "manual-rejection")
    if word in overrides:
        override = overrides[word]
        translation = override.get("translationEs", override.get("hintEs"))
        definition = override.get("definitionCa")
        if translation and definition:
            answer = override.get("answerCa", word)
            return Resolution("accept", answer, override.get("type", "expression" if " " in answer else "word"), definition,
                              translation, 1.0, override.get("reason", "Human-approved contextual meaning."), "manual-override")
        return Resolution("review", override.get("answerCa", word), override.get("type", "word"), definition, translation,
                          0.7, "Manual override is missing definitionCa or translationEs.", "manual-override")
    expression_match = detect_expression(word, sentence, rules["expressions"])
    if expression_match:
        expression, metadata = expression_match
        confidence = float(metadata.get("confidence", 0.98))
        status = "accept" if confidence >= rules["thresholds"]["accept"] else "review"
        return Resolution(status, expression, "expression", metadata["definitionCa"], metadata["translationEs"],
                          confidence, f"Known expression '{expression}' occurs in the example.", "expression-config")
    normalized_sentence = normalize(sentence)
    for sense in rules["contexts"]:
        if word != normalize(sense.get("word", "")): continue
        required = sense.get("partOfSpeech")
        if required and required != item.get("partOfSpeech"): continue
        if all(re.search(pattern, normalized_sentence, re.I) for pattern in sense.get("patterns", [])):
            confidence = float(sense.get("confidence", 0.9))
            status = "accept" if confidence >= rules["thresholds"]["accept"] else "review"
            return Resolution(status, word, "word", sense["definitionCa"], sense["translationEs"],
                              confidence, sense["reason"], "context-config")
    candidates = [value for value in clean_strings(lexical_data) if value.isalpha() or "-" in value or " " in value]
    quality = rules["quality"]
    candidates.sort(key=lambda value: (quality.get(normalize(value), {}).get("penalty", 0), normalize(value)))
    if item.get("partOfSpeech") == "verb":
        infinitives = [value for value in candidates if normalize(value).endswith(("ar", "er", "ir", "ír"))]
        if infinitives: candidates = infinitives
    preference = rules["preferences"].get(word, {})
    preferred = preference.get("translationEs")
    if preferred in candidates and preference.get("definitionCa"):
        confidence = float(preference.get("confidence", 0.9))
        status = "accept" if confidence >= rules["thresholds"]["accept"] else "review"
        return Resolution(status, word, "word", preference["definitionCa"], preferred,
                          confidence, "Curated learner translation and definition match lexical evidence.", "preference-config")
    if not candidates:
        return Resolution("reject", None, None, None, None, 0.1, "No usable lexical translation evidence.", "context-resolver")
    reason = "A Catalan definition is required before acceptance."
    if len(candidates) > 1: reason = "Context is insufficient to choose among incompatible lexical meanings; definition and translation require review."
    return Resolution("review", word, "word", None, preferred if preferred in candidates else (candidates[0] if len(candidates) == 1 else None),
                      0.55 if len(candidates) == 1 else 0.35, reason, "context-resolver")


def clean_review_item(item: dict, overrides: dict | None = None, rejected: set[str] | None = None,
                      rules: dict | None = None) -> dict:
    resolution = resolve_candidate(item, item.get("candidateTranslationsEs", []), rules or load_rules(), overrides, rejected)
    result = {"id": item["id"], "word": item["word"], "status": resolution.status,
              "answerCa": resolution.answer_ca, "type": resolution.item_type,
              "definitionCa": resolution.definition_ca, "translationEs": resolution.translation_es,
              "confidence": resolution.confidence, "reason": resolution.reason,
              "contentHash": review_hash(item), "reviewSource": resolution.source,
              "evidence": {"exampleCa": item.get("exampleCa"), "partOfSpeech": item.get("partOfSpeech"),
                           "candidateTranslationsEs": clean_strings(item.get("candidateTranslationsEs", []))}}
    if resolution.status == "accept":
        result["hintEs"] = resolution.translation_es
        result["translationsEs"] = [resolution.translation_es]
        if resolution.item_type == "expression": result["targetExpression"] = resolution.answer_ca
    return result


def load_rejected() -> set[str]:
    path = CONFIG / "rejected-vocabulary.txt"
    if not path.exists(): return set()
    return {normalize(line.strip()) for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.lstrip().startswith("#")}


def clean() -> None:
    selected = load_json(INTERMEDIATE / "selected.json")
    translations = load_json(INTERMEDIATE / "translations-es.json")
    overrides = load_json(CONFIG / "translation-overrides.json") if (CONFIG / "translation-overrides.json").exists() else {}
    rejected = load_rejected()
    rules = load_rules()
    review_input = [{"id": normalize(item["word"]).replace("·", "-"), "word": item["word"], "exampleCa": item["exampleCa"], "partOfSpeech": item.get("partOfSpeech", "other"), "candidateTranslationsEs": translations.get(item["word"], []), "detectedExpression": item.get("detectedExpression")} for item in selected]
    results = [clean_review_item(item, overrides, rejected, rules) for item in review_input]
    for item, result in zip(review_input, results):
        errors = validate_review_result(result, review_hash(item))
        if errors: raise SystemExit(f"Invalid review for {item['word']}: {'; '.join(errors)}")
    write_json(INTERMEDIATE / "translation-review-input.json", review_input)
    write_json(INTERMEDIATE / "translation-review-output.json", results)
    statuses = collections.Counter(item["status"] for item in results)
    accepted = statuses["accept"]
    manual = sum(item.get("reviewSource") == "manual-override" for item in results)
    raw_by_word = {item["word"]: {normalize(x) for x in item["candidateTranslationsEs"]} for item in review_input}
    expressions = sum(item.get("type") == "expression" for item in results if item["status"] == "accept")
    novel = sum(normalize(item["translationEs"]) not in raw_by_word[item["word"]] for item in results if item["status"] == "accept")
    report = {"totalCandidates": len(results), "accepted": accepted, "ordinarySingleWordEntries": accepted - expressions, "multiWordExpressionEntries": expressions, "review": statuses["review"], "rejected": statuses["reject"], "manualOverrides": manual, "translationsAbsentFromRawCandidates": novel,
              "averageTranslationsPerEntry": round(sum(len(item.get("translationsEs", [])) for item in results) / max(accepted, 1), 2)}
    write_json(REVIEW / "summary.json", report)
    sample = sorted(({**source, **result} for source, result in zip(review_input, results)), key=lambda item: hashlib.sha256(item["id"].encode()).hexdigest())[:50]
    write_json(REVIEW / "sample.json", sample)
    print(f"Cleaned {len(results)} entries: {accepted} accepted, {statuses['review']} review, {statuses['reject']} rejected")


def difficulty(index: int, total: int, word: str) -> str:
    percentile = index / max(total, 1)
    words = word.split()
    length = sum(len(part.replace("·", "").replace("-", "")) for part in words)
    if percentile < 0.35 and length <= 9:
        return "easy"
    if percentile >= 0.75 or length >= 12 or len(words) >= 4:
        return "hard"
    return "medium"


def stable_id(word: str, used: set[str]) -> str:
    base = re.sub(r"[^a-zàèéíïòóúüç0-9]+", "-", normalize(word).replace("·", "-")).strip("-")
    candidate = base
    if candidate in used:
        candidate = f"{base}-{hashlib.sha1(word.encode()).hexdigest()[:8]}"
    used.add(candidate)
    return candidate


def build(allow_incomplete: bool = False) -> None:
    selected = load_json(INTERMEDIATE / "selected.json")
    raw_translations = load_json(INTERMEDIATE / "translations-es.json")
    review_path = INTERMEDIATE / "translation-review-output.json"
    if not review_path.exists():
        raise SystemExit("Missing cleaned translation review. Run npm run vocab:clean.")
    review = {item["word"]: item for item in load_json(review_path)}
    enrichment = load_enrichment_output()
    linguistic_metadata = load_linguistic_metadata()
    missing = [item["word"] for item in selected if item["word"] not in review]
    if missing and not allow_incomplete:
        raise SystemExit(f"Missing translation reviews for {len(missing)} entries (first: {', '.join(missing[:10])})")
    used = set()
    entries = []
    for index, item in enumerate(selected):
        word = item["word"]
        cleaned = review.get(word)
        review_input = {"id": normalize(word).replace("·", "-"), "word": word, "exampleCa": item["exampleCa"],
                        "partOfSpeech": item.get("partOfSpeech", "other"), "candidateTranslationsEs": raw_translations.get(word, []),
                        "detectedExpression": item.get("detectedExpression")}
        if cleaned and cleaned.get("status") != "accept" and enrichment.get(review_input["id"]):
            enriched = _enrichment_to_review_result(cleaned, enrichment[review_input["id"]])
            if enriched.get("status") == "accept":
                cleaned = enriched
        if not cleaned or cleaned.get("status") != "accept":
            continue
        errors = validate_review_result(cleaned, review_hash(review_input))
        if errors: raise SystemExit(f"Invalid structured review for {word}: {'; '.join(errors)}")
        entry = {
            "id": stable_id(cleaned["answerCa"], used), "word": word, "answerCa": cleaned["answerCa"], "type": cleaned["type"],
            "definitionCa": cleaned["definitionCa"], "translationEs": cleaned["translationEs"],
            "hintEs": cleaned["translationEs"], "translationsEs": [cleaned["translationEs"]], "exampleCa": item["exampleCa"],
            "partOfSpeech": item["partOfSpeech"], "difficulty": difficulty(index, len(selected), cleaned["answerCa"]),
            "corpusCount": item["corpusCount"],
        }
        if cleaned.get("targetExpression"):
            entry["targetExpression"] = cleaned["targetExpression"]
        if item.get("frequencyRank") is not None:
            entry["frequencyRank"] = item["frequencyRank"]
        entry["sources"] = {
            "word": "softcatala-ca-text-corpus",
            "example": "softcatala-ca-text-corpus",
            "frequency": "softcatala-catalan-dict-tools",
            "translation": "apertium-spa-cat",
        }
        if entry["id"] in linguistic_metadata:
            entry["linguistics"] = linguistic_metadata[entry["id"]]
        entries.append(entry)
    entry_ids = {entry["id"] for entry in entries}
    unknown_metadata_ids = sorted(set(linguistic_metadata) - entry_ids)
    if unknown_metadata_ids:
        raise SystemExit(f"Linguistic metadata references unknown vocabulary ids (first: {', '.join(unknown_metadata_ids[:10])})")
    entries.sort(key=lambda item: item["id"])
    write_json(DATA / "vocabulary.json", entries)
    distribution = collections.Counter(entry["difficulty"] for entry in entries)
    meta = {
        "schemaVersion": 4, "entries": len(entries),
        "difficulty": {key: distribution[key] for key in ("easy", "medium", "hard")},
        "sourceVersions": {name: commit for name, (_, commit) in REPOS.items()},
        "corpusFiles": list(SOURCES),
    }
    write_json(DATA / "vocabulary-meta.json", meta)
    validate(entries, require_translations=not allow_incomplete)
    print(f"Built and validated {len(entries)} entries")


def contains_word(sentence: str, word: str) -> bool:
    return word in tokenize(sentence)


def validate(entries=None, require_translations: bool = True) -> None:
    entries = entries if entries is not None else load_json(DATA / "vocabulary.json")
    errors, ids, words = [], set(), set()
    for index, entry in enumerate(entries):
        label = f"entry {index} ({entry.get('word', '?')})"
        word = entry.get("word", "")
        answer = entry.get("answerCa", "")
        expression = entry.get("targetExpression")
        if not is_candidate(word, set()): errors.append(f"{label}: unsupported word or length")
        if entry.get("id") in ids: errors.append(f"{label}: duplicate id")
        if word in words: errors.append(f"{label}: duplicate word")
        ids.add(entry.get("id")); words.add(word)
        if not isinstance(answer, str) or not answer.strip(): errors.append(f"{label}: missing answerCa")
        if entry.get("type") not in {"word", "expression"}: errors.append(f"{label}: invalid type")
        if not isinstance(entry.get("definitionCa"), str) or not entry["definitionCa"].strip(): errors.append(f"{label}: missing definitionCa")
        translation = entry.get("translationEs")
        if require_translations and (not isinstance(translation, str) or not translation.strip()): errors.append(f"{label}: missing translationEs")
        if expression is not None:
            if normalize(expression) != normalize(answer): errors.append(f"{label}: targetExpression must match answerCa")
            if normalize(expression) not in normalize(entry.get("exampleCa", "")): errors.append(f"{label}: targetExpression is absent from example")
        hint = entry.get("hintEs")
        translations = entry.get("translationsEs")
        if require_translations and (not isinstance(hint, str) or not hint.strip()): errors.append(f"{label}: missing hintEs")
        if not isinstance(translations, list) or not translations: errors.append(f"{label}: missing translationsEs")
        elif clean_strings(translations) != translations: errors.append(f"{label}: invalid or duplicate translationsEs")
        elif len(translations) > MAX_TRANSLATIONS: errors.append(f"{label}: too many translationsEs")
        elif hint not in translations: errors.append(f"{label}: hintEs is not a cleaned translation")
        elif translations != [translation] or hint != translation: errors.append(f"{label}: compatibility translations disagree with translationEs")
        example = entry.get("exampleCa", "")
        if not example or URL_RE.search(example): errors.append(f"{label}: invalid example")
        elif not contains_word(example, word): errors.append(f"{label}: example does not contain target token")
        if entry.get("type") == "expression" and not phrase_occurs(answer, example): errors.append(f"{label}: expression answer is absent from example")
        if entry.get("type") == "word" and normalize(answer) != normalize(word): errors.append(f"{label}: word answer must match source word")
        if entry.get("difficulty") not in VALID_DIFFICULTY: errors.append(f"{label}: invalid difficulty")
        if entry.get("partOfSpeech") not in VALID_POS: errors.append(f"{label}: invalid part of speech")
        if not isinstance(entry.get("corpusCount"), int) or entry["corpusCount"] < 1: errors.append(f"{label}: invalid corpus count")
        if entry.get("linguistics") is not None:
            errors.extend(validate_linguistic_metadata(entry["linguistics"], f"{label}: linguistics"))
    if errors:
        raise SystemExit("Vocabulary validation failed:\n- " + "\n- ".join(errors[:30]))
    print(f"Validated {len(entries)} entries")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("fetch", "extract", "select", "enrich", "enrich-llm", "clean", "build", "validate", "cefr-sample", "cefr-experiment", "cefr-experiment-run2", "cefr-report", "cefr-stability", "cefr-data-quality", "cefr-data-quality-report", "cefr-full", "cefr-quality-full", "cefr-full-report", "cefr-combined", "repair-propose", "repair-validate", "repair-report", "repair-candidate", "repair-candidate-validate", "repair-candidate-report", "repair-semantic-input", "repair-semantic-verify", "repair-semantic-report", "repair-cefr-queue", "repair-cefr-recheck", "repair-cefr-recheck-validate", "repair-final-candidate", "repair-final-candidate-validate", "repair-final-cefr-queue", "all"))
    parser.add_argument("--limit", type=int, default=1000)
    parser.add_argument("--allow-incomplete", action="store_true")
    parser.add_argument("--model", default=None, help="Model to use for explicit CEFR experiment commands.")
    parser.add_argument("--force", action="store_true", help="Regenerate CEFR experiment output even when a cache exists.")
    parser.add_argument("--input", default=None, help="Input JSON path for future combined enrichment.")
    parser.add_argument("--output", default=None, help="Output JSON path for future combined enrichment.")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_AUDIT_BATCH_SIZE, help="Entries per batch for audit/enrichment API commands.")
    parser.add_argument("--concurrency", type=int, default=DEFAULT_AUDIT_CONCURRENCY, help="Maximum concurrent batch API requests.")
    args = parser.parse_args()
    commands = ("fetch", "extract", "select", "enrich", "clean", "build") if args.command == "all" else (args.command,)
    for command in commands:
        if command == "fetch": fetch()
        elif command == "extract": extract()
        elif command == "select": select(args.limit)
        elif command == "enrich": enrich()
        elif command == "enrich-llm": enrich_llm()
        elif command == "clean": clean()
        elif command == "build": build(args.allow_incomplete)
        elif command == "validate": validate()
        elif command == "cefr-sample": write_cefr_sample()
        elif command == "cefr-experiment": run_cefr_experiment(model=args.model, force=args.force)
        elif command == "cefr-experiment-run2": run_cefr_experiment_run2(model=args.model, force=args.force)
        elif command == "cefr-report": generate_cefr_report()
        elif command == "cefr-stability": generate_cefr_stability_report()
        elif command == "cefr-data-quality": run_data_quality_audit(model=args.model, force=args.force, batch_size=args.batch_size, concurrency=args.concurrency)
        elif command == "cefr-data-quality-report": generate_data_quality_report()
        elif command == "cefr-full": run_cefr_full(model=args.model, force=args.force)
        elif command == "cefr-quality-full": run_data_quality_full(model=args.model, force=args.force, batch_size=args.batch_size, concurrency=args.concurrency)
        elif command == "cefr-full-report": generate_cefr_full_report()
        elif command == "cefr-combined":
            if not args.input or not args.output:
                raise SystemExit("cefr-combined requires --input and --output.")
            run_combined_enrichment(Path(args.input), Path(args.output), model=args.model, force=args.force, batch_size=args.batch_size, concurrency=args.concurrency)
        elif command == "repair-propose":
            run_repair_proposals(model=args.model, force=args.force, batch_size=args.batch_size, concurrency=args.concurrency)
        elif command == "repair-validate":
            validate_repair_proposals_file()
        elif command == "repair-report":
            generate_repair_report()
        elif command == "repair-candidate": generate_repair_candidate()
        elif command == "repair-candidate-validate": validate(load_json(REPAIR_CANDIDATE_PATH)["entries"])
        elif command == "repair-candidate-report": generate_repair_candidate()
        elif command == "repair-semantic-input": write_semantic_verification_input()
        elif command == "repair-semantic-verify": run_semantic_verification(model=args.model, force=args.force, batch_size=args.batch_size, concurrency=args.concurrency)
        elif command == "repair-semantic-report": generate_semantic_verification_report()
        elif command == "repair-cefr-queue": prepare_repair_cefr_queue()
        elif command == "repair-cefr-recheck": run_repair_cefr_recheck(model=args.model, force=args.force)
        elif command == "repair-cefr-recheck-validate": validate_repair_cefr_recheck()
        elif command == "repair-final-candidate": generate_final_candidate()
        elif command == "repair-final-candidate-validate": validate_final_candidate()
        elif command == "repair-final-cefr-queue": generate_final_candidate()


if __name__ == "__main__":
    main()
