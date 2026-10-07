# TestFlight release runbook

The path from this repo to a TestFlight link a friend can tap. Steps marked
**Simon** need his accounts; everything else is agent-runnable once those
exist.

The plan below was ratified 2026-09-29 in a grilling session. The app is
Sprinkie as of #55 and the repo as of #56. See "Names that stay daily-wlog" for
the four that a search still finds, and why.

## Two rings, in order

**Internal (#16).** Simon and the PM, as App Store Connect users. No Beta App
Review, so a build installs minutes after processing. Build 1 carries marketing
version `0.9.0`, cut from `main` plus #52 and #53. Its build *number* is not
pinned here: EAS holds it remotely and `autoIncrement` moves it on every
attempt, including ones that fail before building, so it was already past 1
before the first real build. See "Build config" for what is chosen by hand.

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
2. **Apple Developer Program (#59) — done 2026-10-05.** **Individual**
   enrollment on Simon's existing personal Apple ID. Organization enrollment was
   rejected: it needs a legal entity and a D-U-N-S number for weeks of lead
   time, and an Individual account can still invite App Store Connect users,
   which is all the PM needs. What exists now:

   | | |
   | --- | --- |
   | Team id | `8CQBP36BAC` |
   | App ID | `com.simononenineeight.sprinkie`, explicit, **Sign In with Apple** ticked |
   | App record | Sprinkie, primary language zh-Hant |
   | App Store Connect app id | `6819454740` (in `eas.json` → `submit.production`) |
   | PM | invited as **App Manager**, which is TestFlight access without user management |

   Sign In with Apple is the only capability the App ID carries, and the only
   one the app needs: `expo-apple-authentication` is the sole dependency that
   maps to one. Google sign-in works through a URL scheme and photo access
   through a privacy string, both `Info.plist`, neither a capability. The
   capability had to exist **before** `usesAppleSignIn` was flipped to `true` in
   `app.json` — the other order writes an entitlement no profile accepts (#52).
   Capabilities stay editable afterwards, and EAS regenerates profiles on the
   next build, so adding one later costs a rebuild and nothing else.

   One identifier is left over from before the rename:
   `com.simononenineeight.dailywlog`, auto-created by Xcode (the `XC` prefix).
   Nothing uses it.

   **Not done, and not blocking the internal ring:** EU trader status. It gates
   *submission* for EU distribution, so #16 is unaffected, but #61 and any App
   Store release need it declared or EU availability turned off.
3. **Simon — hosted Supabase project** (supabase.com, free tier). Do not paste
   keys into the repo or the chat; they go into EAS/hosting secret stores in
   step 5. Its data is durable from the PM's first Entry — forward migrations
   only, no destructive migration, ever (ADR-0007). Display name set to Sprinkie
   on 2026-10-06, which closed #56. It had to be done in the dashboard
   (Project Settings → General) because the CLI has no rename subcommand. The
   ref `tebfjmsmnhfeapbzytxy` never changes and is what every connection
   string uses, so the name is cosmetic.
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
   sudo useradd --system --no-create-home sprinkie
   sudo mkdir -p /opt/sprinkie /etc/sprinkie
   sudo cp deploy/home/sprinkie-*.service deploy/home/sprinkie-purge.timer /etc/systemd/system/
   sudo cp deploy/home/api.env.example /etc/sprinkie/api.env
   sudo chmod 600 /etc/sprinkie/api.env   # then fill in the real values
   sudo systemctl daemon-reload
   sudo systemctl enable --now sprinkie-purge.timer
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

   **The Postgres log is permanently full of errors, and that is correct.**
   Roughly 112 an hour, one every ~32 seconds:

   ```
   ERROR  schema "pg_pgrst_no_exposed_schemas" does not exist
   ```

   That name is the sentinel Supabase uses when **no schemas are exposed to
   PostgREST**. Supabase runs PostgREST whether or not anything uses it, and
   it reloads its schema cache on a timer; with nothing exposed it looks for
   that placeholder, fails, and logs. Forever.

   Nothing is wrong. This app reaches Supabase for **auth only** —
   `supabase.auth.getSession` and `onAuthStateChange`, no `.from()` and no
   `.rpc()` anywhere. Data goes through the Go API over pgx as the service
   role, and every table carries RLS enabled with **no policies**, which is
   deny-all for everyone the service role is not. Exposing no schemas is the
   posture that matches.

   Do **not** silence it by adding `public` back under Project Settings → API.
   That switches on a REST API over the tables to serve a client that does not
   exist. Deny-all RLS means anon would read nothing, so it is not quite
   dangerous, but it is surface for no gain.

   The real cost is that this log cannot be used to spot a genuine problem:
   anything true would be buried in the noise. Judge database health from the
   API's own logs instead.
5. **Wire secrets (#57).**
   - Hosted Supabase: apply `supabase/migrations/` via `supabase link` +
     `supabase db push`. On a fresh project, first create the `photos`
     bucket under Storage → New bucket with the values in
     `[storage.buckets.photos]` of `supabase/config.toml` (private, 10MiB,
     image/jpeg).
   - Then run `deploy/check-photos-bucket.sh`, on every release pass and not
     only the first. It reads the hosted bucket and fails unless it matches
     `config.toml`: `db push` does not carry bucket settings, and with photo
     bytes going straight to Storage (ADR-0002) the bucket is the only limit
     on an upload's size. It needs `supabase login`, and it uses the link in
     the main checkout, so a `supabase link` made inside a worktree is not
     seen. It last passed on 2026-10-07 (#54).
   - API host: the four env vars above, from the hosted project's settings.
   - EAS: **done in #57.** The project is `@simon198tw/sprinkie` and its five
     `EXPO_PUBLIC_*` variables live in the `production` and `preview`
     environments. The set is every variable the app reads, not a shorter list:
     #57's criteria named only the Supabase pair and the API URL, and a build
     carrying just those three ships `undefined` Google client IDs and a
     sign-in screen where neither provider works. Check
     `grep -rn EXPO_PUBLIC_ apps/mobile/src` against `pnpm dlx eas-cli@latest env:list production`
     whenever either changes.
   - The App Store Connect app id goes into the production submit profile once
     the app record from step 2 exists.
6. **Auth providers** (Supabase dashboard → Authentication). Google: the OAuth
   client ids tracked on closed #4. Apple: add the **bundle identifier to the
   provider's Client IDs list** — that is all the native `signInWithIdToken`
   flow needs. The Services ID and `.p8` key belong to the web redirect flow,
   which this app does not use; do not generate one.

   **Still to do for #52:** `com.simononenineeight.sprinkie` is not yet in that
   Client IDs list. The App ID now carries the capability and `app.json` asks
   for it, so a build will offer the Apple button and Supabase will reject the
   token until this is set. Dashboard-only, so no agent can do it.
7. **Publish the legal documents (#60), before any build reaches a phone.**
   `設定 → 隱私權政策 / 服務條款` already ship and already point at
   `simononenineeight.github.io/sprinkie`, so until the site exists those two
   rows open a 404. Two steps, in order:
   - **Simon**: create the privacy contact address and replace the
     `PRIVACY_CONTACT_EMAIL` placeholder in `site/`. `deploy/publish-site.sh`
     refuses to publish while it is there, which is deliberate — a policy naming
     an address nobody reads is worse than no policy.
   - `sh deploy/publish-site.sh`, then enable GitHub Pages on the `gh-pages`
     branch once. The privacy policy URL also goes into the App Store Connect
     app record from step 2.

## Build config

- **Version.** The beta runs `0.9.x`; `1.0.0` is reserved for the App Store
  launch. The production profile auto-increments the build number, so only the
  marketing version is ever set by hand.
- **Export compliance.** ADR-0004 confirms there is no client-side encryption,
  only TLS, which is exempt — so `app.json` declares
  `ITSAppUsesNonExemptEncryption: false`. Without it every single upload stops
  and asks the encryption question by hand. **This declaration expires with
  ADR-0004.** That ADR returns E2EE to the table before public launch, and the
  day client-side encryption ships, `false` becomes an untrue answer to Apple —
  so whoever implements E2EE flips this and answers the export questions
  properly, rather than inheriting a declaration that was true when written.
- **OTA updates (#57).** `expo-updates` is installed and each build profile
  carries a channel, so a JS-only fix reaches testers with `pnpm dlx eas-cli@latest update --branch
  production` instead of a new TestFlight build and another Beta App Review —
  which works because the `production` channel points at the `production`
  branch; a channel aimed at no branch delivers nothing, silently.
  Two constraints that bite if you forget them:
  - **`runtimeVersion` is `{"policy": "appVersion"}`**, so an update only
    reaches builds whose marketing version matches. Bump `0.9.0` to `0.9.1` and
    every already-installed build stops receiving updates until it is replaced.
    That is the trade for not having to reason about native compatibility by
    hand.
  - **Native changes never travel over the air.** A new dependency with native
    code, a permission, or anything in `app.json` that lands in `Info.plist`
    needs a fresh build. Shipping such a change as an update produces a binary
    whose JS expects native code it does not have.

  **What a round trip looks like** (first one, #65, 2026-10-06). The update
  "The year view becomes a ribbon" was published with the command above and
  appeared in `eas update:list --branch production` as one group on runtime
  `0.9.0`. On the TestFlight build, the app was opened, left in the foreground
  for about two minutes, then force-quit and reopened, and the reopened app
  showed the ribbon. That matches `expo-updates`' default: the launch that
  finds an update downloads it in the background and keeps running the JS it
  started with, and the next cold launch runs the new bundle. The two minutes
  is an upper bound, not a measurement; nobody watched for the download to
  finish.

  **A tester cannot tell.** Nothing on screen says an update arrived or is
  waiting, and backgrounding the app and returning to it is not a launch. So
  after a publish, tell testers to open the app, wait a minute, force-quit, and
  reopen, and before trusting a report, ask whether they did.

## Per-release

Walk `manual-tests.md` on a device first: the whole document before a build,
the **[API]** cases after any `gcloud run deploy`. Post the run as a comment on
the release issue, naming the build and the Cloud Run revision it tested.

**Build 1 is the exception** — its pass runs on the TestFlight build itself, by
both testers, because the distribution path is as untested as the app is.

```sh
cd apps/mobile
pnpm dlx eas-cli@latest build --platform ios --profile production
pnpm dlx eas-cli@latest submit --platform ios
```

`eas-cli` is deliberately not a dependency and not installed globally:
`pnpm dlx` fetches it per run, so there is nothing to keep current and
nothing that can drift from what EAS expects. Every `eas …` elsewhere in
this document runs the same way.

Then App Store Connect → TestFlight. Internal testers (up to 100, no review)
first; the external group opens only when #61's gates are met.

## Names that stay daily-wlog

Six entries below are **not** part of the rename, and a repo-wide search will
always find them. The list covers every old name still *in use*, and is meant to
be exhaustive: if a search turns up a live one it does not cover, that is a real
gap. It does not cover prose that names daily-wlog in order to talk about it —
this section, `GLOSSARY.md`'s **Wordmark** entry, the leftover-app warning in
`install-on-phone`, the recovery note in `supabase/config.toml`. The first three
entries are console-only strings; nobody on the team reads them daily.

- **GCP project id `daily-wlog-198`** — project ids cannot be renamed, only
  recreated, which would mean new Secret Manager secrets, re-linked billing,
  and a redeploy.
- **The Supabase project ref** — immutable, and it lives in the project URL.
  Only the ref. The project's *display name* does become Sprinkie, by hand in
  the dashboard; step 3 carries it.
- **Cloud Run service `daily-wlog-api`** — its name is in the URL, so renaming
  it means a new `EXPO_PUBLIC_API_URL` and another build.
- **The design system's id and global** — `daily-wlog-design-system-afe7e188-…`
  in the artboard's asset paths, and `DailyWlogDesignSystem_afe7e1` in the
  artboard and in `design/screens/*.jsx`. Both are handles into the Claude
  Design prototype project, whose `_ds/` tree is deliberately not duplicated
  here, so rewriting them in the repo stops the artboard and the UI kit
  resolving their design system. Changing them for real starts on the design
  side: renaming the design system there regenerates the id and the global, and
  a re-pull brings them in. That is #62, which also takes the artboard's
  filename. Most of `design/` is pulled, so the re-pull overwrites whatever is
  here — which is why its **titles and prose** were renamed anyway (a re-pull
  merely redoes them, and until then the repo would read two names) while the
  **filename** was not (renaming it now leaves a second file sitting beside the
  regenerated one). `window.WLOG` in `design/screens/` is left alone for the
  stronger reason: the harness that reads it was never pulled into this repo, so
  nothing here can prove a rename didn't break it.
- **The two Claude Design project names** — `"daily-wlog Design System"` and
  `"Daily-wlog iOS prototype"`, quoted in `design/README.md` and
  `design/canvas/README.md`. Those quotes name projects that still carry the old
  name upstream, so they are accurate as written and go stale the moment #62
  renames them. Same ticket, same re-pull.
- **The local clone directory** `/Users/simon/projects/daily-wlog`, in the path
  `install-on-phone` gives for `.env.hosted`. #56 renamed the repo, not the
  folder; GitHub redirects the old URL, and renaming the working directory would
  only break shell history and every worktree beside it for nothing.

This is deliberate (#56). Do not file it as unfinished rename work. Only the
design-side entries are expected to change, and #62 owns them.

## Already in the repo

- `apps/mobile/eas.json` — development / preview / production profiles, each
  with an update channel. The Expo project id and owner landed with #57; the
  App Store Connect app id is still missing and cannot exist until the app
  record does (step 2). The `development` profile also asks for a dev client
  (`developmentClient: true`) while `expo-dev-client` is not installed, so that
  one profile cannot build — left alone deliberately, since devices go through
  `deploy/sideload.sh` and nothing uses it.
- `apps/mobile/app.json` — bundle id `com.simononenineeight.sprinkie` (#55,
  and permanent from the first upload), light-only UI, zh_TW region,
  camera/photo permission copy, placeholder icon
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

#60 turned these answers into the published privacy policy, in `site/privacy/`.
Nothing in that document may contradict this list — change one and change the
other. Two things the policy states that this list does not, both deliberate and
both true: entry content is **not** end-to-end encrypted (ADR-0004 defers it, so
the policy says the operator could technically read the database rather than
implying otherwise), and data is processed in the United States.

The documents publish with `deploy/publish-site.sh`, which pushes `site/` to the
`gh-pages` branch — the legal pages and nothing else, so the runbook and the ADRs
never become a website. The privacy policy URL that goes into App Store Connect
is <https://simononenineeight.github.io/sprinkie/privacy/>.

## Still open before external testers (#61)

- A real app icon from the PM, replacing the placeholder (#58).
- English shipped (#32, #37).

**Not gates**, recorded so nobody re-adds them: the second half of the motion
pass (#38 — press states shipped in `theme/press.tsx`, but the 150ms selection,
240ms content-swap and 300ms screen-push token timings are unimplemented, so
route changes are instant cuts) and VoiceOver month stepping (#18).
