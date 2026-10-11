# Two A.R.I.S.E. iOS apps — preparation branch

This project now has two **separate native iOS app configurations** using one existing React/Vite frontend and the same Express API/database.

| App Store app | Source directory | iOS bundle ID (proposed) | First-launch route |
| --- | --- | --- | --- |
| A.R.I.S.E. Reader | `mobile/reader` | `com.arisereader.reader` | `/#/signin` |
| A.R.I.S.E. To-Do | `mobile/todo` | `com.arisetodo.app` | `/#/lifehub` |

**Status: DEVELOPMENT SCAFFOLD. NOT TESTED IN XCODE OR READY FOR APP REVIEW.**
The master branch and production deployment have not changed.

## What is reused

- Student, teacher, parent and To-Do accounts use the **existing online backend**.
- Both native builds compile the existing frontend separately using `VITE_ARISE_NATIVE_APP`.
- Only the app's initial destination is different; both still include the shared frontend code. Before submission, audit navigation so each listing delivers the advertised features without unexpectedly switching products.
- `nativeAppBridge.ts` forwards relative `/api/*` requests to the existing HTTPS server and attaches the session bearer token when available. Each iOS app stores its own local session. Users can sign into each with the same credentials; this is **not** automatic cross-app single sign-on.
- CapacitorHttp is enabled to support native cross-origin fetch. File uploads, streams, sockets, cookie authentication and native permissions **must be tested**. Any API call not using `window.fetch` may need separate integration.

## Generate the two Xcode projects (on a Mac)

Requirements: Node 22+, npm, Xcode 26+, and the Xcode Command Line Tools. These instructions target Capacitor 8.

From the repository root:

```sh
npm install
cd mobile/reader
npm install
npm run build:web
npm run ios:add
npm run ios:open
```

In Xcode, set signing/team and verify `com.arisereader.reader`.

For To-Do, return to the repository root:

```sh
cd mobile/todo
npm install
npm run build:web
npm run ios:add
npm run ios:open
```

In Xcode, set signing/team and verify `com.arisetodo.app`.

**Important:** `build:web` rebuilds the shared `dist/public` staging directory; then copies it to the chosen app's `www/` directory. Each app's `www/` and generated `node_modules/` are ignored by Git. After a web code change, run `npm run ios:sync` from the corresponding app folder and rebuild in Xcode. Keep the generated `ios/` Xcode projects in version control after testing.

## Before shipping: blocking QA

1. Native login/register/logout and seven-day return sessions. Confirm `/api/me`, quiz scores, proctoring, leaderboard, teacher pages, and LifeHub cloud save. Verify server authorizes bearer tokens for all protected endpoints. Ensure no student data leaks between app accounts.
2. Audit all `fetch`, `XMLHttpRequest`, iframe, Socket/WebSocket, media, file upload and absolute-root asset calls from `capacitor://localhost`. The current bridge covers relative `fetch('/api/...')` only; it is **not** a complete API migration.
3. Give **different native icons, splash screens and metadata** to Reader and To-Do, and confirm each app has its own focused navigation.
4. Test iPhone and iPad: camera, microphone, voice/audio, videos, 3D games, downloads, keyboard, safe areas and accessibility. Add truthful Info.plist permission usage descriptions for each feature. Review Apple Health access if enabled in To-Do.
5. Account deletion within each app, student/child privacy, age ratings, privacy-policy URL, accurate App Privacy labels, accessibility and content moderation/reporting where users interact.
6. Check App Review Guidelines 4.2 (minimum functionality), 4.3 (similar apps), 5.1 (privacy), 3.1 (digital purchases). Confirm purchase/subscription flows comply, especially Teacher Hub/To-Do upgrades.
7. Test with limited-access, teacher, parent, student, Eye Gazer and independent student accounts. Verify that school records and personal To-Do information remain separate.
8. Create two separate app records in App Store Connect with the actual reserved bundle IDs. Prepare localized descriptions, screenshots (actual running app), support URL, privacy policy, review notes, and demo credentials. Test both with TestFlight before submitting.

## Apple actions requiring the account owner

- Enroll in the Apple Developer Program; one membership can publish both apps.
- Register **two distinct bundle IDs** in the Apple Developer portal and create **two app records** in App Store Connect.
- Configure signing/certificates, application icons, capabilities, privacy disclosures, TestFlight testers and release submission.
- Submit final builds after QA. This branch does **not** create or submit an IPA.

Official references:
- Capacitor setup: https://capacitorjs.com/docs/getting-started/environment-setup
- iOS setup: https://capacitorjs.com/docs/ios
- App records: https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/
- Review guidelines: https://developer.apple.com/app-store/review/guidelines/
- Account deletion: https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion
