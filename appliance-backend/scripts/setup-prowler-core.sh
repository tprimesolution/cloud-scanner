#!/bin/bash
# Clone Prowler into scanner-engine/prowler-core for direct Python execution (no CLI)
set -e
PROWLER_CORE="${1:-$(dirname "$0")/../scanner-engine/prowler-core}"
if [ -d "$PROWLER_CORE/prowler" ]; then
  echo "Prowler already cloned at $PROWLER_CORE"
  exit 0
fi
echo "Cloning Prowler into $PROWLER_CORE..."
git clone --depth 1 https://github.com/prowler-cloud/prowler.git "$PROWLER_CORE"
cd "$PROWLER_CORE" && pip install -e . --quiet
echo "Prowler installed. PYTHONPATH should include: $PROWLER_CORE"
