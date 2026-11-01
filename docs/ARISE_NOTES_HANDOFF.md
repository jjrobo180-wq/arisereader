# Arise Notes: handoff notes

This branch, `feat/arise-notes`, holds the AI note taker. It's a **draft**: it hasn't been merged or deployed. The build spec is the "Arise Notes: AI note taker build spec" the owner sent. Follow its build order and acceptance checks.

## Where things stand

### Done (written)

**Database: live on Supabase**

The `swsyalnajzizfwazqwpd` project already has these. The SQL is in `migrations/arise_notes.sql`.
- **Tables:**
  - `arise_notes_accounts`
  - `arise_notes`
  - `arise_notes_pieces`
  - `arise_notes_segments`
  - `arise_notes_actions`
  - `arise_notes_usage`
  - `arise_notes_family`
- **Row-level security:** on, with no policies, so everything goes through the server.
- **RPCs:**
  - `arise_notes_charge`: an atomic per-recording round-up charge. It was checked against the live database.
  - `arise_notes_search` and `arise_notes_find`: full-text search.
- **Storage:** private bucket `arise-notes-audio`.
- **Cleanup:** two test rows can be deleted: `delete from arise_notes where owner_id=-9; delete from arise_notes_accounts where user_id=-9;`

**Shared rules: `shared/ariseNotes.ts`**
- Plans and limits from the spec. Free / Basic / Plus / Family are gated by `allows()`.
- Metering: `rollAccount` (rollover), `usageView`, `transcribeCheck` (plus the hard cap of 3,000), `chargeFor` / `minutesFor` (round up per recording), and `warningDue` (80% and 100%).
- Templates, summary/IEP/study/memo cleaners, prompts, and export text/HTML.

**Server**
- **`server/ariseNotes.ts`:** all routes under `/api/notes/*`:
  - me, settings, list, create, get, patch, delete
  - pieces (raw audio), resume, finish
  - segment edits, audio links
  - summary (map-reduce for long transcripts), parent email, translate, study, study→Reader quiz
  - hubs/targets, send (to-dos and events into LifeHub/WorkHub), IEP into WorkHub
  - memo, ask (keyword plan → FTS → cited answer)
  - email, share link, public shared view
  - family code/join/remove, wipe (delete everything), admin usage
  - Also an audio sweeper for the 30-day setting.
- **`server/ariseNotesStore.ts`:** a Supabase store, plus an in-memory store for tests.
- **`server/ariseNotesAi.ts`:**
  - Speech-to-text order: Groq Whisper first, then Deepgram, then OpenAI (only with `USE_OPENAI=1`).
  - Speaker labels need Deepgram or real OpenAI.
  - LLM calls go through the site's existing route, which is Groq/Grok/Perplexity because OpenAI is off on this site.
- **`server/ariseNotesHubs.ts`:** safe read-modify-write into `arise_todo_workspaces` and `teacher_hub_workspaces`, retrying on conflicts.
- **Billing:**
  - `server/plans.ts` routes: `/api/notes/billing`, `/checkout`, `/change` (changes the plan in place on the same subscription), and `/portal`.
  - Plan kinds in `shared/plans.ts`: `notes_basic`, `notes_plus`, `notes_plus_year`, `notes_family`.
  - Admins can grant these in Admin → Plans.
- **Wiring:** `server/routes.ts` registers the routes. `server/index.ts` adds raw-body parsing for `/api/notes/:id/pieces` and `/api/notes/memo`.

**Client (`client/src/components/arise-notes/`)**
- **App and screens:**
  - `NotesApp.tsx`: the shell, home and router.
  - `RecordScreen` (a new piece every 5 minutes, highlights, pause, wake lock, consent), `UploadScreen`.
  - `NoteScreen` with `noteSheets` (planner review, IEP filing, share/export, settings) and `noteTools` (parent email, translate, flashcards and quiz, split screen).
  - `AskScreen`, `MemoScreen`, `SettingsScreen` (plan and billing, family, privacy and delete-everything, accessibility), `PrivacyPage` (FERPA and COPPA).
- **Helpers:**
  - `audioSplit.ts`: splits on the device. Tested with ffmpeg files: MP3, M4A, MP4/MOV video and WAV, including 2-hour files that became 12 pieces with exact durations.
  - `recorder.ts`, `sender.ts`, `player.ts`.
  - `exporters.ts`: PDF and DOCX made on the device. Checked with qpdf, LibreOffice and python-docx.
- **Standalone app:**
  - `client/notes/index.html` + `client/src/notes/main.tsx`: the app at `/notes/`, with sign-in, sign-up and the public share view at `/notes/#/s/<token>`.
  - Install manifest and icons are in `client/public/notes-app/`.
  - `vite.config.ts` now has two inputs.
- **Inside To Duo:**
  - Route `#/arise-notes?hub=life|work` (`client/src/pages/AriseNotesPage.tsx`).
  - App Store entry `${hub}-arise-notes` in `shared/pluginStore.ts` (OFFICE_APPS).
  - Split-screen pane `arisenotes` in `client/src/lib/duoSplit.ts`.

### NOT done yet (next steps, in order)

1. **Get CI green.** `npx tsx --test tests/*.test.ts` and `npm run build`. Nothing has been type-checked on the client yet, because no React types were available locally. Fix any TS or runtime errors. Watch these in particular:
   - There's a lucide icon fallback: `NotebookPen` may not be in `STORE_ICONS`, in which case it falls back to Sparkles.
   - Some existing tests check `shared/pluginStore.ts` and the plan kinds lists. Update them if they fail, for example tests that count `PLAN_KINDS`, or a `KIND_LABEL` in AdminPlans that needs every kind; it was already updated.
2. **Write the automated tests the spec requires**, for example in `tests/arise-notes.test.ts`, using `createMemoryNotesStore` and a fake `hear`/`ask`:
   - Metering: minutes charged, per-recording round-up, blocked at 0 minutes with "Out of minutes: upgrade or wait until <date>.", rollover, and the 3,000-minute cap.
   - Permissions: one user can't read another's note (404).
   - Billing webhook: the notes kinds go through `plans.applyEvent`.
   - Splitter: tiny fixture files.
3. **Run the UI locally.** A harness was being built in the scratchpad: a mini Express shim running the real routes, Tailwind and Playwright. Tailwind 4 is the local CLI, but the project uses Tailwind 3. Alternatively, test on a Vercel/Render preview.
4. **Open a PR, merge** (the owner's rule: merge finished PRs without asking), then **check on the live site** at arisetodo.com/notes/: upload a short speech file, then check the transcript, the summary, Add to planner, and the PDF/Word exports.
5. **Owner actions to mention**, with links:
   - A Deepgram key (`DEEPGRAM_API_KEY`) for speaker labels and a fallback: https://console.deepgram.com
   - The Groq paid tier for volume: https://console.groq.com/settings/billing
   - The Stripe webhook already exists. Checkout uses inline prices, so nothing needs to be created in Stripe.

## Things to know
- **Owner rules:**
  - Always give the direct link when the owner has to do something.
  - Merge finished PRs without asking.
  - Ask before adding unrequested things to their sites.
  - Never say something works unless it was checked on the path they use.
  - TTS must be a real AI voice: use `sayAI` from `@/lib/aiVoice`.
- **Testing locally:**
  - Run tests with `/opt/npm-tools/node_modules/.bin/esbuild <test> --bundle --platform=node --format=esm --alias:@shared=./shared --alias:@=./client/src --packages=external`, then `node --test`.
  - npm installs are blocked in that sandbox, and `express`, `@supabase` and React types are missing locally. CI (`.github/workflows/all-tests.yml`) runs everything.
- **The Eye Gazer separate-login work was dropped** on the owner's instruction.
