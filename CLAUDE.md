# Working in this repository

## The owner's standing instructions

- **Always push.** After a change is made and its tests pass, commit it and push it to `master`. Do not ask
  first and do not wait to be told "push" or "merge": the owner has said to push every change, every time.
- **Always send it to TestFlight.** After pushing any change to what runs in the app (`client/`, `shared/`,
  `native/`, `arisetodo/ios-app/`), also start the signed To Duo build with TestFlight upload
  (`gh workflow run arisetodo-signed-release.yml -R jjrobo180-wq/arisereader --ref master -f upload=true`), without
  asking: the iPhone app gets no web updates (see "No live updates" below), so a fix reaches the owner's phone
  only in a new build. The owner said so on Nov 26, 2026. Changes only to `server/`, `tests/` or docs need no build.

## App Store rules this repository follows

- **No live updates.** No iPhone app downloads new web code after App Review (guidelines 2.5.2 and 2.5.19), so web
  changes reach the iPhone apps only in a new build, like native ones. Never add an updater, remote code or
  feature switches back. `server/ota.ts` answers older builds' updater with "nothing new".
- **To Duo alone in the To Duo app.** Its build is `vite.todo.config.ts`. Pages of other products are left out by
  `script/todoBundle.mjs`, and `.github/scripts/prune_todo_bundle.sh` fails the build if anything hidden is left.
- **Nothing disguised, nothing for review only.** Every feature works the same for App Review as for everyone else.

## Checking a change

- Shared logic has tests in `tests/` (`npx tsx --test tests/<file>.test.ts`). Add or update one with each change.
- A few older tests already fail on `master` (for example "one app for one job in the Plugin Gallery"); compare
  against `master` before treating a failure as your own.
