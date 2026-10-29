# A.R.I.S.E. To-Do — iOS App Store preparation

This is the **first native iOS simulator scaffold**, **not a distributable App Store app**. It opens the existing A.R.I.S.E. To-Do web app at https://arisetodo.com/app. This lets us validate native navigation, login, Life Hub, Work Hub and device behavior before replacing the remote-WebView approach with an App Store-quality build.

- Proposed app name: **A.R.I.S.E. To-Do**
- Proposed Bundle ID: `com.arisereader.arisetodo` — register as a **new explicit App ID** under your Apple team.
- Apple platform: **iOS**
- App Store Connect SKU suggestion: `ARISETODO-IOS-001`

The iPhone build is generated and compiled by **GitHub Actions** in `.github/workflows/arisetodo-ios.yml`. No local Terminal steps are needed.

**Important:** A remote-website WebView is only a development scaffold; **do not submit it to App Review**. Before App Store submission, ship locally bundled app content with proper API origin handling, add native capabilities and polish, verify sign-in and account deletion, complete privacy disclosure and data permissions, support access, purchase flows and Apple review requirements. Signing and TestFlight upload require a new App Store Connect app record and Apple signing credentials. The Apple API key previously generated for Pod+ may be reusable only if it has appropriate team-level access; no credentials are copied or committed here.

Native build output from Actions is an unsigned iOS simulator .app. It is **not** a signed TestFlight .ipa.
