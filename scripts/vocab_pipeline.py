#!/usr/bin/env python3
"""Deterministic Catalan vocabulary pipeline (standard library only)."""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
import xml.etree.ElementTree as ET
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
MAX_TRANSLATIONS = 3

# Clearly unsuitable everyday learning hints. This is deliberately conservative:
# ambiguous senses are handled by contextual rules, overrides, or rejection.
POOR_SPANISH = {
    "abogador", "abarrajar", "amigacho", "asueto", "asaz", "bajel", "bajío",
    "bastantemente", "cabalmente", "catadura", "chirona", "compaña", "concomitar",
    "consabido", "cuasi", "dechado", "derredor", "donosidad", "fémina", "fulcral",
    "gollete", "grao", "hacerlasveces", "lecha", "lechaza", "llevanza", "maese",
    "mensura", "necesariedad", "odds", "obscuridad", "obscuro", "pitorrear",
    "polizonte", "postreramente", "postrimero", "prez", "securización", "suso",
    "universitat", "victimar",
}
PREFERRED_HINTS = {
    "anar": "ir", "arribar": "llegar", "dona": "mujer", "feina": "trabajo",
    "festa": "fiesta", "fora": "fuera", "llit": "cama", "mena": "tipo",
    "presó": "prisión", "prou": "suficientemente",
    "tornar": "volver", "vaixell": "barco", "vermell": "rojo",
}


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
    payload = {key: item.get(key) for key in ("id", "word", "exampleCa", "partOfSpeech", "candidateTranslationsEs")}
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
    if status not in {"accept", "reject"}:
        errors.append("status must be accept or reject")
    if expected_hash is not None and result.get("contentHash") != expected_hash:
        errors.append("contentHash does not match review input")
    if status == "accept":
        hint = result.get("hintEs")
        translations = result.get("translationsEs")
        if not isinstance(hint, str) or not hint.strip(): errors.append("accepted result needs one hintEs string")
        if clean_strings(translations) != translations: errors.append("translationsEs must contain unique, non-empty strings")
        if not isinstance(translations, list) or not translations: errors.append("accepted result needs translationsEs")
        elif len(translations) > MAX_TRANSLATIONS: errors.append(f"translationsEs exceeds {MAX_TRANSLATIONS} items")
        elif hint not in translations: errors.append("hintEs must be the first-class cleaned meaning")
    elif not isinstance(result.get("reason"), str) or not result["reason"].strip():
        errors.append("rejected result needs a reason")
    return errors


def clean_review_item(item: dict, overrides: dict | None = None, rejected: set[str] | None = None) -> dict:
    """Produce a narrow, structured pedagogical review from lexical candidates."""
    overrides, rejected = overrides or {}, rejected or set()
    word, candidates = item["word"], clean_strings(item.get("candidateTranslationsEs", []))
    content_hash = review_hash(item)
    if word in rejected:
        return {"id": item["id"], "word": word, "status": "reject", "reason": "Explicitly rejected by human review.", "contentHash": content_hash, "reviewSource": "manual-rejection"}
    if word in overrides:
        override = overrides[word]
        translations = clean_strings(override.get("translationsEs", []))
        hint = override.get("hintEs", "")
        if hint and hint not in translations: translations.insert(0, hint)
        result = {"id": item["id"], "word": word, "status": "accept", "hintEs": hint, "translationsEs": translations[:MAX_TRANSLATIONS], "reason": override.get("reason", "Human-approved pedagogical override."), "contentHash": content_hash, "reviewSource": "manual-override"}
        errors = validate_review_result(result, content_hash)
        if errors: raise ValueError(f"Invalid override for {word}: {'; '.join(errors)}")
        return result
    usable = [value for value in candidates if normalize(value) not in POOR_SPANISH]
    usable = [value for value in usable if value.isalpha() or "-" in value or " " in value]
    # Infinitives are the only safe standalone clue form for verbs.
    if item.get("partOfSpeech") == "verb":
        infinitives = [value for value in usable if normalize(value).endswith(("ar", "er", "ir", "ír"))]
        if infinitives: usable = infinitives
    preferred = PREFERRED_HINTS.get(word)
    # "mena de" is a contextual kind/class construction; other uses are not
    # forced into that sense merely because Apertium lists it.
    if word == "mena" and "mena de" in normalize(item.get("exampleCa", "")):
        usable = ["tipo", "clase"]
        preferred = "tipo"
    elif word == "mena":
        usable = []
    if preferred in usable:
        usable = [preferred] + [value for value in usable if value != preferred]
    usable = clean_strings(usable)[:MAX_TRANSLATIONS]
    if not usable:
        return {"id": item["id"], "word": word, "status": "reject", "reason": "No candidate is reliably suitable for this word class and example.", "contentHash": content_hash, "reviewSource": "rules"}
    return {"id": item["id"], "word": word, "status": "accept", "hintEs": usable[0], "translationsEs": usable, "reason": "Selected from lexical candidates using context, word class, and pedagogical filters.", "contentHash": content_hash, "reviewSource": "rules"}


def load_rejected() -> set[str]:
    path = CONFIG / "rejected-vocabulary.txt"
    if not path.exists(): return set()
    return {normalize(line.strip()) for line in path.read_text(encoding="utf-8").splitlines() if line.strip() and not line.lstrip().startswith("#")}


def clean() -> None:
    selected = load_json(INTERMEDIATE / "selected.json")
    translations = load_json(INTERMEDIATE / "translations-es.json")
    overrides = load_json(CONFIG / "translation-overrides.json") if (CONFIG / "translation-overrides.json").exists() else {}
    rejected = load_rejected()
    review_input = [{"id": normalize(item["word"]).replace("·", "-"), "word": item["word"], "exampleCa": item["exampleCa"], "partOfSpeech": item.get("partOfSpeech", "other"), "candidateTranslationsEs": translations.get(item["word"], [])} for item in selected]
    results = [clean_review_item(item, overrides, rejected) for item in review_input]
    for item, result in zip(review_input, results):
        errors = validate_review_result(result, review_hash(item))
        if errors: raise SystemExit(f"Invalid review for {item['word']}: {'; '.join(errors)}")
    write_json(INTERMEDIATE / "translation-review-input.json", review_input)
    write_json(INTERMEDIATE / "translation-review-output.json", results)
    accepted = sum(item["status"] == "accept" for item in results)
    manual = sum(item.get("reviewSource") == "manual-override" for item in results)
    report = {"totalCandidates": len(results), "accepted": accepted, "rejected": len(results) - accepted, "manualOverrides": manual,
              "averageTranslationsPerEntry": round(sum(len(item.get("translationsEs", [])) for item in results) / max(accepted, 1), 2)}
    write_json(REVIEW / "summary.json", report)
    sample = sorted(({**source, **result} for source, result in zip(review_input, results)), key=lambda item: hashlib.sha256(item["id"].encode()).hexdigest())[:50]
    write_json(REVIEW / "sample.json", sample)
    print(f"Cleaned {len(results)} entries: {accepted} accepted, {len(results) - accepted} rejected")


def difficulty(index: int, total: int, word: str) -> str:
    percentile = index / max(total, 1)
    length = len(word.replace("·", "").replace("-", ""))
    if percentile < 0.35 and length <= 9:
        return "easy"
    if percentile >= 0.75 or length >= 12:
        return "hard"
    return "medium"


def stable_id(word: str, used: set[str]) -> str:
    base = normalize(word).replace("·", "-")
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
    missing = [item["word"] for item in selected if item["word"] not in review]
    if missing and not allow_incomplete:
        raise SystemExit(f"Missing translation reviews for {len(missing)} entries (first: {', '.join(missing[:10])})")
    used = set()
    entries = []
    for index, item in enumerate(selected):
        word = item["word"]
        cleaned = review.get(word)
        if not cleaned or cleaned.get("status") == "reject":
            continue
        review_input = {"id": normalize(word).replace("·", "-"), "word": word, "exampleCa": item["exampleCa"],
                        "partOfSpeech": item.get("partOfSpeech", "other"), "candidateTranslationsEs": raw_translations.get(word, [])}
        errors = validate_review_result(cleaned, review_hash(review_input))
        if errors: raise SystemExit(f"Invalid structured review for {word}: {'; '.join(errors)}")
        entry = {
            "id": stable_id(word, used), "word": word,
            "hintEs": cleaned["hintEs"], "translationsEs": cleaned["translationsEs"], "exampleCa": item["exampleCa"],
            "partOfSpeech": item["partOfSpeech"], "difficulty": difficulty(index, len(selected), word),
            "corpusCount": item["corpusCount"],
        }
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
        "schemaVersion": 2, "entries": len(entries),
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
        if not is_candidate(word, set()): errors.append(f"{label}: unsupported word or length")
        if entry.get("id") in ids: errors.append(f"{label}: duplicate id")
        if word in words: errors.append(f"{label}: duplicate word")
        ids.add(entry.get("id")); words.add(word)
        hint = entry.get("hintEs")
        translations = entry.get("translationsEs")
        if require_translations and (not isinstance(hint, str) or not hint.strip()): errors.append(f"{label}: missing hintEs")
        if not isinstance(translations, list) or not translations: errors.append(f"{label}: missing translationsEs")
        elif clean_strings(translations) != translations: errors.append(f"{label}: invalid or duplicate translationsEs")
        elif len(translations) > MAX_TRANSLATIONS: errors.append(f"{label}: too many translationsEs")
        elif hint not in translations: errors.append(f"{label}: hintEs is not a cleaned translation")
        example = entry.get("exampleCa", "")
        if not example or URL_RE.search(example): errors.append(f"{label}: invalid example")
        elif not contains_word(example, word): errors.append(f"{label}: example does not contain target token")
        if entry.get("difficulty") not in VALID_DIFFICULTY: errors.append(f"{label}: invalid difficulty")
        if entry.get("partOfSpeech") not in VALID_POS: errors.append(f"{label}: invalid part of speech")
        if not isinstance(entry.get("corpusCount"), int) or entry["corpusCount"] < 1: errors.append(f"{label}: invalid corpus count")
    if errors:
        raise SystemExit("Vocabulary validation failed:\n- " + "\n- ".join(errors[:30]))
    print(f"Validated {len(entries)} entries")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("fetch", "extract", "select", "enrich", "clean", "build", "validate", "all"))
    parser.add_argument("--limit", type=int, default=1000)
    parser.add_argument("--allow-incomplete", action="store_true")
    args = parser.parse_args()
    commands = ("fetch", "extract", "select", "enrich", "clean", "build") if args.command == "all" else (args.command,)
    for command in commands:
        if command == "fetch": fetch()
        elif command == "extract": extract()
        elif command == "select": select(args.limit)
        elif command == "enrich": enrich()
        elif command == "clean": clean()
        elif command == "build": build(args.allow_incomplete)
        elif command == "validate": validate()


if __name__ == "__main__":
    main()
