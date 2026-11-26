#!/usr/bin/env bash
# The Arise To Duo iPhone app has To Duo inside and nothing else (App Review 2.5.19: no hidden or dormant
# features). Run on the folder `npx vite build --config vite.todo.config.ts` wrote (normally dist/public):
#  1. takes out the files of the other products and the websites' own pages, none of which the app opens
#     (books, chapters and covers come from arisetodo.com in the app: client/src/main.tsx, SERVER_FILES);
#  2. fails the build if anything from Arise Undercover's disguised chat, or any updater, is still inside.
# Usage: prune_todo_bundle.sh <build folder>
set -euo pipefail
OUT="${1:?usage: prune_todo_bundle.sh <build folder>}"
test -f "$OUT/index.html" || { echo "::error::$OUT has no index.html"; exit 1; }

LEFT_OUT=(
  # Arise AAC's talker and eye-gaze page, Arise Reader's books and audio, the 3D avatar and worlds, the games.
  eyegaze/wren eyegaze/index.html reads classics covers audio avatar world pets farm
  prize-wheel.html board-quest.html yt-bridge.html standalone
  # The websites' pages (Arise Reader, Cooked, Notes, To Duo's own marketing pages) and site files.
  reader-landing.html educator.html notes-landing.html cooked-landing.html cooked-pt-landing.html notes-app
  teacher-guide advisory-kit reading-rewards reading-quizzes special-education-reading accelerated-reader-alternative
  teacher-workspace family-to-do-app foldable-phone-to-do-app iphone-duo iphone-duo-split-screen-guide
  iphone-duo-to-do-app split-screen-to-do-app teacher-to-do-app to-do-list-with-notes for
  ab-days.json app-links.json robots.txt sitemap.xml google298ee7b3cd657a24.html 9cdb74bc86132db459cb5c8432f3214b.txt
  og-image.png todo-og.png reader-app-icon.png
  # Other apps' pages, in case a build made them.
  notes scholar undercover
)
for p in "${LEFT_OUT[@]}"; do rm -rf "${OUT:?}/$p"; done

# Words that must never be in the app (script/todoBundle.mjs, TODO_FORBIDDEN).
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FOUND=""
while IFS= read -r word; do
  [ -z "$word" ] && continue
  hits=$(grep -rIil -F -- "$word" "$OUT" || true)
  [ -n "$hits" ] && FOUND+="$word: $(echo "$hits" | sed "s|^$OUT/||" | tr '\n' ' ')"$'\n'
done < <(node --input-type=module -e "import { TODO_FORBIDDEN } from '$HERE/script/todoBundle.mjs'; console.log(TODO_FORBIDDEN.join('\n'))")
if [ -n "$FOUND" ]; then
  echo "::error::The To Duo app would contain other products' hidden features or an updater:"
  printf '%s' "$FOUND"
  exit 1
fi

echo "To Duo bundle: $(du -sm "$OUT" | cut -f1) MB after pruning; nothing hidden found"
