#!/bin/bash
# g-schema-drift.sh — fails when schema.prisma disagrees with the dev DB.
# CI enforces the same rule against a fresh migrate deploy (.github/workflows/ci.yml).
set -euo pipefail
cd "$(dirname "$0")/.."
DB=$(grep -E '^DATABASE_URL=' apps/api/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
npx prisma migrate diff --from-url "$DB" --to-schema-datamodel apps/api/prisma/schema.prisma --exit-code \
  && echo "SCHEMA-DRIFT-GATE: zero drift"
