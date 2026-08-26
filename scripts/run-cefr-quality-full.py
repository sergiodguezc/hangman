#!/usr/bin/env python3
import argparse

from vocab_pipeline import run_data_quality_full

parser = argparse.ArgumentParser()
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
run_data_quality_full(model=args.model, force=args.force, **kwargs)
