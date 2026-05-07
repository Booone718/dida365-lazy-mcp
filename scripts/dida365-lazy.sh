#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="${HERMES_PYTHON:-$HOME/.hermes/hermes-agent/venv/bin/python}"
exec "$PYTHON_BIN" "$SCRIPT_DIR/dida365_lazy.py" "$@"
