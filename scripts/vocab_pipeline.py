#!/usr/bin/env python3
"""Deterministic Catalan vocabulary pipeline (standard library only)."""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from typing import Literal, Protocol
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw"
INTERMEDIATE = DATA / "intermediate"
CONFIG = DATA / "config"
REVIEW = DATA / "review"
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
POS_PRIORITY = {"noun": 0, "verb": 1, "adjective": 2, "adverb": 3, "other": 4}
MAX_TRANSLATIONS = 1
LLM_MODEL_DEFAULT = "gpt-5.4-mini"


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


class MeaningEnrichmentProvider(Protocol):
    def enrich(self, item: EnrichmentInput) -> EnrichmentResult: ...

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
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


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
        entries.append(entry)
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
    if errors:
        raise SystemExit("Vocabulary validation failed:\n- " + "\n- ".join(errors[:30]))
    print(f"Validated {len(entries)} entries")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("fetch", "extract", "select", "enrich", "enrich-llm", "clean", "build", "validate", "all"))
    parser.add_argument("--limit", type=int, default=1000)
    parser.add_argument("--allow-incomplete", action="store_true")
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


if __name__ == "__main__":
    main()
