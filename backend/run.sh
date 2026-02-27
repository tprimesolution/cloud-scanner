#!/bin/bash
# Run backend locally (requires postgres + redis)
cd "$(dirname "$0")"
export PYTHONPATH="$PWD"
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
