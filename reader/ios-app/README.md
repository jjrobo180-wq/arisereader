# Arise Reader (iPhone)

Arise Reader for students (bundle ID `com.arisereader.reader`), built by `.github/workflows/arisereader-ios.yml` from the
shared frontend with `VITE_NATIVE_APP=reader`. A push to `feat/arisereader-testflight` whose message has
`[approved-testflight]` uploads the build to TestFlight.

**No live updates** (App Review 2.5.2 / 2.5.19): the app runs only the web code in the build Apple reviewed. Every change
reaches the iPhone app in a new App Store build, and its Review Notes list what's new since the last version.

- Nov 25, 2026: build with CGMS-only prizes, school-only leaderboards by initials, and no Beginners, Math, History or Connect.
