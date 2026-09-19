#!/usr/bin/env bash
set -euo pipefail

cd "/home/ubuntu/works/agentic-rocket/app"
exec /usr/bin/node server/index.mjs
