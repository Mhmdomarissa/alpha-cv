#!/usr/bin/env bash
set -Eeuo pipefail

# Backward-compatible wrapper (repo tidy refactor).
# Actual script lives in: scripts/utils/check-qdrant.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/scripts/utils/check-qdrant.sh" "$@"

