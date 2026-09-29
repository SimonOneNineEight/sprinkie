---
name: install-on-phone
description: Install Sprinkie on a real iPhone (Simon's or Yunchi's) as a Release build and prove it runs without the Mac. Use whenever a build goes onto a phone for real use — "install on my phone", "put it on Yunchi's phone", "sideload", the weekly re-sign, a release pass. Never use `expo run:ios --device` or Xcode's Run button for this.
---

# Install on a phone

A phone someone carries around must run a **Release** build. A Debug build
holds no JS: it downloads the bundle from Metro at the Mac's LAN IP baked in
at build time. Once Metro stops or the Mac changes Wi-Fi, the app opens to a
blank white screen with no error and never calls the API. That is what hit
both phones after the 2026-09-13 round-2 install.

`deploy/sideload.sh` only builds Release, and it refuses to install a bundle
that is missing or not pointed at the hosted stack. The steps below wrap it
with the checks it cannot do itself.

## Phones

| Owner  | devicectl name | UDID                        |
| ------ | -------------- | --------------------------- |
| Simon  | 黃晟維的iPhone | `00008150-000255211443401C` |
| Yunchi | Yoonchi (2)    | `00008110-000909313A06401E` |

Always pass the UDID. The script's default device is Yunchi's phone, despite
its comment.

## Steps

1. **Agree on the commit.** Ask the user which branch or commit goes on the
   phone; never assume the current branch. The checkout you build from must
   sit exactly there with a clean tree:
   `git -C <checkout> log -1 --oneline` shows it, `git -C <checkout> status --short` is empty.

2. **Preflight the checkout.** Use absolute paths (zoxide breaks relative `cd`).
   - `<checkout>/apps/mobile/.env.hosted` exists. It is gitignored; a fresh
     worktree needs it copied from the main clone at
     `/Users/simon/projects/daily-wlog/apps/mobile/.env.hosted` — that working
     directory keeps its old name; #56 renamed the repo, not the folder.
   - `<checkout>/apps/mobile/node_modules` exists, else `pnpm install --frozen-lockfile`.

3. **Reach the phone.** `xcrun devicectl list devices` must show it as
   `available (paired)`: unlocked, and on the same Wi-Fi as the Mac or plugged
   in. If it shows `unavailable`, stop and tell the user. A free Apple ID has
   no remote install path (that needs TestFlight and the paid program).

4. **Build and install**, once per phone:

   ```sh
   sh <checkout>/deploy/sideload.sh <UDID>
   ```

   If it stops with `refusing to install`, do not install the app by hand.
   Fix the cause the message names and run it again.

   The bundle id changed with the Sprinkie rename (#55), so iOS treats this as
   a new app: the old daily-wlog icon stays on the phone with its own data and
   its own sign-in. Have the owner delete it on the first install after the
   rename. Step 5's launch and log filter both name the new app, so a leftover
   cannot fake a pass there — but step 5's question to the owner can only be
   answered about whichever icon they tapped.

5. **Prove it runs without the Mac.** A signed-in app calls `/me` on every
   launch, so a fresh request in the Cloud Run logs shows the embedded bundle
   works:

   ```sh
   date -u +%Y-%m-%dT%H:%M:%SZ
   xcrun devicectl device process launch --device <UDID> --terminate-existing com.simononenineeight.sprinkie
   ```

   About 15 seconds later, paste the printed time in as `<launch time>` (a
   shell variable would not survive to this separate command):

   ```sh
   gcloud logging read "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"daily-wlog-api\" AND httpRequest.userAgent:\"Sprinkie\" AND timestamp>=\"<launch time>\"" \
     --project daily-wlog-198 --limit=5 --format='value(timestamp,httpRequest.status,httpRequest.requestUrl)'
   ```

   Pass: at least one row. No rows can also mean the owner is signed out (the
   sign-in screen calls no API), so ask them whether the phone shows 登入 or a
   blank white screen before calling it done.

   The `Sprinkie` in that filter is the user agent iOS derives from
   `CFBundleName`, which `expo prebuild` takes from `app.json`'s `expo.name`
   (nothing in the app sets a User-Agent itself). It moved with the #55 rename
   and has not been observed in the logs since. If a launch you can see on the
   phone returns no rows, check the real agent before concluding the install
   failed — drop the `userAgent` clause and read what the row actually says.

6. **Report** the commit installed, which phones got it, and the expiry date:
   install day + 7 days (free Apple ID profiles).

## Never

- `pnpm expo run:ios --device …` without `--configuration Release`, or
  Xcode's ▶ Run. Both install a Debug build tied to Metro.
- Call it done because the app opened while Metro was running on the Mac. A
  Debug build looks perfect until the Mac leaves.

## If a phone opens blank

Check whether a Debug build was ever installed:

```sh
xcrun devicectl device copy from --device <UDID> --domain-type appDataContainer \
  --domain-identifier com.simononenineeight.sprinkie \
  --source Library/Preferences/com.simononenineeight.sprinkie.plist --destination <scratch>/prefs.plist
plutil -p <scratch>/prefs.plist
```

`RCT_jsLocation` or `RCTDevMenu` means a Debug build ran on it. Reinstalls
keep the data container, so the keys outlive a later Release install; use
step 5 to judge the build that is on the phone now.
