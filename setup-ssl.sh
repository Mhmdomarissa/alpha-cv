#!/usr/bin/env bash
set -Eeuo pipefail

# SSL setup for alphacv.alphadatarecruitment.ae (Let's Encrypt).
# Run from project root:  cd /path/to/alpha-cv && ./setup-ssl.sh init
# Requires: ports 80 and 443 open (AWS Security Group / firewall).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/scripts/system/setup-ssl.sh" "$@"

