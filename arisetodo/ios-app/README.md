# Arise To Duo: iPhone app

Arise To Duo for iPhone and iPad (bundle ID `com.arisereader.arisetodo`). It is a Capacitor app with the web code
**bundled inside it**, so it opens without a connection and talks to https://arisetodo.com for sign-in, sync and AI.

- **Build:** GitHub Actions, never a local Terminal. `.github/workflows/arisetodo-ios.yml` builds an unsigned simulator app;
  `.github/workflows/arisetodo-signed-release.yml` makes the signed device archive (HealthKit, Sign in with Apple, push,
  app groups, widgets, Apple Watch and Apple TV apps). It uploads to TestFlight only for a commit message containing
  `[approved-testflight]` or a manual run with the upload option.
- **Live updates:** web-code changes reach installed apps without a new App Store build (`.github/workflows/ota-publish.yml`,
  `@capgo/capacitor-updater`). A new copy is used the next time the app is opened, so a screen never reloads while someone is
  using it. `.github/scripts/prune_todo_bundle.sh` takes other products' files (the eye-gaze engine) out of the bundle first.
- **Purchases:** Arise All Access is sold with Apple in-app purchase. In the US App Store the app may also link to the website,
  where it shows the website price; elsewhere it shows only the Apple price.
- **Privacy:** `PrivacyInfo.xcprivacy` goes into the app and each extension (`.github/scripts/add_privacy_manifest.rb`).
  Every permission has its sentence in `configure-ios.py`, and AI features ask before the first request
  (`client/src/lib/aiConsent.ts`).
- **Account deletion:** ⋯ → Account & privacy → Delete my account. Privacy Policy, Terms and Support are at
  https://arisetodo.com/privacy/, /terms/ and /support/.

Still done by hand in App Store Connect: app name and subtitle, App Privacy answers, age rating, screenshots (iPhone and
13-inch iPad), a demo account and review notes, and attaching the All Access subscription to the version.
See `docs/audits/arise-to-duo-app-store-audit.md`.
