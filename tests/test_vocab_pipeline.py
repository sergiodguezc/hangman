import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import vocab_pipeline as pipeline


class VocabularyPipelineTests(unittest.TestCase):
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
        valid = [{"id": "canco", "word": "cançó", "hintEs": "canción", "translationsEs": ["canción"],
                  "exampleCa": "Aquesta cançó és bonica.", "partOfSpeech": "noun",
                  "difficulty": "easy", "corpusCount": 2}]
        pipeline.validate(valid)
        with self.assertRaises(SystemExit):
            pipeline.validate([{**valid[0], "hintEs": "", "translationsEs": []}])

    def review_item(self, **changes):
        item = {"id": "mena", "word": "mena", "exampleCa": "No m'agrada aquesta mena de música.",
                "partOfSpeech": "noun", "candidateTranslationsEs": ["calaña", "mena", "tipo"]}
        item.update(changes)
        return item

    def test_contextual_mena_regression_and_deduplication(self):
        result = pipeline.clean_review_item(self.review_item(candidateTranslationsEs=["tipo", "tipo", "clase"]))
        self.assertEqual(result["status"], "accept")
        self.assertEqual(result["hintEs"], "tipo")
        self.assertEqual(result["translationsEs"], ["tipo", "clase"])
        self.assertNotEqual(result["hintEs"], "calaña")

    def test_override_wins_and_alternatives_are_limited(self):
        override = {"mena": {"hintEs": "clase", "translationsEs": ["clase", "tipo", "género", "especie"]}}
        result = pipeline.clean_review_item(self.review_item(), override)
        self.assertEqual(result["hintEs"], "clase")
        self.assertEqual(len(result["translationsEs"]), pipeline.MAX_TRANSLATIONS)
        self.assertEqual(result["reviewSource"], "manual-override")

    def test_rejection_and_pos_consistency(self):
        rejected = pipeline.clean_review_item(self.review_item(), rejected={"mena"})
        self.assertEqual(rejected["status"], "reject")
        verb = self.review_item(id="menjar", word="menjar", exampleCa="Vull menjar pa.",
                                partOfSpeech="verb", candidateTranslationsEs=["comida", "comer"])
        cleaned = pipeline.clean_review_item(verb)
        self.assertEqual(cleaned["hintEs"], "comer")

    def test_review_preserves_example_and_generated_data_excludes_rejected(self):
        example = "No m'agrada aquesta mena de música."
        result = pipeline.clean_review_item(self.review_item(exampleCa=example))
        self.assertEqual(self.review_item(exampleCa=example)["exampleCa"], example)
        self.assertEqual(pipeline.validate_review_result(result, pipeline.review_hash(self.review_item(exampleCa=example))), [])
        generated = json.loads((pipeline.DATA / "vocabulary.json").read_text(encoding="utf-8"))
        self.assertNotIn("mena", {entry["word"] for entry in generated})


if __name__ == "__main__":
    unittest.main()
