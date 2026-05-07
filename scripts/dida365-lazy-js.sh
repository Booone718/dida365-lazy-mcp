#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JS_DIR="$SCRIPT_DIR/js"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
if { [ ! -d "$JS_DIR/node_modules/@modelcontextprotocol/sdk" ] || [ ! -d "$JS_DIR/node_modules/yaml" ]; } \
   && { [ ! -d "$PROJECT_DIR/node_modules/@modelcontextprotocol/sdk" ] || [ ! -d "$PROJECT_DIR/node_modules/yaml" ]; }; then
  printf '%s\n' "{\"ok\":false,\"error\":\"JS dependencies missing. Run: npm install from '$PROJECT_DIR' or npm install --prefix '$JS_DIR'\"}"
  exit 1
fi
export NODE_NO_WARNINGS="${NODE_NO_WARNINGS:-1}"
exec node "$JS_DIR/dida365_lazy.mjs" "$@"
