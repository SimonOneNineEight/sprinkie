# TestFlight release runbook

The path from this repo to a TestFlight link a friend can tap. Steps marked
**Simon** need his accounts; everything else is agent-runnable once those
exist.

The plan below was ratified 2026-09-29 in a grilling session. Names are written
as they are **today**; the app becomes Sprinkie with #55 and the repo follows
with #56. See "Names that stay daily-wlog" for the three that never change.

## Two rings, in order

**Internal (#16).** Simon and the PM, as App Store Connect users. No Beta App
Review, so a build installs minutes after processing. Build 1 is `0.9.0 (1)`,
cut from `main` plus #52 and #53.

**External (#61).** A shareable link for people without an App Store Connect
login. Beta App Review applies the App Store guidelines, so this ring waits on
the privacy documents (#60), a real icon (#58), and English (#32, #37). The
motion pass (#38) and VoiceOver month stepping (#18) are deliberately **not**
gates — neither blocks review, and neither is worth delaying feedback for.

Build 1 is also the vehicle for #49, the round-2 regression pass: both testers
walk `manual-tests.md` on the TestFlight build rather than waiting for a green
pass before cutting one. Build 1 is expected to be rough. The point is to
exercise distribution early, on two devices and two OS versions.

Tell the PM to skip the year view. #51 replaces that surface outright.

## One-time setup

1. **The app name is final (#55).** This gates everything Apple. The bundle
   identifier is permanent from the first upload, so no App ID may be
   registered until the name has settled.
2. **Simon — Apple Developer Program (#59)** (developer.apple.com, $99/yr).
   **Individual** enrollment on Simon's existing personal Apple ID; ID
   verification runs 1–2 days. Organization enrollment was rejected: it needs a
   legal entity and a D-U-N-S number for weeks of lead time, and an Individual
   account can still invite App Store Connect users, which is all the PM needs.
   Register the App ID **with the Sign In with Apple capability** — without it
   `expo prebuild` writes an entitlement no profile accepts (#52). Create the
   app record: name Sprinkie, primary language zh-Hant.
3. **Simon — hosted Supabase project** (supabase.com, free tier). Do not paste
   keys into the repo or the chat; they go into EAS/hosting secret stores in
   step 5. Its data is durable from the PM's first Entry — forward migrations
   only, no destructive migration, ever (ADR-0007).
4. **API host: Cloud Run** (superseded the home box, live by 2026-09-11):
   service `daily-wlog-api`, project `daily-wlog-198`, region us-west1.
   Env rides the revision: `SUPABASE_JWKS_URL` / `SUPABASE_STORAGE_URL`
   as plain vars, `DATABASE_URL` / `SUPABASE_SECRET_KEY` from Secret
   Manager (`database-url`, `supabase-secret-key`). Per-release deploy:

   ```sh
   gcloud run deploy daily-wlog-api --source api --region us-west1
   ```

   Gotchas: health lives at `/health` (Google's front end swallows
   `/healthz`), and `DATABASE_URL` must use Supabase's session pooler
   (direct db hosts are IPv6-only). Schema changes ship separately with
   `supabase db push` before the deploy.

   <details><summary>Former host: Simon's home Linux box (ratified
   2026-08-21 for the TestFlight phase; kept as fallback runbook)</summary>

   deploy/home/ has everything. One-time setup on the box:

   ```sh
   sudo useradd --system --no-create-home daily-wlog
   sudo mkdir -p /opt/daily-wlog /etc/daily-wlog
   sudo cp deploy/home/daily-wlog-*.service deploy/home/daily-wlog-purge.timer /etc/systemd/system/
   sudo cp deploy/home/api.env.example /etc/daily-wlog/api.env
   sudo chmod 600 /etc/daily-wlog/api.env   # then fill in the real values
   sudo systemctl daemon-reload
   sudo systemctl enable --now daily-wlog-purge.timer
   # Public HTTPS without opening router ports:
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   sudo tailscale funnel --bg 8080          # note the https://…ts.net URL
   ```

   Then from the Mac: `DEPLOY_HOST=user@homebox deploy/home/deploy.sh`
   (cross-compiles api + purge, ships them, restarts the service). The
   ts.net URL becomes `EXPO_PUBLIC_API_URL`.

   </details>

   Gotchas baked into api.env.example: use the **session pooler**
   connection string (direct db.<ref> hosts are IPv6-only, and pgx needs
   session mode), and the project must be **migrated to JWT signing keys**
   (Project Settings → JWT Keys) or every token verification 401s.
5. **Wire secrets (#57).**
   - Hosted Supabase: apply `supabase/migrations/` via `supabase link` +
     `supabase db push`; create the private `photos` bucket per
     `supabase/config.toml` (10MiB, image/jpeg).
   - API host: the four env vars above, from the hosted project's settings.
   - EAS: `eas init` first — the project has no Expo project id or owner yet.
     Then `eas env:create` for `EXPO_PUBLIC_SUPABASE_URL`,
     `EXPO_PUBLIC_SUPABASE_KEY` (publishable key only — never the secret),
     `EXPO_PUBLIC_API_URL` (the deployed API's URL).
   - The App Store Connect app id goes into the production submit profile once
     the app record from step 2 exists.
6. **Auth providers** (Supabase dashboard → Authentication). Google: the OAuth
   client ids tracked on closed #4. Apple: add the **bundle identifier to the
   provider's Client IDs list** — that is all the native `signInWithIdToken`
   flow needs. The Services ID and `.p8` key belong to the web redirect flow,
   which this app does not use; do not generate one.

## Build config

- **Version.** The beta runs `0.9.x`; `1.0.0` is reserved for the App Store
  launch. The production profile auto-increments the build number, so only the
  marketing version is ever set by hand.
- **Export compliance.** ADR-0004 confirms there is no client-side encryption,
  only TLS, which is exempt — so `app.json` declares
  `ITSAppUsesNonExemptEncryption: false`. Without it every single upload stops
  and asks the encryption question by hand.

## Per-release

Walk `manual-tests.md` on a device first: the whole document before a build,
the **[API]** cases after any `gcloud run deploy`. Post the run as a comment on
the release issue, naming the build and the Cloud Run revision it tested.

**Build 1 is the exception** — its pass runs on the TestFlight build itself, by
both testers, because the distribution path is as untested as the app is.

```sh
cd apps/mobile
eas build --platform ios --profile production
eas submit --platform ios
```

Then App Store Connect → TestFlight. Internal testers (up to 100, no review)
first; the external group opens only when #61's gates are met.

## Names that stay daily-wlog

Three names are **not** part of the rename, and a repo-wide search will always
find them. They are console-only strings; nobody on the team reads them daily.

- **GCP project id `daily-wlog-198`** — project ids cannot be renamed, only
  recreated, which would mean new Secret Manager secrets, re-linked billing,
  and a redeploy.
- **The Supabase project ref** — immutable, and it lives in the project URL.
- **Cloud Run service `daily-wlog-api`** — its name is in the URL, so renaming
  it means a new `EXPO_PUBLIC_API_URL` and another build.

This is deliberate (#56). Do not file it as unfinished rename work.

## Already in the repo

- `apps/mobile/eas.json` — development / preview / production profiles. No
  Expo project id, owner, or App Store Connect app id yet; #57 adds them.
- `apps/mobile/app.json` — bundle id `com.simononenineeight.dailywlog`
  (becomes `…sprinkie` with #55, and is permanent from the first upload),
  light-only UI, zh_TW region, camera/photo permission copy, placeholder icon
  (the app's + mark; #58 replaces it). Apple sign-in is declared **off**
  (`usesAppleSignIn: false`) while #52 is open, even though the sign-in screen
  offers the button.
- `api/cmd/purge` — the 30-day account purge binary for step 4's schedule.

## App Store privacy questionnaire (answer truthfully)

Data collected, linked to identity:
- **User content**: journal entries (opaque blobs server-side, never parsed —
  ADR-0004), photos. Purpose: app functionality. Not used for tracking, not
  shared with third parties.
- **Identifiers / contact info**: account id and email (via Apple/Google
  sign-in through Supabase Auth). Purpose: app functionality.
- No analytics SDK, no advertising, no tracking. Sentry collects crash
  data (not linked to identity beyond what a crash trace carries).
- Account deletion: in-app (設定 → 刪除帳號), 30-day grace, then permanent
  purge — App Store guideline 5.1.1(v) satisfied.

#60 turns these answers into the published privacy policy. Nothing in that
document may contradict this list.

## Still open before external testers (#61)

- Privacy policy + terms documents at a stable public URL, reachable from two
  new 設定 rows (#60). App Store Connect wants the privacy policy URL.
- A real app icon from the PM, replacing the placeholder (#58).
- English shipped (#32, #37).

**Not gates**, recorded so nobody re-adds them: the second half of the motion
pass (#38 — press states shipped in `theme/press.tsx`, but the 150ms selection,
240ms content-swap and 300ms screen-push token timings are unimplemented, so
route changes are instant cuts) and VoiceOver month stepping (#18).
