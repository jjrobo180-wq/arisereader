# Arise Notes iPhone app

The AI note taker (`client/src/components/arise-notes/`) as its own iPhone app, `com.arisereader.notes`.
It is the shared frontend built with `VITE_NATIVE_APP=notes`: it opens to the iPhone sign-in screen
(`client/src/pages/NativeSignIn.tsx`), then Arise Notes (`App.tsx`, `isNotesApp()`).

- Built and sent to TestFlight by `.github/workflows/notes-ios.yml`: push to `feat/notes-testflight`
  with `[approved-testflight]` in the commit message.
- Live updates (web code without a new App Store build) come from `/api/ota/notes`.
- The microphone permission text is set by `.github/scripts/configure_fit_app.py notes`.
- Plans aren't sold in the app (App Review 3.1.1): Settings → Plan shows the minutes only.
- Recording stops if the iPhone locks or the app goes to the background; keep the app open while recording.
