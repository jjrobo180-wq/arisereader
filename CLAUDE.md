# Working in this repository

## The owner's standing instructions

- **Always push.** After a change is made and its tests pass, commit it and push it to `master`. Do not ask
  first and do not wait to be told "push" or "merge": the owner has said to push every change, every time.
- When a change touches the iPhone widgets or other native code (`native/`, `arisetodo/ios-app/`), also start
  the signed To Duo build with TestFlight upload (`gh workflow run arisetodo-signed-release.yml -f upload=true`),
  since web updates alone don't reach native code.

## Checking a change

- Shared logic has tests in `tests/` (`npx tsx --test tests/<file>.test.ts`). Add or update one with each change.
- A few older tests already fail on `master` (for example "one app for one job in the Plugin Gallery"); compare
  against `master` before treating a failure as your own.
