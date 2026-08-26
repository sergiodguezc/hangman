#!/usr/bin/env python3
import argparse

from vocab_pipeline import run_cefr_experiment

parser = argparse.ArgumentParser()
parser.add_argument("--model", default=None)
parser.add_argument("--force", action="store_true")
args = parser.parse_args()

run_cefr_experiment(model=args.model, force=args.force)
