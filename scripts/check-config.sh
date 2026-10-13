#!/usr/bin/env bash
# Stops `npm run deploy` while cdk.json still holds the REPLACE_WITH_... placeholders.
set -euo pipefail
cd "$(dirname "$0")/.."
if grep -q 'REPLACE_WITH_' cdk.json; then
  echo "cdk.json still has placeholders. Fill these in first (see README, 'Setup'):" >&2
  grep -n 'REPLACE_WITH_' cdk.json >&2
  exit 1
fi
