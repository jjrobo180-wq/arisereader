#!/usr/bin/env bash
# Takes out the files other products own, so the Arise Notes iPhone app and its live updates stay small
# (the full site build is 160 MB; a live update that big never finished downloading on the phone).
# Usage: prune_notes_bundle.sh <build folder>   (the folder `npx vite build` wrote, normally dist/public)
set -euo pipefail
OUT="${1:?usage: prune_notes_bundle.sh <build folder>}"
test -f "$OUT/index.html" || { echo "::error::$OUT has no index.html"; exit 1; }
# The eye-gaze talker, classic books, reading passages, avatars, read-along audio, world and pets art:
# Arise Notes uses none of them.
for d in eyegaze classics reads avatar audio world pets; do rm -rf "$OUT/$d"; done
echo "Notes bundle: $(du -sm "$OUT" | cut -f1) MB after pruning"
