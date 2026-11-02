# Pod+ — Apple App Store iOS preparation

This directory starts a **real iOS project** from the existing Pod+ app (podcast player + Social) using Capacitor 8. It is an **early development scaffold**, **not yet an App Store-ready binary**. Do not submit a bare web wrapper: Apple Guideline 4.2 requires an app experience beyond a repackaged website.

## Build from this repository

**You do not need to install Node or use Terminal on your Mac to compile our first simulator app.** GitHub Actions runs the Mac build automatically in `.github/workflows/podplus-ios.yml`. For a signed TestFlight build, Apple credentials and release signing must still be configured securely. Local builds are optional.

1. In the repository root: `npm ci`
2. Build Pod+: `PODPLUS_IOS=1 npx vite build --config podscroll/vite.config.ts`
3. Make the actual Pod+ player the launch page (not the marketing homepage): `node podscroll/ios-app/prepare-web.mjs`
4. `cd podscroll/ios-app && npm install`
5. On first build only: `npx cap add ios`; on subsequent builds: `npx cap sync ios`. The GitHub Actions workflow generates this project on its Mac runner.
6. `npx cap open ios` to open the generated workspace in Xcode. Select your own Apple development team and run on an iPhone.
7. Validate sign-in, audio playback with screen locked, Social posts, camera/photos, upload, microphone, and navigation; then create an archive and upload it to TestFlight through Xcode once signing is configured.

The provisional bundle ID is `com.arisereader.podplus` — confirm availability and ownership in your Apple Developer account before signing or publishing. Do **not** add Apple certificates, private keys, or App Store Connect API secrets to GitHub.

## Blockers before App Review

- **Native iOS quality (Guideline 4.2):** add genuine native interactions (share sheet, background audio controls, haptics, deep linking, push notifications where appropriate) and verify offline/error states. A webview alone may be rejected.
- **Account deletion (5.1.1(v)):** Pod+ currently has sign-in and sign-out. Implement a verified, accessible account-deletion flow that removes the Pod+ account and associated posts, media, and personal information.
- **Social safety (1.2):** verify public contact details, actionable report queue and timely response, content filtering, blocking, community rules and age suitability; moderation calls alone do not prove compliance.
- **App privacy:** publicly available policy URL, accurate App Store privacy nutrition labels, explain use of email/session/device IDs, listening history and private messages.
- **Payments:** audit any creator memberships/paid digital features against App Store 3.1 before launching.
- **Accessibility and audio:** test VoiceOver, Dynamic Type, background and interrupted playback, headphones, network loss, and iOS memory constraints.
- **App Store listing:** brand artwork (1024x1024 icon), real iPhone screenshots, subtitle, description, age rating, category, support URL, privacy URL, review contact and demo account/review instructions.
- **Signing:** enroll at https://developer.apple.com/programs/ and create the app record in https://appstoreconnect.apple.com/.

The GitHub Actions workflow compiles an **unsigned simulator .app**. It cannot be installed through TestFlight. This scaffold does **not** configure signing, upload a TestFlight build, submit to Apple, or assert Apple approval. Apple's App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/

## App Store readiness (October 2026)

Done in the app and on the server:
- **Background audio:** podcasts, audiobooks and radio keep playing with the screen locked (`configure-ios.py` adds `UIBackgroundModes: audio`).
- **Permissions:** a sentence for Camera, Photos and Microphone; export compliance answered.
- **Pod+ Social safety (1.2):** community rules agreed to before making a profile (zero tolerance), a word and photo filter before anything is posted, report a post, reply, story, message or person (with a reason), block from profiles, replies and chats, posts hidden after 3 reports, and every report emailed to the admin (look within 24 hours).
- **Account deletion (5.1.1(v)):** menu → Account & privacy → Delete my account (or Delete my data without an account).
- **Privacy Policy / Terms / Support:** https://podscroll.onrender.com/privacy/, /terms/, /support/.

Still yours to do in App Store Connect: the Privacy Policy and Support URLs above, App Privacy answers (email, user content, identifiers; none used for tracking), an age rating of 13+ or higher for Pod+ Social, screenshots, and App Review notes (no account needed to listen; email sign-in for Social).
