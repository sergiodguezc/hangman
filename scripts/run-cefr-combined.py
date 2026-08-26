#!/usr/bin/env python3
import argparse
from pathlib import Path

from vocab_pipeline import run_combined_enrichment

parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--model", default=None)
parser.add_argument("--force", action="store_true")
parser.add_argument("--batch-size", type=int, default=None)
parser.add_argument("--concurrency", type=int, default=None)
args = parser.parse_args()

kwargs = {}
if args.batch_size is not None:
    kwargs["batch_size"] = args.batch_size
if args.concurrency is not None:
    kwargs["concurrency"] = args.concurrency
run_combined_enrichment(Path(args.input), Path(args.output), model=args.model, force=args.force, **kwargs)
