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
        valid = [{"id": "canco", "word": "cançó", "translationEs": ["canción"],
                  "exampleCa": "Aquesta cançó és bonica.", "partOfSpeech": "noun",
                  "difficulty": "easy", "corpusCount": 2}]
        pipeline.validate(valid)
        with self.assertRaises(SystemExit):
            pipeline.validate([{**valid[0], "translationEs": []}])


if __name__ == "__main__":
    unittest.main()
