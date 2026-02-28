"""Example execution script for Shield compliance rule pack."""

from __future__ import annotations

import argparse

import boto3

from .rule_runner import run_all_rules, to_json


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Shield compliance rules against AWS.")
    parser.add_argument("--profile", default=None, help="AWS profile name")
    parser.add_argument("--region", default="us-east-1", help="Default AWS region for session bootstrap")
    parser.add_argument("--workers", type=int, default=6, help="Parallel worker count")
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    results = run_all_rules(session, max_workers=args.workers)
    print(to_json(results))


if __name__ == "__main__":
    main()

