# A.R.I.S.E. Fit — standalone development build

Working responsive **local-first prototype** for a future A.R.I.S.E. Fit app. Its own directory keeps A.R.I.S.E. Reader, Arise To Duo and Pod+ untouched.

## Implemented
- Dashboard with calories, protein, water, steps and movement summaries.
- Food diary by meal, custom foods, servings and a small example nutrition list.
- Movement journal with time and optional MET-based energy estimate using last weigh-in.
- Manual water, step and weight tracking.
- Seven-day food chart, weight trend, editable goals and date navigation.
- Delete entries, clearly labeled optional sample data, JSON export/import.
- Responsive desktop/phone layout, installable web manifest and offline service worker.
- Imported backup normalization and HTML escaping for user-entered names.

## Run

From the repository root, run: python3 -m http.server 8787 --directory arise-fit

Open http://localhost:8787

Basic checks: node --check arise-fit/app.js

## Scope and limitations
- Not production, App Store or TestFlight ready.
- Browser-only localStorage; no cloud sync, user accounts, Supabase or Apple Health.
- Food/MET values and example goals are illustrative and not medical advice.
- Data can be lost when browser site data is cleared. Export first.
- This isolated foundation follows the fitness work found in the existing monorepo; it is **not** claimed to recover a previous standalone A.R.I.S.E. Fit build.

## Next
Authenticated backend with RLS; HealthKit sync; verified food search and barcode lookup; iOS shell and TestFlight; end-to-end device QA.
