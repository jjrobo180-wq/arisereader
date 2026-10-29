# A.R.I.S.E. Reader internal iOS beta

Bundle ID: `com.arisereader.reader`. The app bundles the shared frontend locally with `VITE_NATIVE_APP=reader`; it starts at the Reader student sign-in and keeps adult Reader navigation in the app. API calls use the existing Reader backend.

The Reader iOS workflow compiles and launches an iPhone simulator, signs with the existing distribution certificate and a Reader-specific App Store profile, and validates the IPA. Only release commits containing `[approved-testflight]` upload to TestFlight. It never submits public App Review.

Device sign-in, classroom activities, audio, camera/eye-gaze and network behavior require internal testing before any public release.
