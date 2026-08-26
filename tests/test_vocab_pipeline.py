import json
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import vocab_pipeline as pipeline


class VocabularyPipelineTests(unittest.TestCase):
    def test_semantic_verification_set_is_exact_and_deduplicated(self):
        # Phase 6 artifacts are historical fixtures; their proposals describe the
        # pre-v1 production snapshot, so this test isolates set construction from
        # the mutable canonical vocabulary's proposal-file compatibility check.
        with patch.object(pipeline, "validate_repair_proposals_file"):
            entries = pipeline.semantic_verification_entries()
        ids = [item["id"] for item in entries]
        # The promoted Vocabulary v1 is already the repaired baseline; only
        # the 16 entries still represented by the historical candidate differ.
        self.assertEqual(len(ids), 16)
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue({"català", "espanyol", "funció", "ningú", "personal", "una-mica"}.issubset(ids))
        self.assertTrue({"matèria", "precisament", "sola", "sopar", "dues"}.issubset(ids))
        proposals = json.loads((pipeline.REPAIR_PROPOSALS_PATH).read_text(encoding="utf-8"))["results"]
        example_only = {p["id"] for p in proposals if [k for k,v in p["changes"].items() if v is not None] == ["exampleCa"]}
        self.assertTrue(example_only)
        self.assertTrue(example_only.isdisjoint(ids))

    def test_semantic_schema_and_validation(self):
        schema = pipeline.semantic_verification_schema()["schema"]["properties"]["results"]["items"]
        self.assertEqual(set(schema["properties"]), set(schema["required"]))
        valid = {"id":"sola", "decision":"reject", "reason":"The example uses a noun sense.", "issueTags":[{"tag":"sense-mismatch","severity":"high"}], "splitAssessment":"not-needed", "splitReason":"One representative sense is enough."}
        self.assertEqual(pipeline.validate_semantic_verification_result(valid, "sola"), [])
        self.assertTrue(pipeline.validate_semantic_verification_result({**valid, "decision":"bad"}, "sola"))

    def test_invalid_cached_semantic_results_are_not_reused(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "out.json"
            with patch.object(pipeline, "validate_repair_proposals_file"):
                entries = pipeline.semantic_verification_entries()[:1]
            path.write_text(json.dumps({"metadata":{"inputHash":pipeline.content_hash(entries),"promptVersion":pipeline.SEMANTIC_VERIFICATION_PROMPT_VERSION,"model":"test"},"results":[{"id":entries[0]["id"],"decision":"bad"}]}), encoding="utf-8")
            self.assertEqual(pipeline.load_completed_results(path, entries, {"inputHash":pipeline.content_hash(entries),"promptVersion":pipeline.SEMANTIC_VERIFICATION_PROMPT_VERSION,"model":"test"}, pipeline.validate_semantic_verification_result), {})
    def test_repair_schema_requires_every_change_property_and_supports_null(self):
        schema = pipeline.repair_proposal_schema()["schema"]
        changes = schema["properties"]["results"]["items"]["properties"]["changes"]
        self.assertEqual(set(changes["properties"]), set(changes["required"]))
        self.assertEqual(changes["properties"]["partOfSpeech"]["type"], ["string", "null"])
        self.assertIn(None, changes["properties"]["partOfSpeech"]["enum"])

    def test_repair_proposal_accepts_nullable_no_change_pos(self):
        proposal = {"id": "casa", "status": "no-change",
                    "changes": {"partOfSpeech": None, "definitionCa": None,
                                 "translationEs": None, "exampleCa": None,
                                 "type": None, "answerCa": None, "targetExpression": None},
                    "notes": ["No repair needed."], "requiresManualDecision": False,
                    "cefrNeedsRecheck": False}
        self.assertEqual(pipeline.validate_repair_proposal(proposal, "casa"), [])

    def test_unicode_tokenization_and_apostrophe_base(self):
        self.assertEqual(
            pipeline.tokenize("Formatge, CANÇÓ, pingüí, col·legi, l'avi i m'agrada."),
            ["formatge", "cançó", "pingüí", "col·legi", "avi", "i", "agrada"],
        )

    def test_filtering(self):
        self.assertTrue(pipeline.is_candidate("cançó", set()))
        self.assertTrue(pipeline.is_candidate("col·legi", set()))
        self.assertFalse(pipeline.is_candidate("l'avi", set()))
        self.assertFalse(pipeline.is_candidate("que", set()))
        self.assertFalse(pipeline.is_candidate("canco2", set()))

    def test_example_scoring_is_deterministic(self):
        short = "M'agrada aquest formatge."
        long = "Aquest formatge apareix en una frase deliberadament massa llarga per ser un exemple senzill i clar."
        self.assertLess(pipeline.sentence_score(short, "formatge", 5), pipeline.sentence_score(long, "formatge", 5))
        self.assertEqual(pipeline.sentence_score(short, "formatge", 5), pipeline.sentence_score(short, "formatge", 5))

    def test_difficulty(self):
        self.assertEqual(pipeline.difficulty(1, 100, "casa"), "easy")
        self.assertEqual(pipeline.difficulty(50, 100, "finestra"), "medium")
        self.assertEqual(pipeline.difficulty(80, 100, "finestra"), "hard")
        self.assertEqual(pipeline.difficulty(10, 100, "extraordinària"), "hard")

    def test_validation(self):
        valid = [{"id": "canco", "word": "cançó", "answerCa": "cançó", "type": "word", "definitionCa": "Peça musical cantada.",
                  "translationEs": "canción", "hintEs": "canción", "translationsEs": ["canción"],
                  "exampleCa": "Aquesta cançó és bonica.", "partOfSpeech": "noun",
                  "difficulty": "easy", "corpusCount": 2}]
        pipeline.validate(valid)
        with self.assertRaises(SystemExit):
            pipeline.validate([{**valid[0], "definitionCa": ""}])

    def test_linguistic_metadata_validation(self):
        valid = {"cefr": "A2", "confidence": 1.0, "thematicCategory": "food-and-kitchen",
                 "partOfSpeech": "noun", "provenance": {"source": "review", "version": "2026-08-26", "method": "manual"}}
        self.assertEqual(pipeline.validate_linguistic_metadata(valid), [])
        self.assertEqual(pipeline.validate_linguistic_metadata({"confidence": 0.0}), [])
        self.assertIn("linguistics: invalid cefr", pipeline.validate_linguistic_metadata({"cefr": "B7"}))
        self.assertIn("linguistics: confidence must be between 0 and 1", pipeline.validate_linguistic_metadata({"confidence": -0.1}))
        self.assertIn("linguistics: confidence must be between 0 and 1", pipeline.validate_linguistic_metadata({"confidence": 1.1}))
        self.assertIn("linguistics: confidence must be between 0 and 1", pipeline.validate_linguistic_metadata({"confidence": float("nan")}))
        self.assertIn("linguistics: thematicCategory must be a non-empty string", pipeline.validate_linguistic_metadata({"thematicCategory": "  "}))
        self.assertIn("linguistics: invalid partOfSpeech", pipeline.validate_linguistic_metadata({"partOfSpeech": "article"}))
        self.assertIn("linguistics: provenance.source must be a non-empty string", pipeline.validate_linguistic_metadata({"provenance": {"source": ""}}))
        self.assertIn("linguistics: provenance.version must be a string", pipeline.validate_linguistic_metadata({"provenance": {"source": "review", "version": 1}}))

    def test_production_validation_accepts_optional_linguistics(self):
        valid = [{"id": "canco", "word": "cançó", "answerCa": "cançó", "type": "word", "definitionCa": "Peça musical cantada.",
                  "translationEs": "canción", "hintEs": "canción", "translationsEs": ["canción"],
                  "exampleCa": "Aquesta cançó és bonica.", "partOfSpeech": "noun",
                  "difficulty": "easy", "corpusCount": 2,
                  "linguistics": {"cefr": "A2", "confidence": 0.85, "provenance": {"source": "review"}}}]
        pipeline.validate(valid)
        with self.assertRaises(SystemExit):
            pipeline.validate([{**valid[0], "linguistics": {"cefr": "Z1"}}])

    def test_reviewed_linguistic_metadata_artifact_is_keyed_by_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "linguistic-metadata.json"
            path.write_text(json.dumps({"canco": {"cefr": "A2", "confidence": 0.8, "provenance": {"source": "review"}}}), encoding="utf-8")
            with patch.object(pipeline, "LINGUISTIC_METADATA", path):
                self.assertEqual(pipeline.load_linguistic_metadata()["canco"]["cefr"], "A2")
            path.write_text(json.dumps({"canco": {"confidence": 2}}), encoding="utf-8")
            with patch.object(pipeline, "LINGUISTIC_METADATA", path), self.assertRaises(SystemExit):
                pipeline.load_linguistic_metadata()

    def test_cefr_sample_is_deterministic_and_balanced(self):
        entries = json.loads((pipeline.DATA / "vocabulary.json").read_text(encoding="utf-8"))
        first = pipeline.select_cefr_sample(entries)
        second = pipeline.select_cefr_sample(entries)
        self.assertEqual(first, second)
        self.assertEqual(len(first), 60)
        self.assertEqual({item["difficulty"] for item in first}, {"easy", "medium", "hard"})
        counts = {difficulty: sum(item["difficulty"] == difficulty for item in first) for difficulty in {"easy", "medium", "hard"}}
        self.assertEqual(counts, {"easy": 20, "medium": 20, "hard": 20})
        self.assertTrue(all("selectionReasons" in item for item in first))
        self.assertGreaterEqual(sum("possible-length-distortion" in item["selectionReasons"] for item in first), 1)

    def test_cefr_model_payload_omits_existing_difficulty(self):
        sample = pipeline.select_cefr_sample(json.loads((pipeline.DATA / "vocabulary.json").read_text(encoding="utf-8")))
        payload = pipeline.cefr_model_payload(sample[0])
        self.assertNotIn("difficulty", payload)
        self.assertNotIn("selectionReasons", payload)
        self.assertIn("frequencyRank", payload)

    def test_cefr_model_payload_classifies_expression_answer_not_source_word(self):
        item = {
            "id": "de-tant-en-tant",
            "word": "tant",
            "answerCa": "de tant en tant",
            "type": "expression",
            "definitionCa": "Expressió que indica que una cosa passa ocasionalment.",
            "translationEs": "de vez en cuando",
            "exampleCa": "De tant en tant anem al teatre.",
            "partOfSpeech": "adverb",
            "frequencyRank": 212,
            "difficulty": "hard",
            "selectionReasons": ["difficulty:hard", "expression"],
        }
        payload = pipeline.cefr_model_payload(item)
        self.assertEqual(payload["classificationTarget"], "de tant en tant")
        self.assertEqual(payload["answerCa"], "de tant en tant")
        self.assertEqual(payload["type"], "expression")
        self.assertEqual(payload["sourceWord"], "tant")
        self.assertNotIn("difficulty", payload)
        self.assertNotIn("selectionReasons", payload)

    def test_cefr_model_payload_infers_expression_type_for_existing_sample(self):
        sample = pipeline.select_cefr_sample(json.loads((pipeline.DATA / "vocabulary.json").read_text(encoding="utf-8")))
        expression = next(item for item in sample if item["id"] == "de-tant-en-tant")
        payload = pipeline.cefr_model_payload(expression)
        self.assertEqual(payload["classificationTarget"], "de tant en tant")
        self.assertEqual(payload["type"], "expression")
        self.assertEqual(payload["sourceWord"], "tant")

    def test_cefr_classification_validation(self):
        valid = {"id": "canco", "cefr": "A2", "confidence": 0.75, "thematicCategory": "music",
                 "partOfSpeech": "noun", "reason": "Common concrete learner vocabulary."}
        self.assertEqual(pipeline.validate_cefr_classification(valid, "canco"), [])
        self.assertIn("id does not match sample entry", pipeline.validate_cefr_classification(valid, "altre"))
        self.assertIn("invalid cefr", pipeline.validate_cefr_classification({**valid, "cefr": "Z1"}, "canco"))
        self.assertIn("confidence must be between 0 and 1", pipeline.validate_cefr_classification({**valid, "confidence": 1.5}, "canco"))
        self.assertIn("invalid partOfSpeech", pipeline.validate_cefr_classification({**valid, "partOfSpeech": "article"}, "canco"))

    def test_cefr_experiment_uses_cache_and_fake_provider_without_api(self):
        class FakeProvider:
            def classify(self, item):
                return pipeline.CefrClassification(
                    id=item["id"],
                    cefr="A2",
                    confidence=0.8,
                    thematic_category="test-category",
                    part_of_speech=item.get("partOfSpeech", "other"),
                    reason="Synthetic test classification.",
                )

        with tempfile.TemporaryDirectory() as tmp:
            sample_path = Path(tmp) / "sample.json"
            output_path = Path(tmp) / "output.json"
            report_path = Path(tmp) / "report.md"
            sample = pipeline.select_cefr_sample(json.loads((pipeline.DATA / "vocabulary.json").read_text(encoding="utf-8")))
            sample_path.write_text(json.dumps(sample, ensure_ascii=False), encoding="utf-8")
            with patch.object(pipeline, "CEFR_SAMPLE_PATH", sample_path), patch.object(pipeline, "CEFR_OUTPUT_PATH", output_path), patch.object(pipeline, "CEFR_REPORT_PATH", report_path):
                pipeline.run_cefr_experiment(model="test-model", provider=FakeProvider(), verbose=False, output_path=output_path)
                output = json.loads(output_path.read_text(encoding="utf-8"))
                self.assertEqual(output["metadata"]["model"], "test-model")
                self.assertEqual(len(output["results"]), 60)
                pipeline.run_cefr_experiment(model="test-model", provider=FakeProvider(), verbose=False, output_path=output_path)
                pipeline.generate_cefr_report()
                self.assertIn("CEFR classification experiment", report_path.read_text(encoding="utf-8"))

    def test_cefr_run2_stability_and_consensus_are_separate(self):
        class Run1Provider:
            def classify(self, item):
                return pipeline.CefrClassification(item["id"], "A2", 0.9, "test", item.get("partOfSpeech", "other"), "Run 1")

        class Run2Provider:
            def classify(self, item):
                level = "B1" if item["id"] == "estat" else "A2"
                return pipeline.CefrClassification(item["id"], level, 0.85, "test", item.get("partOfSpeech", "other"), "Run 2")

        with tempfile.TemporaryDirectory() as tmp:
            sample = pipeline.select_cefr_sample(json.loads((pipeline.DATA / "vocabulary.json").read_text(encoding="utf-8")))
            sample_path = Path(tmp) / "sample.json"
            run1_path = Path(tmp) / "run1.json"
            run2_path = Path(tmp) / "run2.json"
            consensus_path = Path(tmp) / "consensus.json"
            stability_path = Path(tmp) / "stability.md"
            sample_path.write_text(json.dumps(sample, ensure_ascii=False), encoding="utf-8")
            with patch.object(pipeline, "CEFR_SAMPLE_PATH", sample_path), patch.object(pipeline, "CEFR_OUTPUT_PATH", run1_path), patch.object(pipeline, "CEFR_OUTPUT_RUN2_PATH", run2_path), patch.object(pipeline, "CEFR_CONSENSUS_PATH", consensus_path), patch.object(pipeline, "CEFR_STABILITY_REPORT_PATH", stability_path):
                pipeline.run_cefr_experiment(model="test-model", provider=Run1Provider(), verbose=False, output_path=run1_path)
                pipeline.run_cefr_experiment_run2(model="test-model", provider=Run2Provider(), verbose=False)
                self.assertTrue(run1_path.exists())
                self.assertTrue(run2_path.exists())
                self.assertNotEqual(run1_path.read_text(encoding="utf-8"), run2_path.read_text(encoding="utf-8"))
                pipeline.generate_cefr_stability_report()
                consensus = json.loads(consensus_path.read_text(encoding="utf-8"))
                self.assertEqual(next(item for item in consensus if item["id"] == "estat")["status"], "review-adjacent")
                self.assertIn("Recommendation for Full Dataset Classification", stability_path.read_text(encoding="utf-8"))

    def test_data_quality_audit_and_report_use_fake_provider_without_api(self):
        class FakeAuditProvider:
            def audit_batch(self, items):
                return [{"id": item["id"], "status": "review", "issues": [{"type": "possible-polysemy", "severity": "medium", "explanation": "Synthetic possible sense ambiguity."}]}
                        if item["id"] == "estat" else {"id": item["id"], "status": "ok", "issues": []} for item in items]

        with tempfile.TemporaryDirectory() as tmp:
            sample = pipeline.select_cefr_sample(json.loads((pipeline.DATA / "vocabulary.json").read_text(encoding="utf-8")))
            sample_path = Path(tmp) / "sample.json"
            output_path = Path(tmp) / "quality.json"
            report_path = Path(tmp) / "quality.md"
            sample_path.write_text(json.dumps(sample, ensure_ascii=False), encoding="utf-8")
            with patch.object(pipeline, "CEFR_SAMPLE_PATH", sample_path), patch.object(pipeline, "DATA_QUALITY_OUTPUT_PATH", output_path), patch.object(pipeline, "DATA_QUALITY_REPORT_PATH", report_path):
                pipeline.run_data_quality_audit(model="test-model", provider=FakeAuditProvider(), verbose=False)
                output = json.loads(output_path.read_text(encoding="utf-8"))
                self.assertEqual(len(output["results"]), 60)
                self.assertEqual(next(item for item in output["results"] if item["id"] == "estat")["status"], "review")
                pipeline.generate_data_quality_report()
                self.assertIn("CEFR sample data-quality audit", report_path.read_text(encoding="utf-8"))

    def test_full_dataset_cefr_and_quality_use_production_entries_without_api(self):
        class FakeClassifier:
            def classify(self, item):
                return pipeline.CefrClassification(item["id"], "A2", 0.95, "general", item.get("partOfSpeech", "other"), "Synthetic full classification.")

        class FakeAuditor:
            def audit_batch(self, items):
                return [{"id": item["id"], "status": "ok", "issues": []} for item in items]

        entries = pipeline.load_production_vocabulary()
        self.assertEqual(len(entries), 544)
        expression = next(entry for entry in entries if entry["id"] == "de-tant-en-tant")
        payload = pipeline.cefr_model_payload(expression)
        self.assertEqual(payload["classificationTarget"], "de tant en tant")
        self.assertEqual(payload["type"], "expression")
        self.assertNotIn("difficulty", payload)
        with tempfile.TemporaryDirectory() as tmp:
            class_path = Path(tmp) / "full-class.json"
            quality_path = Path(tmp) / "full-quality.json"
            pipeline.run_cefr_classification(entries, class_path, "test full", model="test-model", provider=FakeClassifier(), verbose=False)
            pipeline.run_data_quality_entries(entries, quality_path, "test quality", model="test-model", provider=FakeAuditor(), verbose=False)
            self.assertEqual(len(json.loads(class_path.read_text(encoding="utf-8"))["results"]), 544)
            self.assertEqual(len(json.loads(quality_path.read_text(encoding="utf-8"))["results"]), 544)
            pipeline.run_cefr_classification(entries, class_path, "test full", model="test-model", provider=FakeClassifier(), verbose=False)
            pipeline.run_data_quality_entries(entries, quality_path, "test quality", model="test-model", provider=FakeAuditor(), verbose=False)

    def test_full_review_queue_status_policy(self):
        high = {"id": "casa", "cefr": "A1", "confidence": 0.95, "thematicCategory": "home", "partOfSpeech": "noun", "reason": "test"}
        low = {**high, "confidence": 0.89}
        ok_quality = {"id": "casa", "status": "ok", "issues": []}
        bad_quality = {"id": "casa", "status": "review", "issues": [{"type": "sense-mismatch", "severity": "medium", "explanation": "test"}]}
        low_quality = {"id": "casa", "status": "review", "issues": [{"type": "other", "severity": "low", "explanation": "test"}]}
        self.assertEqual(pipeline.review_status(high, ok_quality), "auto-candidate")
        self.assertEqual(pipeline.review_status(low, ok_quality), "review-confidence")
        self.assertEqual(pipeline.review_status(high, bad_quality), "review-quality")
        self.assertEqual(pipeline.review_status(low, bad_quality), "review-both")
        self.assertEqual(pipeline.review_status(high, low_quality), "auto-candidate")

    def test_full_report_aggregation_writes_review_queue(self):
        entries = pipeline.load_production_vocabulary()
        classifications = [{"id": entry["id"], "cefr": "A2", "confidence": 0.95, "thematicCategory": "general",
                            "partOfSpeech": entry.get("partOfSpeech", "other"), "reason": "Synthetic."} for entry in entries]
        classifications[0]["confidence"] = 0.75
        quality_results = [{"id": entry["id"], "status": "ok", "issues": []} for entry in entries]
        quality_results[1] = {"id": entries[1]["id"], "status": "review", "issues": [{"type": "example-mismatch", "severity": "high", "explanation": "Synthetic."}]}
        with tempfile.TemporaryDirectory() as tmp:
            class_path = Path(tmp) / "full-class.json"
            quality_path = Path(tmp) / "full-quality.json"
            review_path = Path(tmp) / "review.json"
            report_path = Path(tmp) / "report.md"
            class_path.write_text(json.dumps({"metadata": {"model": "test"}, "results": classifications}, ensure_ascii=False), encoding="utf-8")
            quality_path.write_text(json.dumps({"metadata": {"model": "test"}, "results": quality_results}, ensure_ascii=False), encoding="utf-8")
            with patch.object(pipeline, "CEFR_FULL_OUTPUT_PATH", class_path), patch.object(pipeline, "DATA_QUALITY_FULL_OUTPUT_PATH", quality_path), patch.object(pipeline, "CEFR_FULL_REVIEW_PATH", review_path), patch.object(pipeline, "CEFR_FULL_ANALYSIS_REPORT_PATH", report_path):
                pipeline.generate_cefr_full_report()
                queue = json.loads(review_path.read_text(encoding="utf-8"))
                self.assertEqual(len(queue), 544)
                self.assertIn("review-confidence", {item["reviewStatus"] for item in queue})
                self.assertIn("review-quality", {item["reviewStatus"] for item in queue})
                self.assertIn("Full CEFR vocabulary analysis", report_path.read_text(encoding="utf-8"))

    def test_complete_full_cefr_cache_skips_provider(self):
        class FailingClassifier:
            def classify(self, item):
                raise AssertionError("CEFR provider should not be called for a complete cache")

        entries = pipeline.load_production_vocabulary()
        results = [{"id": entry["id"], "cefr": "A2", "confidence": 0.95, "thematicCategory": "general",
                    "partOfSpeech": entry.get("partOfSpeech", "other"), "reason": "Synthetic."} for entry in entries]
        with tempfile.TemporaryDirectory() as tmp:
            output_path = Path(tmp) / "full-class.json"
            output_path.write_text(json.dumps({"metadata": {"inputHash": pipeline.content_hash(entries), "sampleHash": pipeline.content_hash(entries),
                                                            "promptVersion": pipeline.CEFR_EXPERIMENT_PROMPT_VERSION, "model": "test-model"},
                                               "results": results}, ensure_ascii=False), encoding="utf-8")
            pipeline.run_cefr_classification(entries, output_path, "test full", model="test-model", provider=FailingClassifier(), verbose=False)

    def test_quality_audit_resumes_partial_cache_and_skips_valid_entries(self):
        class CountingAuditor:
            def __init__(self):
                self.seen = []

            def audit_batch(self, items):
                self.seen.extend(item["id"] for item in items)
                return [{"id": item["id"], "status": "ok", "issues": []} for item in items]

        entries = pipeline.load_production_vocabulary()[:5]
        cached = [{"id": entry["id"], "status": "ok", "issues": []} for entry in entries[:2]]
        auditor = CountingAuditor()
        with tempfile.TemporaryDirectory() as tmp:
            output_path = Path(tmp) / "quality.json"
            output_path.write_text(json.dumps({"metadata": {"inputHash": pipeline.content_hash(entries), "sampleHash": pipeline.content_hash(entries),
                                                            "promptVersion": pipeline.DATA_QUALITY_PROMPT_VERSION, "model": "test-model"},
                                               "results": cached}, ensure_ascii=False), encoding="utf-8")
            pipeline.run_data_quality_entries(entries, output_path, "test quality", model="test-model", provider=auditor, verbose=False)
            output = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(len(output["results"]), 5)
            self.assertEqual(auditor.seen, [entry["id"] for entry in entries[2:]])

    def test_quality_model_payload_is_compact_and_independent_of_cefr(self):
        entry = pipeline.load_production_vocabulary()[0]
        payload = pipeline.quality_model_payload({**entry, "difficulty": "hard", "cefr": "C2", "confidence": 1, "thematicCategory": "x"})
        self.assertEqual(set(payload), {"id", "answerCa", "word", "type", "partOfSpeech", "definitionCa", "translationEs", "exampleCa"})
        self.assertNotIn("difficulty", payload)
        self.assertNotIn("cefr", payload)
        self.assertNotIn("confidence", payload)
        self.assertNotIn("thematicCategory", payload)

    def test_compact_quality_and_combined_enrichment_validation(self):
        quality_ok = {"id": "casa", "status": "ok", "issues": []}
        classification = {"id": "casa", "cefr": "A1", "confidence": 0.95, "thematicCategory": "home", "partOfSpeech": "noun", "reason": "Basic."}
        combined = {"id": "casa", "classification": classification, "quality": quality_ok}
        self.assertEqual(pipeline.validate_data_quality_result(quality_ok, "casa"), [])
        self.assertEqual(pipeline.validate_combined_enrichment_result(combined, "casa"), [])
        review = {"id": "casa", "status": "review", "issues": [{"type": "example-mismatch", "severity": "high", "explanation": "Example does not illustrate the target."}]}
        self.assertEqual(pipeline.validate_data_quality_result(review, "casa"), [])
        self.assertIn("quality: ok result must not include issues", pipeline.validate_combined_enrichment_result({"id": "casa", "classification": classification, "quality": {**quality_ok, "issues": review["issues"]}}, "casa"))

    def test_combined_enrichment_uses_cache_and_fake_provider(self):
        class FakeCombined:
            def __init__(self):
                self.calls = 0

            def enrich_batch(self, items):
                self.calls += 1
                return [{"id": item["id"],
                         "classification": {"id": item["id"], "cefr": "A2", "confidence": 0.9, "thematicCategory": "general", "partOfSpeech": item.get("partOfSpeech", "other"), "reason": "Synthetic."},
                         "quality": {"id": item["id"], "status": "ok", "issues": []}} for item in items]

        entries = pipeline.load_production_vocabulary()[:2]
        provider = FakeCombined()
        with tempfile.TemporaryDirectory() as tmp:
            input_path = Path(tmp) / "input.json"
            output_path = Path(tmp) / "combined.json"
            input_path.write_text(json.dumps(entries, ensure_ascii=False), encoding="utf-8")
            pipeline.run_combined_enrichment(input_path, output_path, model="test-model", provider=provider, verbose=False)
            pipeline.run_combined_enrichment(input_path, output_path, model="test-model", provider=provider, verbose=False)
            self.assertEqual(provider.calls, 1)
            self.assertEqual(len(json.loads(output_path.read_text(encoding="utf-8"))["results"]), 2)

    def test_quality_batch_response_id_validation(self):
        valid = {"id": "a", "status": "ok", "issues": []}
        self.assertEqual(pipeline.validate_data_quality_batch({"results": [valid]}, ["a"]), [])
        self.assertIn("missing ids: b", pipeline.validate_data_quality_batch({"results": [valid]}, ["a", "b"]))
        self.assertIn("duplicate id a", pipeline.validate_data_quality_batch({"results": [valid, valid]}, ["a"]))
        self.assertIn("unknown id z", pipeline.validate_data_quality_batch({"results": [{**valid, "id": "z"}]}, ["a"]))

    def test_batched_quality_checkpointing_and_resume_after_interruption(self):
        class InterruptingAuditor:
            def __init__(self):
                self.calls = 0

            def audit_batch(self, items):
                self.calls += 1
                if self.calls == 2:
                    raise KeyboardInterrupt()
                return [{"id": item["id"], "status": "ok", "issues": []} for item in items]

        class CompletingAuditor:
            def __init__(self):
                self.seen = []

            def audit_batch(self, items):
                self.seen.extend(item["id"] for item in items)
                return [{"id": item["id"], "status": "ok", "issues": []} for item in items]

        entries = pipeline.load_production_vocabulary()[:5]
        with tempfile.TemporaryDirectory() as tmp:
            output_path = Path(tmp) / "quality.json"
            with self.assertRaises(KeyboardInterrupt):
                pipeline.run_data_quality_entries(entries, output_path, "test", model="test-model", provider=InterruptingAuditor(), verbose=False, batch_size=2, concurrency=1)
            self.assertEqual(len(json.loads(output_path.read_text(encoding="utf-8"))["results"]), 2)
            completing = CompletingAuditor()
            pipeline.run_data_quality_entries(entries, output_path, "test", model="test-model", provider=completing, verbose=False, batch_size=2, concurrency=1)
            self.assertEqual(len(json.loads(output_path.read_text(encoding="utf-8"))["results"]), 5)
            self.assertEqual(completing.seen, [entry["id"] for entry in entries[2:]])

    def test_batched_quality_uses_configured_batch_size_and_preserves_cached_ids(self):
        class RecordingAuditor:
            def __init__(self):
                self.batch_sizes = []

            def audit_batch(self, items):
                self.batch_sizes.append(len(items))
                return [{"id": item["id"], "status": "ok", "issues": []} for item in items]

        entries = pipeline.load_production_vocabulary()[:9]
        cached = [{"id": entry["id"], "status": "ok", "issues": []} for entry in entries[:2]]
        auditor = RecordingAuditor()
        with tempfile.TemporaryDirectory() as tmp:
            output_path = Path(tmp) / "quality.json"
            output_path.write_text(json.dumps({"metadata": {"inputHash": pipeline.content_hash(entries), "sampleHash": pipeline.content_hash(entries), "promptVersion": pipeline.DATA_QUALITY_PROMPT_VERSION, "model": "test-model"}, "results": cached}, ensure_ascii=False), encoding="utf-8")
            pipeline.run_data_quality_entries(entries, output_path, "test", model="test-model", provider=auditor, verbose=False, batch_size=3, concurrency=1)
            self.assertEqual(auditor.batch_sizes, [3, 3, 1])
            self.assertEqual(len(json.loads(output_path.read_text(encoding="utf-8"))["results"]), 9)

    def test_batch_runner_respects_concurrency_limit(self):
        class SlowAuditor:
            def __init__(self):
                self.active = 0
                self.max_active = 0
                self.lock = threading.Lock()

            def audit_batch(self, items):
                with self.lock:
                    self.active += 1
                    self.max_active = max(self.max_active, self.active)
                time.sleep(0.02)
                with self.lock:
                    self.active -= 1
                return [{"id": item["id"], "status": "ok", "issues": []} for item in items]

        entries = pipeline.load_production_vocabulary()[:8]
        auditor = SlowAuditor()
        with tempfile.TemporaryDirectory() as tmp:
            pipeline.run_data_quality_entries(entries, Path(tmp) / "quality.json", "test", model="test-model", provider=auditor, verbose=False, batch_size=1, concurrency=2)
        self.assertLessEqual(auditor.max_active, 2)
        self.assertGreaterEqual(auditor.max_active, 2)

    def test_retry_on_transient_errors_and_no_retry_on_validation_error(self):
        calls = {"transient": 0}

        def transient(batch):
            calls["transient"] += 1
            if calls["transient"] == 1:
                raise pipeline.TransientBatchError("429", retry_after=0)
            return [{"id": item["id"], "status": "ok", "issues": []} for item in batch]

        batch = pipeline.load_production_vocabulary()[:1]
        self.assertEqual(pipeline.call_batch_with_retry(transient, batch, sleep=lambda _: None, verbose=False)[0]["id"], batch[0]["id"])
        self.assertEqual(calls["transient"], 2)

        calls["permanent"] = 0

        def permanent(batch):
            calls["permanent"] += 1
            raise pipeline.PermanentBatchError("bad response")

        with self.assertRaises(pipeline.PermanentBatchError):
            pipeline.call_batch_with_retry(permanent, batch, sleep=lambda _: None, verbose=False)
        self.assertEqual(calls["permanent"], 1)

    def test_invalid_json_schema_is_not_retried_or_split(self):
        class BadRequest(Exception):
            status_code = 400
            body = {"error": {"code": "invalid_json_schema", "param": "text.format.schema"}}

        calls = {"count": 0}
        def bad_request(batch):
            calls["count"] += 1
            raise BadRequest("invalid schema")

        with self.assertRaises(BadRequest):
            pipeline.call_batch_with_retry(bad_request, [{"id": "casa"}], sleep=lambda _: None, verbose=False)
        self.assertEqual(calls["count"], 1)

    def test_batch_splitting_after_size_related_failure(self):
        class SplittingAuditor:
            def __init__(self):
                self.batch_sizes = []

            def audit_batch(self, items):
                self.batch_sizes.append(len(items))
                if len(items) > 2:
                    raise pipeline.BatchSizeError("batch size too large")
                return [{"id": item["id"], "status": "ok", "issues": []} for item in items]

        entries = pipeline.load_production_vocabulary()[:5]
        auditor = SplittingAuditor()
        with tempfile.TemporaryDirectory() as tmp:
            pipeline.run_data_quality_entries(entries, Path(tmp) / "quality.json", "test", model="test-model", provider=auditor, verbose=False, batch_size=5, concurrency=1)
        self.assertIn(5, auditor.batch_sizes)
        self.assertIn(3, auditor.batch_sizes)
        self.assertTrue(any(size <= 2 for size in auditor.batch_sizes))

    def test_combined_enrichment_batches_future_inputs(self):
        class FakeCombined:
            def __init__(self):
                self.batch_sizes = []

            def enrich_batch(self, items):
                self.batch_sizes.append(len(items))
                return [{"id": item["id"],
                         "classification": {"id": item["id"], "cefr": "A2", "confidence": 0.9, "thematicCategory": "general", "partOfSpeech": item.get("partOfSpeech", "other"), "reason": "Synthetic."},
                         "quality": {"id": item["id"], "status": "ok", "issues": []}} for item in items]

        entries = pipeline.load_production_vocabulary()[:5]
        provider = FakeCombined()
        with tempfile.TemporaryDirectory() as tmp:
            input_path, output_path = Path(tmp) / "input.json", Path(tmp) / "combined.json"
            input_path.write_text(json.dumps(entries, ensure_ascii=False), encoding="utf-8")
            pipeline.run_combined_enrichment(input_path, output_path, model="test-model", provider=provider, verbose=False, batch_size=2, concurrency=1)
        self.assertEqual(provider.batch_sizes, [2, 2, 1])

    def test_repair_flagged_entries_selects_only_full_quality_reviews(self):
        quality = json.loads(pipeline.DATA_QUALITY_FULL_OUTPUT_PATH.read_text(encoding="utf-8"))
        self.assertEqual(sum(1 for result in quality["results"] if result["status"] == "ok"), 405)
        flagged = pipeline.flagged_repair_entries()
        self.assertEqual(len(flagged), 139)
        self.assertTrue(all(entry["audit"]["status"] == "review" for entry in flagged))
        self.assertEqual({entry["id"] for entry in flagged},
                         {result["id"] for result in quality["results"] if result["status"] == "review"})

    def test_repair_model_payload_is_minimal_and_uses_answerca_for_expressions(self):
        expression = {
            "id": "de-tant-en-tant",
            "word": "tant",
            "answerCa": "de tant en tant",
            "type": "expression",
            "partOfSpeech": "adverb",
            "definitionCa": "Alguna vegada.",
            "translationEs": "de vez en cuando",
            "exampleCa": "De tant en tant vaig al mercat.",
            "difficulty": "hard",
            "audit": {"status": "review", "issues": [{"type": "example-mismatch", "severity": "medium", "explanation": "Synthetic."}]},
            "cefr": {"cefr": "A2", "confidence": 0.9, "reason": "Synthetic.", "difficulty": "hard"},
        }
        payload = pipeline.repair_model_payload(expression)
        self.assertEqual(payload["answerCa"], "de tant en tant")
        self.assertEqual(payload["word"], "tant")
        self.assertEqual(payload["type"], "expression")
        self.assertNotIn("difficulty", payload)
        self.assertEqual(payload["cefrContext"], {"cefr": "A2", "confidence": 0.9})

    def test_repair_proposal_validation_minimal_fields_and_risky_flags(self):
        example_only = {"id": "casa", "status": "proposed", "changes": {"exampleCa": "La casa és petita."},
                        "notes": ["Replace mismatched example only."], "requiresManualDecision": False, "cefrNeedsRecheck": False}
        self.assertEqual(pipeline.validate_repair_proposal(example_only, "casa"), [])
        pos_only = {**example_only, "changes": {"partOfSpeech": "other"}}
        self.assertEqual(pipeline.validate_repair_proposal(pos_only, "casa"), [])
        bad_pos = {**example_only, "changes": {"partOfSpeech": "preposition"}}
        self.assertIn("invalid partOfSpeech", pipeline.validate_repair_proposal(bad_pos, "casa"))
        bad_answer = {**example_only, "changes": {"answerCa": "caseta"}}
        self.assertIn("answerCa changes require manual decision", pipeline.validate_repair_proposal(bad_answer, "casa"))
        self.assertIn("answerCa changes require CEFR recheck", pipeline.validate_repair_proposal(bad_answer, "casa"))
        bad_type = {**example_only, "changes": {"type": "phrase"}}
        self.assertIn("invalid type", pipeline.validate_repair_proposal(bad_type, "casa"))

    def test_repair_file_validation_rejects_unchanged_fields_and_expression_fragment_examples(self):
        flagged = pipeline.flagged_repair_entries()
        proposals = []
        for entry in flagged:
            answer = entry["answerCa"]
            proposals.append({"id": entry["id"], "status": "proposed",
                              "changes": {"exampleCa": f"Ara fem servir {answer} en una frase senzilla."},
                              "notes": ["Synthetic example-only repair."],
                              "requiresManualDecision": False, "cefrNeedsRecheck": False})
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "repairs.json"
            path.write_text(json.dumps({"metadata": {"inputHash": pipeline.repair_input_hash(flagged), "promptVersion": pipeline.REPAIR_PROMPT_VERSION, "model": "test-model"}, "results": proposals}, ensure_ascii=False), encoding="utf-8")
            pipeline.validate_repair_proposals_file(path)

            same_field = list(proposals)
            same_field[0] = {**same_field[0], "changes": {"partOfSpeech": flagged[0]["partOfSpeech"]}}
            path.write_text(json.dumps({"metadata": {}, "results": same_field}, ensure_ascii=False), encoding="utf-8")
            with self.assertRaises(SystemExit):
                pipeline.validate_repair_proposals_file(path)

            expression = next(entry for entry in flagged if entry["type"] == "expression")
            expression_bad = list(proposals)
            index = next(i for i, proposal in enumerate(expression_bad) if proposal["id"] == expression["id"])
            expression_bad[index] = {**expression_bad[index], "changes": {"exampleCa": f"Aquest exemple només diu {expression['word']}."}}
            path.write_text(json.dumps({"metadata": {}, "results": expression_bad}, ensure_ascii=False), encoding="utf-8")
            with self.assertRaises(SystemExit):
                pipeline.validate_repair_proposals_file(path)

            answer_bad = list(proposals)
            answer_bad[0] = {**answer_bad[0], "changes": {"answerCa": "objectiu-inexistent", "exampleCa": "Aquesta frase conserva el text antic."},
                             "requiresManualDecision": True, "cefrNeedsRecheck": True}
            path.write_text(json.dumps({"metadata": {}, "results": answer_bad}, ensure_ascii=False), encoding="utf-8")
            with self.assertRaises(SystemExit):
                pipeline.validate_repair_proposals_file(path)

    def test_repair_proposals_resume_with_fake_provider_and_report_locally(self):
        flagged = pipeline.flagged_repair_entries()

        class FakeRepairProvider:
            def __init__(self):
                self.seen = []
                self.batch_sizes = []

            def propose_batch(self, items):
                self.batch_sizes.append(len(items))
                self.seen.extend(item["id"] for item in items)
                return [{"id": item["id"], "status": "proposed",
                         "changes": {"exampleCa": f"Ara fem servir {item['answerCa']} en una frase senzilla."},
                         "notes": ["Synthetic example-only repair."],
                         "requiresManualDecision": False, "cefrNeedsRecheck": False} for item in items]

        cached = [{"id": entry["id"], "status": "proposed",
                   "changes": {"exampleCa": f"Ara fem servir {entry['answerCa']} en una frase senzilla."},
                   "notes": ["Cached synthetic repair."],
                   "requiresManualDecision": False, "cefrNeedsRecheck": False} for entry in flagged[:2]]
        with tempfile.TemporaryDirectory() as tmp:
            output_path = Path(tmp) / "repairs.json"
            report_path = Path(tmp) / "repair-report.md"
            output_path.write_text(json.dumps({"metadata": pipeline.repair_metadata(flagged, "test-model"), "results": cached}, ensure_ascii=False), encoding="utf-8")
            provider = FakeRepairProvider()
            pipeline.run_repair_proposals(model="test-model", provider=provider, verbose=False, batch_size=20, concurrency=1, output_path=output_path)
            output = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(len(output["results"]), 139)
            self.assertEqual(provider.seen, [entry["id"] for entry in flagged[2:]])
            self.assertEqual(provider.batch_sizes, [20, 20, 20, 20, 20, 20, 17])
            pipeline.generate_repair_report(output_path, report_path)
            report = report_path.read_text(encoding="utf-8")
            self.assertIn("Vocabulary repair proposal analysis", report)
            self.assertIn("| Lexical unit | Audit issues | Proposed fields | Manual review | CEFR recheck |", report)

    def test_repair_batch_response_id_validation(self):
        valid = {"id": "a", "status": "no-change", "changes": {}, "notes": ["Synthetic."],
                 "requiresManualDecision": False, "cefrNeedsRecheck": False}
        self.assertEqual(pipeline.validate_repair_batch({"results": [valid]}, ["a"]), [])
        self.assertIn("missing ids: b", pipeline.validate_repair_batch({"results": [valid]}, ["a", "b"]))
        self.assertIn("duplicate id a", pipeline.validate_repair_batch({"results": [valid, valid]}, ["a"]))
        self.assertIn("unknown id z", pipeline.validate_repair_batch({"results": [{**valid, "id": "z"}]}, ["a"]))

    def review_item(self, **changes):
        item = {"id": "mena", "word": "mena", "exampleCa": "No m'agrada aquesta mena de música.",
                "partOfSpeech": "noun", "candidateTranslationsEs": ["calaña", "mena", "tipo"]}
        item.update(changes)
        return item

    def test_contextual_mena_regression_and_deduplication(self):
        result = pipeline.clean_review_item(self.review_item(candidateTranslationsEs=["tipo", "tipo", "clase"]))
        self.assertEqual(result["status"], "accept")
        self.assertEqual((result["answerCa"], result["type"], result["translationEs"]), ("mena de", "expression", "tipo de"))
        self.assertNotEqual(result["translationEs"], "calaña")

    def test_mica_expression_is_contextual_not_mineral(self):
        item = self.review_item(id="mica", word="mica", exampleCa="Estic una mica cansat.",
                                candidateTranslationsEs=["granito", "mica", "mineral"])
        result = pipeline.clean_review_item(item)
        self.assertEqual((result["answerCa"], result["type"], result["translationEs"]),
                         ("una mica", "expression", "un poco"))
        self.assertNotIn(result["translationEs"], item["candidateTranslationsEs"])

    def test_fort_distinct_contexts_and_ambiguous_rejection(self):
        physical = self.review_item(id="fort", word="fort", exampleCa="És un home molt fort.",
                                    partOfSpeech="adjective", candidateTranslationsEs=["duro", "fuerte"])
        physical_result = pipeline.clean_review_item(physical)
        self.assertEqual((physical_result["translationEs"], physical_result["definitionCa"]), ("fuerte", "Que té molta força física."))
        sound = self.review_item(id="fort", word="fort", exampleCa="La música sona molt fort.",
                                 partOfSpeech="adverb", candidateTranslationsEs=["duro", "fuerte", "recio"])
        sound_result = pipeline.clean_review_item(sound)
        self.assertEqual(sound_result["translationEs"], "alto")
        self.assertIn("volum", sound_result["definitionCa"])

    def test_override_wins_and_alternatives_are_limited(self):
        override = {"mena": {"translationEs": "clase", "definitionCa": "Tipus o classe d'una cosa."}}
        result = pipeline.clean_review_item(self.review_item(), override)
        self.assertEqual(result["translationEs"], "clase")
        self.assertEqual(result["reviewSource"], "manual-override")

    def test_rejection_and_pos_consistency(self):
        rejected = pipeline.clean_review_item(self.review_item(), rejected={"mena"})
        self.assertEqual(rejected["status"], "reject")
        verb = self.review_item(id="menjar", word="menjar", exampleCa="Vull menjar pa.",
                                partOfSpeech="verb", candidateTranslationsEs=["comida", "comer"])
        cleaned = pipeline.clean_review_item(verb)
        self.assertEqual(cleaned["status"], "review")
        self.assertEqual(cleaned["translationEs"], "comer")

    def test_ambiguous_context_goes_to_review_and_vermell_is_automatic(self):
        ambiguous = self.review_item(id="banc", word="banc", exampleCa="Vaig al banc.", candidateTranslationsEs=["banco", "banca"])
        self.assertEqual(pipeline.clean_review_item(ambiguous)["status"], "review")
        vermell = self.review_item(id="vermell", word="vermell", exampleCa="Porta un jersei vermell.",
                                   partOfSpeech="adjective", candidateTranslationsEs=["rojo"])
        result = pipeline.clean_review_item(vermell)
        self.assertEqual((result["status"], result["translationEs"]), ("accept", "rojo"))

    def test_review_preserves_example_and_generated_data_excludes_rejected(self):
        example = "No m'agrada aquesta mena de música."
        result = pipeline.clean_review_item(self.review_item(exampleCa=example))
        self.assertEqual(self.review_item(exampleCa=example)["exampleCa"], example)
        self.assertEqual(pipeline.validate_review_result(result, pipeline.review_hash(self.review_item(exampleCa=example))), [])
        generated = json.loads((pipeline.DATA / "vocabulary.json").read_text(encoding="utf-8"))
        self.assertNotIn("mena", {entry["word"] for entry in generated})

    def test_llm_enrichment_schema_matches_responses_api_format(self):
        response_format = pipeline.enrichment_schema()
        self.assertEqual(response_format["type"], "json_schema")
        self.assertEqual(response_format["name"], "meaning_enrichment_result")
        self.assertEqual(
            set(response_format["schema"]["required"]),
            set(response_format["schema"]["properties"]),
        )

    def test_llm_enrichment_serializes_api_field_names(self):
        result = pipeline.EnrichmentResult(
            status="resolved",
            translation_es="banco",
            definition_ca="Seient llarg per a diverses persones.",
            sense_gloss="seient",
            confidence="high",
            needs_human_review=False,
            notes="El context indica el sentit de seient.",
        )
        serialized = pipeline.serialize_enrichment_result(result)
        self.assertEqual(serialized["translationEs"], "banco")
        self.assertFalse(serialized["needsHumanReview"])
        self.assertEqual(pipeline.validate_enrichment_result(serialized), [])


if __name__ == "__main__":
    unittest.main()
