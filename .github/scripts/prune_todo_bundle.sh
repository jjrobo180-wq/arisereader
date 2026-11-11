#!/usr/bin/env bash
# Takes out the files other products own, so the Arise To Duo iPhone app and its live updates stay small.
# Usage: prune_todo_bundle.sh <build folder>   (the folder `npx vite build` wrote, normally dist/public)
set -euo pipefail
OUT="${1:?usage: prune_todo_bundle.sh <build folder>}"
test -f "$OUT/index.html" || { echo "::error::$OUT has no index.html"; exit 1; }

# The eye-gaze talker engine (Wren). It belongs to the Arise Eye Gazer app, not Arise To Duo.
rm -rf "$OUT/eyegaze/wren"

echo "To Duo bundle: $(du -sm "$OUT" | cut -f1) MB after pruning"
