#!/usr/bin/env bash
set -Eeuo pipefail

# Backward-compatible wrapper (repo tidy refactor).
# Actual script lives in: scripts/backup/backup_uncompressed.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/scripts/backup/backup_uncompressed.sh" "$@"

