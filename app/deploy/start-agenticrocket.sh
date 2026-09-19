#!/usr/bin/env bash
set -euo pipefail

cd "/home/ubuntu/works/agentic-rocket/app"
AGENTICROCKET_NODE="${AGENTICROCKET_NODE:-/home/ubuntu/.nvm/versions/node/v24.14.0/bin/node}"
if [[ ! -x "$AGENTICROCKET_NODE" ]]; then
  AGENTICROCKET_NODE="$(command -v node)"
fi
exec "$AGENTICROCKET_NODE" server/index.mjs
