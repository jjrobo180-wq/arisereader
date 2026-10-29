# A.R.I.S.E. To-Do — iOS App Store preparation

This is the **first native iOS simulator scaffold**, **not a distributable App Store app**. It opens the existing A.R.I.S.E. To-Do web app at https://arisetodo.com/app. This lets us validate native navigation, login, Life Hub, Work Hub and device behavior before replacing the remote-WebView approach with an App Store-quality build.

- Proposed app name: **A.R.I.S.E. To-Do**
- Proposed Bundle ID: `com.arisereader.arisetodo` — register as a **new explicit App ID** under your Apple team.
- Apple platform: **iOS**
- App Store Connect SKU suggestion: `ARISETODO-IOS-001`

The iPhone build is generated and compiled by **GitHub Actions** in `.github/workflows/arisetodo-ios.yml`. No local Terminal steps are needed.

**Important:** A remote-website WebView is only a development scaffold; **do not submit it to App Review**. Before App Store submission, ship locally bundled app content with proper API origin handling, add native capabilities and polish, verify sign-in and account deletion, complete privacy disclosure and data permissions, support access, purchase flows and Apple review requirements. Signing and TestFlight upload require a new App Store Connect app record and Apple signing credentials. The Apple API key previously generated for Pod+ may be reusable only if it has appropriate team-level access; no credentials are copied or committed here.

Native build output from Actions is an unsigned iOS simulator .app. It is **not** a signed TestFlight .ipa.

## Signed release candidate validation

The manual GitHub Actions workflow `.github/workflows/arisetodo-signed-release.yml` attempts an Apple Distribution-signed **device archive**. It expects three repository secrets: `IOS_DISTRIBUTION_CERT_BASE64`, `IOS_DISTRIBUTION_CERT_PASSWORD`, and `IOS_PROVISIONING_PROFILE_BASE64`. The signing certificate must be the one selected in the provisioning profile. If Xcode generated a replacement certificate **after** the profile was created, regenerate the provisioning profile to include the replacement certificate before running signing validation.

The workflow intentionally does **not** upload to TestFlight: the current app embeds a remote website URL, which needs to be converted to a properly bundled/native app and reviewed for Apple's functionality, login, subscription, privacy, and deletion requirements before submission. Its successful completion only proves a device archive can be signed. No App Store submission or TestFlight upload has occurred.
