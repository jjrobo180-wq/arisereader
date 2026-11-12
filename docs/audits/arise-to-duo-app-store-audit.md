# Arise To Duo: audit before App Store submission

Audit date: 2026-11-09, at commit `5279554` on master.

This list is written to be worked through one item at a time. Each item says where the problem is, what is
wrong, the exact change, and how to check it. Fix the items in order; section A first.

## How this audit was done (so you know what it does and does not prove)

- Read by hand: the iPhone project setup (`arisetodo/ios-app`, the signed-release and live-update workflows),
  every native plugin call, the sign-in and sign-up screen, the purchase screens, the notification code, the
  live-update code, the crash screen, the first-run overlays in LifeHub, the privacy policy.
- Ran in CI on a side branch: a full TypeScript check (`tsc --noEmit`), the repo's React safety lint, and a
  To Duo production build with file sizes.
- Read the live server's logs for crash reports and failing requests, and counted registered iPhones in the
  database.
- **Not done:** nothing was run on a real iPhone or in the simulator, and no screenshots were taken. Every
  one of the 80+ LifeHub sections and the WorkHub screens was not opened one by one. Items that need a
  device are in section E.

What looked right and needs no change: the plugins the code calls match the plugins installed; the signed
build has the HealthKit, Sign in with Apple and push (production) entitlements; every permission the app can
ask for has its sentence in Info.plist; account deletion exists and revokes the Apple sign-in; social posts
have Report and Block; live updates are verified with a SHA-256 checksum; the Billing page is replaced by a
no-purchase page inside the app; the type check found no missing imports today.

---

## A. Fix before submitting

### 1. The app ships 327 MB of files, and every live update is a 170 MB download

- **Where:** `.github/workflows/arisetodo-signed-release.yml` (step "Build and bundle local frontend"),
  `.github/workflows/arisetodo-ios.yml` (step "Bundle A.R.I.S.E. application locally"),
  `.github/workflows/ota-publish.yml` (the `todo)` case).
- **What is wrong:** all three copy the whole of `dist/public` into the app. That includes other products'
  files: `eyegaze/wren` (148 MB, the eye-gaze engine), `classics` (53 MB), `reads` (46 MB), `avatar` (35 MB),
  `audio` (16 MB). Measured: `dist/public` is 327 MB; the last three `ota-todo-*` release zips are 169.8 MB
  each. The phone downloads that zip after every push to master, on cellular too.
- **Fix:**
  1. Add `.github/scripts/prune_todo_bundle.sh` that takes the build folder and deletes `eyegaze/wren`.
     Only `client/src/pages/EyeGazeWren.tsx` uses it.
  2. For `avatar/` (used by `client/src/lib/avatarCharacters.ts`), `audio/` (used by
     `client/src/components/family-hub/earshot/EarshotPlayer.tsx`), `classics/` and `reads/` (used by
     `client/src/pages/reads/BookReader.tsx`, `ReadHub.tsx`, `PoemReader.tsx`, `Library.tsx`): make each
     loader build its address with a helper that returns `https://arisetodo.com/<path>` when
     `isNativeApp() && nativeFlavor() === "todo"`, and the plain path otherwise. Then delete those four
     folders in the prune script too.
  3. In To Duo, the `EyeGazeWren` route must not open a blank page: show a short "This is in the Arise Eye
     Gazer app" message when the engine files are missing.
  4. Call the prune script right after `npx vite build` in all three workflows.
  5. Add a guard to `ota-publish.yml` for `todo`: fail the job if the zip is over 60 MB.
- **Check:** the `ota-todo-*` notice in the workflow run shows a size under 60 MB; books, avatars and the
  Podster sample still load in the app with Wi-Fi on.

### 2. No privacy manifest (`PrivacyInfo.xcprivacy`) anywhere in the project

- **Where:** nothing named `PrivacyInfo.xcprivacy` exists outside `node_modules`. The app's own Swift uses
  `UserDefaults`, which Apple lists as a "required reason" API:
  `native/arise-widgets/ios/Sources/AriseWidgetsPlugin/AriseWidgetsPlugin.swift`,
  `native/widget-extension/AriseWidgets.swift`, `native/arise-watch/.../AriseWatchPlugin.swift`,
  `native/watch-kit/AriseWatchLink.swift`, `native/duo-watch/DuoWatchApp.swift`,
  `native/duo-tv/DuoTVApp.swift`.
- **What is wrong:** Apple asks for a manifest that declares these APIs. Uploads have gone through so far,
  so treat this as a likely warning or rejection, not a certain one.
- **Fix:** add `arisetodo/ios-app/PrivacyInfo.xcprivacy` with `NSPrivacyTracking` false, no tracking
  domains, `NSPrivacyAccessedAPITypes` containing `NSPrivacyAccessedAPICategoryUserDefaults` with reasons
  `CA92.1` and `1C8F.1` (app group), and `NSPrivacyCollectedDataTypes` that match the App Privacy answers
  (section D). Add the file to the App target in the signed-release workflow, and to the widget, watch and
  TV targets in `.github/scripts/add_widget.rb` and `.github/scripts/add_companion.rb`.
- **Check:** unzip the built `.ipa`; `PrivacyInfo.xcprivacy` is inside `App.app` and inside each extension.

### 3. AI features send what people type to outside AI companies without asking first

- **Where:** every AI feature in LifeHub and WorkHub (Add with AI, the AI assistant, meal estimates). The
  privacy policy names OpenAI, Groq and Perplexity; nothing in the app asks.
- **What is wrong:** App Review guideline 5.1.2(i) asks apps to say when personal data goes to a third
  party, including third-party AI, and to get permission first.
- **Fix:** add `client/src/lib/aiConsent.ts` (a per-account saved "yes") and an `AiConsentSheet` that names
  the providers and links to the privacy policy. Ask once, before the first AI request, in one place: the
  global `window.fetch` wrapper in `client/src/main.tsx`. Find the AI endpoints from the server's AI gate
  (the "Arise To Duo Free" block in `server/routes.ts` near line 1549). If the person says no, the request
  is not sent and the feature says AI is off.
- **Check:** on a new account, the first AI action shows the sheet; "Not now" sends nothing; "Allow" is
  remembered.

### 4. The privacy policy leaves out things the app asks for

- **Where:** `client/public/privacy/index.html` (last updated October 29, 2026).
- **What is wrong:** it does not mention the microphone, location, or subscriptions bought through Apple,
  and mentions notifications once. The app asks for all of these.
- **Fix:** add short sections for the microphone (voice notes), location (weather and mileage, only while
  used), the notification device token, Apple Reminders, camera and photos, and "Purchases made with your
  Apple ID". Update the date.
- **Check:** each permission sentence in `arisetodo/ios-app/configure-ios.py` has a matching line in the
  policy.

### 5. The upgrade sheet prints the website's price inside the app

- **Where:** `client/src/components/hub-pieces/TodoPlan.tsx` lines 131, 140 and 164.
- **What is wrong:** the sheet says "{price} a month or {yearly} a year" above the Apple purchase button.
  The website price is $10; Apple's is $9.99; the yearly plan cannot be bought in the app. Line 131 also
  falls back to `500` cents ($5), an old price, when the plan has not loaded.
- **Fix:** when `isNativeApp()`, leave the price out of `lead` (line 140) and out of the All Access column
  (line 164); `AllAccessOffer` already shows the right price for the store. Change the fallback on line 131
  from `500` to the All Access price (`ALL_ACCESS` in `shared/allAccess.ts`).
- **Check:** in the app, the sheet shows one price only, the one on the Apple button.

### 6. Nothing stops a missing import from shipping

- **Where:** `.github/workflows/all-tests.yml`.
- **What is wrong:** two crashes in the last week were missing imports that reached phones: `useAppearance`
  in `PagesView` (November 5) and `AllAccessPopup` in `NotesApp` (November 9). A type check catches both;
  CI does not run one. A full `tsc` reports about 900 errors today, mostly setup noise, so it cannot be
  switched on as is.
- **Fix:** add a step after "All tests":
  `npx tsc --noEmit -p . | grep -E "error TS(2304|2552|2448|2454|2300)" && exit 1 || true`.
  It fails only on names that do not exist, used-before-declared, and duplicate names. Today it fails on
  one thing, which must be fixed in the same change: `client/src/pages/TeacherHub.tsx` imports `addDays`
  twice (line 91 from `@shared/hubDates`, line 106 from `@shared/familyHub`). Remove the import on line
  106 and run the tests.
- **Check:** the step passes on master; adding a use of an unimported name in a branch makes it fail.

### 7. Notifications: fixed in code, not yet seen working on a phone

- **Where:** `client/src/lib/queryClient.ts`, `client/src/lib/applePush.ts` (merged in #554).
- **What is wrong:** before the fix, no iPhone had ever registered (0 Apple devices in
  `push_subscriptions`). The fix has passed tests only.
- **Fix:** none in code. Check on a device (section E, item 1) before submitting.

---

## B. Should fix

### 8. A live update reloads the app while someone is using it

- **Where:** `client/src/lib/nativeApp.ts`, `liveUpdateNow` (`await u.set({ id: bundle.id })`).
- **What is wrong:** the new code is switched to the moment it finishes downloading, so the screen reloads
  in the middle of typing, a timer or a recording. It checks every 5 minutes.
- **Fix:** replace `u.set({ id })` with `u.next({ id })` so the update is used the next time the app is
  opened or comes back from the background. Keep `set` only for the first check 6 seconds after launch.
- **Check:** publish an update with the app open on a section; the screen does not reload until the app is
  sent to the background and reopened.

### 9. First-run screens pile on top of each other

- **Where:** `client/src/pages/AriseTodo.tsx` line 834 (`useMorningBrief("life", currentDay, !!user &&
  !family.briefOff)`), with `DuoSetup` (line 1234), `AppWalkthrough` (1235), `HubCoach` (1233) and
  `AllAccessPopup` (1239).
- **What is wrong:** before noon the Daily Brief opens on a brand-new account while setup and the
  walkthrough are showing. This is what hid the All Access pop-up earlier.
- **Fix:** pass `ready` as `!!user && !family.briefOff && !setupOpen &&
  localStorage.getItem(\`arise-walkthrough-v1:${user.id}\`) !== null`, so the brief waits until setup and the
  walkthrough are done. Do the same for the WorkHub brief in `client/src/pages/TeacherHub.tsx`.
- **Check:** new account before noon: setup, then walkthrough, then the coach, then the All Access pop-up;
  the brief appears the next morning.

### 10. The crash screen shows Reader branding, raw code text, and the wrong button

- **Where:** `client/src/components/ErrorBoundary.tsx` (`savedRole`, lines 12 to 20, and `render`).
- **What is wrong:** `savedRole` reads only the cookie. In the iPhone apps the sign-in is kept in storage, so
  a signed-in person counts as "guest": the screen offers "Go to sign in" and crash reports say
  `role=guest`. The screen also shows the Reader's orange book icon and the raw error text in every app.
- **Fix:** in `savedRole`, fall back to `readSessionBackup()` from `@/lib/sessionBackup` when the cookie is
  missing. Use `nativeAppInfo()` for the icon in the apps. Put the raw error text behind a small "Details"
  button.
- **Check:** throw an error in a section while signed in, in the app: the button says "Back to LifeHub" and
  the log line says `role=todo`.

### 11. An expired sign-in is never noticed while the app stays open

- **Where:** `client/src/main.tsx` (the `window.fetch` wrapper) and `client/src/context/AuthContext.tsx`
  (the `/api/me` check runs once per launch).
- **What is wrong:** the server log shows clients asking `/api/teacher-hub/apple-reminders/inbox` and
  getting 401 every minute for hours. The hub keeps running on a dead sign-in and nothing saves.
- **Fix:** in the fetch wrapper, when a request that carried `Authorization` gets 401 twice in a row,
  dispatch `window` event `arise:session-check`. In `AuthContext`, listen for it and run the `/api/me` check
  again (it already signs out on 401).
- **Check:** delete the session row for a signed-in test account; within a minute the app shows the sign-in
  screen.

### 12. Polling that is faster than it needs to be

- **Where:** `client/src/components/family-hub/Accountability.tsx` line 277 (every 8 seconds while the
  notification sheet is open); `client/src/components/family-hub/DropApp.tsx` line 67 (every 10 seconds).
- **Fix:** change 8000 to 20000 in Accountability (it already refreshes on the `arise:push-linked` event and
  after a test). In DropApp, skip the tick when `document.visibilityState !== "visible"`.
- **Check:** the server log shows `notify-status` no more than three times a minute per open sheet.

### 13. The All Access offer guesses the store country from the phone's language

- **Where:** `client/src/components/AllAccessOffer.tsx` line 19 (`useState(() => usRegion())`).
- **What is wrong:** the website link and price are allowed only in the US App Store. The first guess comes
  from the phone's region setting; if the store question fails, the guess stays.
- **Fix:** when `appleStoreReady()` is true, start `us` as `false` and set it only from
  `appStoreCountry()`. Keep `usRegion()` for builds without the store plugin.
- **Check:** with the phone's region set to US and a non-US App Store account, no website link shows.

---

## C. Mistakes and polish

### 14. Three different plugin counts

- **Where:** `client/src/components/hub-pieces/TodoPlan.tsx` lines 139 and 141 ("450+"), line 166 ("575+");
  `client/src/components/DuoSetup.tsx` line 231 ("500+").
- **Fix:** export one constant from `shared/pluginStore.ts`, computed from `PLUGINS.length` rounded down to
  the nearest 50, and use it in all four places.

### 15. "Apps" and "Unlimited" where the app now says "plugins" and "All Access"

- **Where:** `client/src/components/hub-pieces/TodoPlan.tsx`, `PlanCard`: "{n} of {limit} apps", "go
  Unlimited", and the "Unlimited" card title.
- **Fix:** "plugins" and "All Access". The stale message in `server/routes.ts` line 1518 ("an add-on for
  parents ($10 a month)") can no longer be reached (`todoAccessFor` always allows); delete that gate.

### 16. Search can crash if you sign out with it open

- **Where:** `client/src/pages/AriseTodo.tsx` line 898 reads `user.role` inside a memo that runs before the
  `if (!user)` redirect on line 1098.
- **Fix:** change line 892 to `if (!searching || !user) return [];`.

### 17. Dead code

- **Where:** `client/src/pages/AriseTodo.tsx` line 1087: `false && shown === "start" ? <GettingStarted …`.
- **Fix:** delete the branch and the `GettingStarted` import if nothing else uses it.

### 18. Arise Talk has no welcome text (another app, same file)

- **Where:** `client/src/pages/NativeSignIn.tsx` line 25: `COPY` has no `talk` entry, but `NativeFlavor`
  includes `"talk"`.
- **What is wrong:** if the Talk app shows this screen, `copy.icon` throws. Not To Duo, but it is the same
  file and the type check flags it.
- **Fix:** add a `talk` entry.

### 19. The All Access pop-up never shows to people who land in WorkHub

- **Where:** it is mounted only in `client/src/pages/AriseTodo.tsx` line 1239. Teachers open on WorkHub
  (`client/src/pages/TeacherHub.tsx`).
- **Fix:** mount `AllAccessPopup` in `TeacherHub.tsx` with the WorkHub walkthrough's done key.

### 20. Launch colors do not match

- **Where:** `arisetodo/ios-app/capacitor.config.json`: `SplashScreen.backgroundColor` is `#FFFFFF`,
  `ios.backgroundColor` is `#f6f7fc`.
- **Fix:** set both to `#f6f7fc`. (People using night mode still see a light launch screen for half a
  second; a dark launch image is a later improvement.)

### 21. The README says the app must not be submitted

- **Where:** `arisetodo/ios-app/README.md` ("not a distributable App Store app", "do not submit it",
  "No purchases in the app").
- **Fix:** rewrite it to describe the app as it is: bundled web code, live updates, All Access sold with
  Apple in-app purchase.

### 22. Hooks called after an early return

- **Where:** `client/src/components/DonationGoal.tsx` lines 22 to 24; `client/src/components/SupportArise.tsx`
  lines 71 to 110 (from `script/lint-react-safety.mjs`).
- **What is wrong:** safe only while the early-return condition never changes between renders.
- **Fix:** move the early returns below the hooks.

---

## D. Yours to do in App Store Connect (no code)

1. **Attach the in-app subscription to this version.** The first in-app purchase must be submitted together
   with an app version, with its own review screenshot and notes. If it is not attached, the app shows no
   Apple price and reviewers see a website link only.
2. **Age rating:** the in-app Browser plugin means "Unrestricted Web Access" (17+). Also declare
   user-generated content (the social posts and messages).
3. **App Privacy answers:** contact info, user content, health and fitness, purchases, identifiers (the
   notification device token). None used for tracking.
4. **A demo account for App Review**, with a few tasks and one family member, and All Access switched on so
   reviewers can see paid features.
5. **iPad screenshots.** The app is built for iPhone and iPad, so 13-inch iPad screenshots are required.
6. **Review notes:** say that All Access is sold with Apple in-app purchase, and that the US store also
   shows a link to the website.

---

## E. Needs a real iPhone (the final check)

1. Notifications: open the app, Accountability › bell. Your row turns to "On · 1 iPhone" and "Send a test
   to everyone" arrives. Repeat from WorkHub's notification screen.
2. Sign in with Apple, email sign-up with the emailed code, forgot sign-in, sign out, delete account.
3. Buy All Access with a sandbox Apple ID; "Restore purchases" on a second install.
4. Opening the Reader from LifeHub (`goToReader` in `client/src/lib/hubs.ts` goes to `/reader` as a full
   page load inside the app). Confirm it loads and that Back returns to the hub.
5. Night mode: open the upgrade sheet, the All Access pop-up, the notification sheet, DuoSetup and the
   walkthrough with night on. The night stylesheet (`client/src/pages/todoNight.css`) recolors fixed colors
   by pattern, so these should be readable, but none were looked at.
6. Apple Health, iPhone Calendar and Reminders permissions each show their sentence and work after "Allow".
7. iPad: rotate, Split View, and the same sign-up flow.

---

## Appendix: type-check results worth knowing

`tsc --noEmit` at this commit: 0 missing names (TS2304). 545 + 23 are compiler-target noise (TS2802,
TS1501). About 190 are "possibly undefined" warnings, 150 of them in `server/routes.ts`; these were not
reviewed one by one. The ones that are real and near To Duo are items 6, 16 and 18 above. Others, in other
products: `client/src/pages/eye-gaze/MatchPairsGame.tsx` line 37 reads `cols` before it is declared;
`client/src/components/arise-notes/NotesApps.tsx` line 73 compares against `"design"`, which can never
match.
