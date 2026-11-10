# Manual end-to-end pass

The release gate.

Jest covers the screens against a contract-true mock API, and the Go suite
covers the handlers against a test database. Both stay green while the app and
the deployed server disagree with each other, because neither has ever seen
the two in the same room. PM feedback round 2 reported three bugs — an edited
date that would not move, month dots ignoring the hidden-set, a dead year-view
control — that were all a build talking to a Cloud Run revision predating those
features. An old server ignores an unknown field and an unknown query
parameter silently, and both look exactly like a bug.

Device gestures, the camera-to-storage pipeline, keyboard behavior, and
permission prompts are equally invisible to the automated suites.

Hence this document, and hence the rule about writing down the revision.

## When to run

| Trigger | Run |
| --- | --- |
| Before a TestFlight build | Everything |
| After an API deploy | `pnpm smoke:api` from `apps/mobile` (`docs/release.md`, Per-release). The hand-walked **[API]** cases run only in the full pass before a build |
| After an OTA update | Part 1, then the sections the update touches, skipping **[auto]** |
| Chasing a bug | Its section first, before touching code |

## Before you start

```sh
# The revision this run gates: the one serving traffic, not merely the newest
gcloud run services describe daily-wlog-api --region us-west1 --format='value(status.traffic[].revisionName,status.traffic[].percent)'
```

**On a TestFlight build**, load the latest update before anything else: open
the app, wait about a minute, force-quit, and open it again. Nothing on screen
says an update arrived (`docs/release.md`, OTA updates), so skipping this walks
yesterday's code. Note the update's group id for the record below.

**On a dev client only**, Metro must run from the checkout under test and with
the hosted env, or the run silently tests other code or talks to localhost:

```sh
# Which checkout serves :8081? Stop it unless it is this checkout's apps/mobile.
lsof -a -p "$(lsof -nP -iTCP:8081 -sTCP:LISTEN | awk '/node/{print $2; exit}')" -d cwd
cd apps/mobile && pnpm start:hosted
```

Journey 1 and the account-lifecycle cases need a **throwaway User**, since
they end in deactivation. Everything else runs on a **standing test User**
whose Journal carries several months of Entries across at least three
Categories, one of them with Subcategories, and at least one day holding five
or more Entries. Sign it up in the app by email, then give it that Journal
with `SEED_EMAIL=… SEED_PASSWORD=… pnpm seed:test-user` from `apps/mobile`.
The script refuses an account that already holds Entries.

## Recording a run

Post a comment on the release issue:

```
Manual pass — <date>
Build: <EAS build number, or commit sha for a dev client>
Update: <EAS update group id, or "embedded" if none has been published>
Bundler root: <dev client only: the checkout Metro served from>
Revision: <Cloud Run revision serving traffic, e.g. daily-wlog-api-00006-lwq>
Device: <model>, iOS <version>
Scope: full | Part 1 + <the sections walked>

Failures: <case ids, or "none">
```

The revision line is the point of the exercise. Without it, "was this build
ever tested against the current server" has no answer.

## Legend

**[API]** — the case crosses the network to `daily-wlog-api` or Supabase
Storage, so a deploy can break it with the app untouched. After a deploy,
`pnpm smoke:api` stands in for them; they are walked by hand only in the full
pass before a build.

**[auto]** — a jest or Go test asserts the whole expected result, named in
[Automated coverage](#automated-coverage). Only the pass before a TestFlight
build walks these, since a native build is what the suites cannot see. The
suites never meet the deployed revision, so after a deploy an **[auto]** case
that is also **[API]** is covered by `pnpm smoke:api`, not by its suite.

**[#NN]** — a known open defect. The case states the behavior we want, it
fails today, and ticket #NN closes it. A first run is expected to list these,
and they are not news.

A missing case id was a duplicate of a case elsewhere and was removed. Ids
are never reused, since issues cite them.

Cases describe the app **as it ships today**. A ticket that changes a
behavior updates its case in the same branch.

---

## Part 1 — Journeys

End-to-end walks. Run these first: they answer "does the product work", and a
failure here usually points at a section in Part 2.

### J1 — First run

Throwaway User, phone language Traditional Chinese.

| # | Steps | Expected |
| --- | --- | --- |
| J1.1 | Launch, sign in with Google | Lands on the month view **[API]** |
| J1.2 | Open 類別 | Five Categories: 工作, 運動, 美食, 旅遊, 個人, each with its own color and drawn icon **[API]** |
| J1.3 | Force-quit, relaunch | Straight to the month view, no sign-in |
| J1.4 | Switch the phone to English, relaunch | UI renders English; the five Categories keep their Chinese names **[API]** |

### J2 — The core loop

| # | Steps | Expected |
| --- | --- | --- |
| J2.1 | Tap a day that is not today, tap + | Form opens, date row reads the day you selected |
| J2.2 | Pick a Category, type a title, tap 儲存 | Form closes; the Entry is on that day; a dot appears on the grid **[API]** |
| J2.3 | Repeat with a note and two Photos | Saves; the day panel row shows the photo glyph **[API]** |
| J2.4 | Open the day view, tap the card | Form opens prefilled with everything you entered **[API]** |
| J2.5 | Change the title, save, reopen | The new title persisted **[API]** |

### J3 — A month's worth of reading

| # | Steps | Expected |
| --- | --- | --- |
| J3.1 | Swipe back three months and forward again | Months page one per swipe; dots match each month **[API]** |
| J3.2 | Tap ‹ 2026年 (the year under the month title), pick a month from a past year | Year view opens, then that month **[API]** |
| J3.3 | Hide a Category from 類別, walk month → day → year | It is absent on all three **[API]** |
| J3.4 | Show it again | It returns on all three **[API]** |

### J4 — Organizing

| # | Steps | Expected |
| --- | --- | --- |
| J4.1 | Create a Category with a custom color and an icon | Appears in 類別 and in the Entry form **[API]** |
| J4.2 | Add a Subcategory to it | Inherits the parent's color and icon **[API]** |
| J4.3 | Write an Entry refined by that Subcategory | Saves; the day card names the Subcategory **[API]** |
| J4.4 | Recolor the parent | The Entry's dot and card follow it **[API]** |
| J4.5 | Try to delete the parent | Refused, with the in-use explanation **[API]** |

### J5 — A bad connection

| # | Steps | Expected |
| --- | --- | --- |
| J5.1 | Airplane mode on, write an Entry with a Photo, tap 儲存 | Fails plainly; the form keeps everything |
| J5.2 | Leave the form | A 尚未儲存 row sits on the day |
| J5.3 | Force-quit, relaunch, open the day | The row is still there **[auto]** |
| J5.4 | Airplane mode off, tap it, tap 儲存 | Saves; the row disappears; the Photo is on the Entry **[API]** |

### J6 — Leaving and coming back

Throwaway User. Ends deactivated.

| # | Steps | Expected |
| --- | --- | --- |
| J6.1 | 設定 → 登出 | Sign-in screen **[auto]** |
| J6.2 | Sign in again | Entries and Categories intact **[API]** |
| J6.3 | 設定 → 刪除帳號, confirm | Deactivated screen, 30-day grace stated **[API]** |
| J6.4 | Force-quit, relaunch | Still the deactivated screen |
| J6.5 | 復原帳號 | Account returns with its Entries **[API]** |

---

## Part 2 — Screen inventory

Exhaustive. Every control, every state, including the ones no journey reaches.

### SI — Sign-in

| # | Case | Expected |
| --- | --- | --- |
| SI.1 | The screen at rest | The Sprinkie wordmark, the promise 每天五分鐘，留下你的生活, provider buttons. Nothing else |
| SI.2 | Sign in with Apple | Completes and lands on the month view **[API]** |
| SI.3 | Cancel the Apple sheet | Returns to sign-in with **no** error message — a cancelled sheet is a decision |
| SI.5 | Cancel the Google sheet | Returns to sign-in with **no** error message, as SI.3 does for Apple **[auto]** |
| SI.6 | 使用電子郵件登入 | The email page opens on its own **[auto]** |
| SI.7 | Email page, back chevron | Returns to the provider screen **[auto]** |
| SI.8 | Email + password, 登入 | Signs in **[API]** **[auto]** |
| SI.9 | Toggle to 建立帳戶, submit a new address | Signs in while Confirm email is off in Supabase; with it on, 確認電子郵件 asks for the emailed code instead **[API]** **[auto]** |
| SI.10 | Wrong password | Plain error, nothing lost from the fields **[API]** |
| SI.11 | Empty email or password, submit | Nothing happens; no request fired **[auto]** |
| SI.12 | Airplane mode, submit | Plain error, no crash |
| SI.13 | Password field | Masked, and offers the right autofill (current vs new) per mode |
| SI.14 | The home screen | The Sprinkie icon (seven rounded colored squares on a three-by-three layout, the centre and bottom-right empty) labelled Sprinkie |
| SI.15 | Every screen's background | Warm off-white (#FAF7F2), never pure white. Cards, sheets and buttons are white on it by design |
| SI.16 | Email page, 忘記密碼？ under the password field, enter the email, 寄送驗證碼 | Still titled 重設密碼, the code step reads 已寄送 6 位數驗證碼至 and the address; an email from Sprinkie arrives carrying a 6-digit code **[API]** |
| SI.17 | Type the emailed code, 下一步, then a new password of 6 or more characters, 更新並登入 | Lands on the month view. After 登出, the new password signs in and the old one does not **[API]** |
| SI.18 | A wrong code, 下一步, a new password, 更新並登入 | Back on the code step, reading 驗證碼錯誤或已過期 **[API]** **[auto]** |
| SI.19 | A new password under 6 characters, 更新並登入 | 密碼至少需要 6 個字元, still on the new-password step **[auto]** |
| SI.20 | A code step, 重新寄送 | Reads 重新寄送（30 秒） from the moment a code was sent, counting down a second at a time; at the end, a tap sends a second email and the wait starts again **[API]** |
| SI.21 | Each step of 忘記密碼, back chevron | Steps back one step: from the new password to the code, to the email, to the sign-in form, then to the provider screen **[auto]** |
| SI.22 | With Confirm email on: 確認電子郵件, type the emailed code, 完成註冊 | Lands on the month view **[API]** |
| SI.23 | 確認電子郵件, back chevron | The sign-up form, with the email as typed **[auto]** |
| SI.24 | The code field | Number pad; takes digits only, six at most; with the email arrived, the keyboard offers its code |
| SI.25 | A reset code step, back chevron, then 寄送驗證碼 again for the same address | Back on the code step with the countdown where it was; no second email is sent **[auto]** |
| SI.26 | 建立帳戶 with an address that already has an account | Stays on the sign-up form, reading 此電子郵件已註冊，請直接登入或使用忘記密碼。 **[API]** **[auto]** |
| SI.27 | Airplane mode, 寄送驗證碼 | 寄送失敗，請再試一次, still on the email step **[auto]** |
| SI.28 | Any step's main button, on a slow connection | A spinner takes the label's place until the answer comes, and nothing below it moves; a quick second tap sends nothing more |

**SI.2 and SI.3 passed on build 5 (0.9.0), 2026-10-05**, the first build signed
against a real App ID. Both had failed on every previous build: the App ID
carried no Sign In with Apple capability, so a dev build could only be signed
with the entitlement emptied, which removed the feature while the button went
on rendering. A failure here now means something regressed, not that it was
never finished.

Keyboard cases are in **KB**.

### MO — Month view

| # | Case | Expected |
| --- | --- | --- |
| MO.1 | Open the app | Lands on this month with today selected **[auto]** |
| MO.2 | Today's cell, unselected | Thin ring **[auto]** |
| MO.3 | Today's cell, selected | Filled circle **[auto]** |
| MO.4 | Tap another day | The filled circle moves to it; today keeps the ring **[auto]** |
| MO.5 | Tap the selected day again | The day view opens **[auto]** |
| MO.6 | A day with Entries | Dots in Category colors, in Entry order, touching **[API]** |
| MO.7 | A day with five or more Entries | Four dots and a **+** overflow glyph, sitting on the dots' line **[API]** |
| MO.8 | Days outside the month | Greyed and not tappable |
| MO.9 | Swipe left / right | One month per swipe, both directions, repeatedly **[API]** **[auto]** |
| MO.10 | Swipe several months fast | Each settle loads that month's dots; the month you left never paints on the one you arrived at, even for an instant **[API]** **[auto]** |
| MO.11 | Move to a month that is not this month | Its 1st is selected; back on this month, today is **[auto]** |
| MO.12 | The day panel | The selected day's Entry titles with Category icons **[API]** |
| MO.13 | A panel row for an Entry with Photos | Carries the photo glyph **[API]** |
| MO.14 | Tap the panel header or any row | Opens the day view |
| MO.15 | A day with no Entries | Panel reads 這天沒有紀錄 **[auto]** |
| MO.16 | Tap the floating + | Entry form opens for the **selected** day, not today **[auto]** |
| MO.17 | Tap ‹ 2026年 (the year under the month title) | The year ribbon opens on the month you were viewing, including after swiping across a year boundary (YR.21) **[auto]** |
| MO.18 | Tap the 設定 (gear) icon | Settings opens **[auto]** |
| MO.19 | Tap the 類別 (tag) icon | The visibility sheet opens **[auto]** |
| MO.20 | Airplane mode, swipe months | Dots are absent, not wrong; no error wall, no crash **[auto]** |
| MO.21 | A month holding no Entries at all | Grid renders with no dots anywhere **[API]** **[auto]** |
| MO.22 | Swipe months away, tap the floating 今天 | This month, with today selected **[API]** **[auto]** |
| MO.23 | Tap 今天 while already on this month | Selection returns to today; nothing else moves **[auto]** |
| MO.24 | Hide a Category while its dots are on screen | The dots go; the month never briefly shows the old set **[API]** **[auto]** |
| MO.25 | The nav bar | Only the 類別 and 設定 icons; 今天 floats at the bottom **[auto]** |
| MO.26 | A day with more Entries than the panel fits | The panel scrolls, and its last row scrolls clear of the floating controls |
| MO.27 | Scroll the day panel | Both controls fade out while scrolling and return when it stops |
| MO.28 | Tap between the two controls while they are showing | The tap reaches the panel beneath, not the gap |
| MO.29 | On a device with a home indicator | Both controls sit above the indicator, never over it |
| MO.30 | The two controls side by side | Both 44pt; their tops and bottoms line up **[auto]** |
| MO.31 | The controls against the month title and the day card | Their left and right edges line up with both |
| MO.32 | Select a day other than today, tap +, save, then tap + again | The month view still has that day selected, and the second form opens for it **[auto]** |
| MO.33 | From +, change the date row before saving | The month view lands on the date the Entry was saved onto **[auto]** |
| MO.34 | From +, cancel | Back on the day the form was opened for **[auto]** |

### DA — Day view

| # | Case | Expected |
| --- | --- | --- |
| DA.1 | Open a day with Entries | Cards with title (up to three lines), Category icon, Subcategory name, note preview (up to five lines), photo thumbnails **[API]** |
| DA.2 | A day with none: today, then any other date | Today reads 今天還沒有紀錄; every other date reads 這天沒有紀錄 **[auto]** |
| DA.3 | Tap a card | The Entry view opens on it (EV), not the form **[auto]** |
| DA.4 | On a day with nothing hidden, long-press and drag a card | It moves; the order holds on return **[API]** **[auto]** |
| DA.5 | Scroll a long list vertically | Scrolls; no accidental day change |
| DA.6 | Swipe left / right | Previous and next date, gestures surviving the list underneath |
| DA.7 | Swipe to another day, then the back chevron | Returns to the month view on the day you were showing, in its month, selected, not today **[auto]** |
| DA.8 | Tap the floating + | Entry form for this day **[auto]** |
| DA.9 | A day holding a retained Draft | A 尚未儲存 row above the cards **[auto]** |
| DA.10 | Several Drafts on one day | All of them listed |
| DA.11 | Tap a Draft row | The form opens prefilled from it **[auto]** |
| DA.12 | A day where something is hidden | Hidden cards absent; long-press drag does nothing |
| DA.13 | Airplane mode, open a day | 無法載入紀錄, no crash **[auto]** |
| DA.14 | An Entry whose content will not decode | The card renders （無法讀取的紀錄） rather than failing. Nothing in the app can make one, so the unit tests cover it: skip by hand |
| DA.15 | Airplane mode, long-press and drag a card | 排序失敗，請再試一次, and the order returns to what the server holds **[API]** **[auto]** |
| DA.16 | Tap the floating 今天 | The view moves to today's date **[API]** **[auto]** |
| DA.17 | Scroll a long card list to its end | The last card scrolls clear of the floating controls |
| DA.18 | Scroll the card list | Both controls fade while scrolling and return when it stops |
| DA.19 | Long-press-drag a card near the bottom | The drag works; the faded controls do not intercept it |
| DA.20 | On a device with a home indicator | Both controls sit above the indicator, never over it |
| DA.21 | The gap below the controls | The same on the day, month and year views |
| DA.22 | Tap the 類別 icon in the header | The same sheet the month and year views open: the two-level tree, ✎ per row, 全部隱藏 and 新增類別 **[auto]** |
| DA.23 | An Entry whose title runs past three lines and note past five | The title stops at three lines and the note at five, each ending in …; the card grows taller but not wider, the note keeps its left edge, and the card never scrolls inside itself |
| DA.24 | A card whose title wraps to three lines, then long-press and drag it | The icon and grip sit centered on the title block, the category line beneath it; the drag works as on a one-line card |

### EV — Entry view

A tap on a day card opens the Entry to read (#119); 編輯 opens the form. Use
a day of at least three Entries, one of them with a Chinese note of several
lines and three photos.

| # | Case | Expected |
| --- | --- | --- |
| EV.1 | Open the Entry with the long note and three photos | Top to bottom: the Category chip (its icon on the Category's tint, 類別 · 子類別 in its ink), the title large, the date just under it in grey, the whole note, then the three photos as equal squares filling one row. Nothing is cut off with …, there is no large first photo, and the photo row does not scroll sideways |
| EV.2 | Open any Entry | It shows its Category and Subcategory, title, date, the whole note and its photos **[auto]** |
| EV.3 | The top bar | ‹ on the left, n / total centred, 編輯 on the right; each answers a tap across a 44pt target |
| EV.4 | On a day where one Category is hidden, swipe left and right | One Entry per swipe in the day view's order, the hidden one skipped; the count follows, and the swipe stops at the first and the last Entry, never crossing into another day **[auto]** |
| EV.5 | Scroll a long note | Scrolls; the Entry does not change |
| EV.6 | 編輯, change the title, 儲存 | Back on the Entry view, showing the new title **[API]** **[auto]** |
| EV.7 | 編輯, change the date, 儲存, then ‹ | The Entry view shows it on the new date; ‹ goes to the new date's day view, where it now sits **[API]** **[auto]** |
| EV.8 | 編輯, change the title, 取消 | Back on the Entry view, unchanged **[auto]** |
| EV.9 | 編輯, 刪除紀錄, confirm | The day view, without the Entry **[API]** **[auto]** |
| EV.10 | Tap the second of three photos, then ✕ | The viewer opens on that photo and reads 2 / 3; ✕ returns to the Entry view **[auto]** |
| EV.11 | In the viewer, swipe between photos | The photos page; the Entry behind does not change |
| EV.12 | ‹, then ‹ again | The day view, then the month view on that day |
| EV.13 | Open an Entry saved before #44 with more than three photos | Every photo shows, wrapping onto further rows of three equal squares; nothing scrolls sideways |
| EV.14 | 編輯, move the Entry to a hidden Category, 儲存; then show that Category again from the day view's 類別 sheet | The day view, and it stays there: the card comes back, the Entry view does not reopen by itself **[auto]** |
| EV.15 | 編輯, change the title and the date, attach a photo; airplane mode on just as 儲存 sends the photo, then 取消 | The Entry view shows the new title on the new date, as the server holds it **[API]** **[auto]** |

**EV.4 never crosses days** on purpose: a swipe past the day's last Entry
would make the Entry view a fourth surface applying Hidden, which is ADR
0005's revisit trigger.

### EF — Entry form

| # | Case | Expected |
| --- | --- | --- |
| EF.1 | Open from a day | Date row reads that day **[auto]** |
| EF.2 | Tap the date row | The picker sheet opens on that month, the day marked |
| EF.3 | Step the picker's months | Both directions; today wears its mark only in its own month |
| EF.4 | Pick a day | Sheet closes, the date row updates |
| EF.5 | Tap the scrim | Closes without changing the date **[auto]** |
| EF.6 | Before choosing a Category | Only the search field and Category list show; no title or note |
| EF.7 | Type in the search field | The list filters live **[auto]** |
| EF.8 | Type a name nothing matches | A 建立「…」 row appears above the pinned 新增類別 row |
| EF.9 | Tap either creation row | The full Category editor opens, prefilled with what you typed |
| EF.10 | Save from that editor | The editor closes and the new Category is selected into the form **[API]** **[auto]** |
| EF.11 | Pick a Category | Its row collapses; title, note, and the photo grid appear |
| EF.12 | Tap the collapsed Category row | Deselects, returning to the list **[auto]** |
| EF.13 | Subcategory pills | One per child, dots in the parent's color |
| EF.14 | Tap a pill, tap it again | Selects, then deselects |
| EF.15 | Tap + in the pill row | A field opens, with no 建立 beside it; the keyboard's return key reads 完成 **[auto]** |
| EF.16 | Type a name, then tap 完成 or anywhere else | Renders as a selected pill; nothing created yet **[auto]** |
| EF.17 | Save with that pill | The Subcategory is created with the Entry **[API]** **[auto]** |
| EF.18 | Type the name of a Subcategory this Category already has, leave the field, save | That one is selected; no duplicate is created **[API]** **[auto]** |
| EF.19 | Tap the typed pill | The field reopens with the name; emptied and left, the pill is gone **[auto]** |
| EF.20 | Title field | Stops at 80 characters **[auto]** |
| EF.21 | Empty title | 儲存 disabled **[auto]** |
| EF.22 | Note field: type past five lines | It opens five lines tall and stays that tall; the text scrolls inside it. The first line sits at the top, with no blank line above it |
| EF.23 | Tap the photo tile | Camera / library / cancel offered |
| EF.24 | Choose from the library | Multi-select allowed, capped at the slots still free of the three |
| EF.25 | Take a photo | Appears in the grid |
| EF.26 | Deny the camera permission when iOS asks | Nothing happens; no crash, no empty tile **[auto]** |
| EF.27 | Add Photos up to the cap | The tile counts n/3 and disappears at the third **[auto]** |
| EF.28 | Tap the ✕ on a photo just attached in this form | It goes at once, with no confirmation (it was never saved) **[auto]** |
| EF.29 | Long-press and drag photos | Order changes and persists after save **[API]** |
| EF.30 | Save an Entry carrying Photos | Past a moment, 儲存中 covers the screen until the save is done, and nothing beneath it takes a tap; the app never looks hung **[API]** **[auto]** |
| EF.31 | Tap 儲存 twice quickly | One Entry, not two **[API]** **[auto]** |
| EF.32 | Editing: change the Category | Saves; the dot color changes on the grid **[API]** |
| EF.33 | **Editing: change the date, save** | The Entry leaves its day and appears on the target day, last in order **[API]** **[auto]** |
| EF.35 | 刪除紀錄, confirm | The Entry and its dot are gone **[API]** |
| EF.36 | 取消 with unsaved edits | Returns without saving **[auto]** |
| EF.37 | Airplane mode, 儲存 | 儲存失敗，請再試一次; the form keeps everything |
| EF.38 | A restored Draft whose photo files the OS purged | 部分照片已無法讀取, and a retry saves what survives **[auto]** |
| EF.39 | Choose 從相簿選擇 on a fresh install | The photo picker opens straight away, with no permission prompt: iOS's picker needs none |
| EF.40 | Open the form with every Category deleted | Only the pinned 新增類別 row; 儲存 stays disabled until one exists **[auto]** |
| EF.41 | Open an Entry saved with more than three Photos | Every Photo is still there; no add tile, and nothing is deleted **[API]** **[auto]** |
| EF.42 | Attach three 48MP photos taken a while ago, at once | All three photos are in the grid within ~2s, and the app survives |
| EF.43 | Attach a 48MP HEIF portrait from a Pro iPhone (Settings → Camera → Formats → Resolution Control, then 48MP in the camera) | It appears in the grid. Before #87 the picker closed and nothing was added |
| EF.44 | Tap the ✕ on a Photo of a saved Entry | Confirmation, then it goes **[API]** **[auto]** |
| EF.45 | Open an Entry whose title is 41–80 characters (72 is the PM's longest), change only the note, save, reopen | The title is intact, not cut to 40 **[API]** |
| EF.46 | With a Subcategory pill selected, tap +, type a new name, leave the field, save | The typed pill replaces the selected one; the new Subcategory is created and refines the Entry **[API]** **[auto]** |
| EF.47 | Tap a photo, saved or just attached | The viewer opens on that photo; nothing is removed. Where the tile stops and the ✕ begins is EF.49 **[auto]** |
| EF.48 | Long-press-drag a photo to another place, then tap it | It moves, and the viewer opens on the photo tapped, not on the one that sat there before |
| EF.49 | Tap just below, or just left of, a ✕ (about a ✕'s width off it) | Removes, as the ✕ does: it answers across the tile's 44pt corner. A tap further into the tile opens the viewer |
| EF.50 | Type a title, press Return | The return key reads as next, not as a new line; focus moves to the note, and the title gains no new line |
| EF.51 | Paste text with line breaks into the title | It reads, and saves, with a space where each line break was **[auto]** |
| EF.52 | Type a long title, past three lines | One line while empty; it wraps, grows to three lines, then stays three tall and scrolls inside itself |
| EF.53 | Type a title in 注音, then 拼音; press Return on a candidate, then again | The first Return confirms the candidate and focus stays in the title; only the second moves to the note |
| EF.54 | After EF.26, tap 拍照 again | 無法使用相機 asks you to turn the camera on in Settings, with 取消 and 開啟設定; 開啟設定 opens Sprinkie's page in Settings, and turning the camera on there makes the next 拍照 open the camera |
| EF.55 | Attach three photos at once | A tile with a spinner holds each one's place as soon as the picker closes, and each fills in with its photo when that one is ready **[auto]** |
| EF.56 | Tap a tile while its spinner still turns | Nothing happens, and it has no ✕ **[auto]** |
| EF.57 | Attach photos, then tap 儲存 before every tile has filled in | 儲存中 covers the screen until they are ready and the save is done; the Entry has every photo **[API]** **[auto]** |
| EF.58 | Save an Entry with no photos | The form closes with no 儲存中 flashing on the way |
| EF.59 | Attach photos, then tap 取消 while a spinner still turns | The form closes at once, and nothing is saved **[auto]** |

**EF.46 belongs with EF.15–EF.19** and sits last only to keep the other
case ids stable. Before #102's follow-up the typed name vanished and the old
pick was saved.

**EF.50–EF.53 are #115**, with EF.22. The title wraps now but never holds a
newline. EF.53 is device-only: the suites cannot compose Chinese. A Return
that confirms a candidate is the keyboard's own, and never reaches the field
as a Return, so it should not move focus; this is where that is checked. If
a note shows a blank first line (round 3), look first for a Return typed
before its first word: the day view's card showed the same blank line.

**EF.47–EF.49 are #118.** A tap on a tile used to remove the photo. The ✕
sits inside the grid's own drag handling, so only a device shows that the ✕,
the tap, and EF.29's drag each still reach their own: the suites stand in
for the drag. A long-press that starts on the ✕ itself does not drag; start
it on the photo.

**EF.33 is round-2 report #1.** It passes only when the deployed revision
carries the date-move.

**EF.42 was measured on a device (#93).** On an iPhone 17 Pro, the app's own
work for three 48MP photos (decode, full render and save, thumbnail) takes
~1.3s, and the app survives it (#69). Use photos taken a while ago: **freshly
taken 48MP photos take ~10s**, almost all of it inside the iOS picker before
the app receives them: iOS finishes each photo's deferred processing on
demand (confirmed: a photo taken 30 minutes earlier attached in ~2s). That
wait is iOS's, not a failure of this case, and nothing in the app can show it
yet (#92 notes the gap).

**EF.43 is #87.** A wide-color photo made the thumbnail step throw, and the
attach did nothing. The 48MP setting is the reliable way to get such a photo
on an iPhone 17 Pro; a 24MP shot attached even before the fix. If a photo
cannot be added, the form now says 無法加入照片 and keeps any others from the
same pick. Nothing on a healthy device triggers that by hand, so the unit
tests cover it, along with its tile leaving the grid.

**Fresh photos fill their tiles late.** For three 48MP photos taken moments
before, iOS keeps the picker open for ~8–9s while it finishes each one, so
EF.55's tiles only appear near the end of that wait. That wait is iOS's, not
the app's, and EF.55 uses photos taken a while ago.

**Two photo fixes have no case here.** #70's portrait size cap is invisible on
screen, so its unit tests and a real-module check cover it. #95 made the save's
upload-link request about three times faster from revision 00006 on: EF.30's
wait is shorter there, which changes how it feels, not whether it passes.

Keyboard cases are in **KB**.

### YR — Year view

The ribbon (#51). A year is no longer a page you turn to, so every case below
is about scrolling rather than paging.

| # | Case | Expected |
| --- | --- | --- |
| YR.1 | Open it | Today's month sits centred, with the preceding months above it — never flush against the top **[API]** |
| YR.2 | A recorded day | A solid box in its first visible Entry's Category color **[API]** **[auto]** |
| YR.3 | Today | Marked in its mini month |
| YR.4 | Scroll down past December | January follows with no break and no page turn **[auto]** |
| YR.5 | The January row | A year caption above it, larger than the month names and a lighter grey, so the new year announces itself |
| YR.6 | Keep scrolling, several years | Months keep coming in both directions; nothing runs out **[API]** **[auto]** |
| YR.7 | Watch the header while scrolling | The year and its count follow the topmost visible month, changing as you cross into another year **[API]** **[auto]** |
| YR.8 | The count, current year vs a past year | This-year wording on the current year, total wording on any other **[API]** **[auto]** |
| YR.9 | Scroll up, years into the past | Months load as they arrive; a year already seen does not refetch **[API]** **[auto]** |
| YR.10 | Tap a mini month | The month view opens on it **[auto]** |
| YR.11 | Tap the year title | The wheel opens directly under the header, the year the header is showing centred; the count beneath is not a tap target |
| YR.12 | Pick a year from the wheel | The ribbon scrolls to that year rather than swapping a page **[API]** **[auto]** |
| YR.13 | Pick a year at either end of the wheel | Scrolls there without crashing; future years are allowed, since backfilling is the product |
| YR.14 | Tap the scrim | The wheel closes, the position unchanged |
| YR.15 | Scroll far away, then tap 今天 | Scrolls back to today's month and stays on the year view **[auto]** |
| YR.16 | Swipe left or right | Nothing happens; the surface scrolls vertically now **[auto]** |
| YR.17 | There is no back button and no chevrons | Correct; scrolling, the title and a month tap are the navigation **[auto]** |
| YR.18 | Tap the 類別 (tag) icon | The visibility sheet opens |
| YR.20 | Airplane mode | Mini months render empty, no crash **[auto]** |
| YR.21 | From a month in a past year, tap ‹ and its year | The ribbon opens on **that month**, not that year's January and not this year **[auto]** |
| YR.22 | The last row of the ribbon | Clears 今天; nothing is trapped under the floating control |
| YR.23 | Scroll, then stop | 今天 fades out while moving and returns when the ribbon settles |
| YR.24 | The home indicator | Clears the floating control, and the control clears the content |
| YR.25 | The ribbon's rows | Two months to a row; the gap between the pair is narrower than the gap between rows, so each row reads as a row |

**YR.22–YR.24 come from #50** and were lost when this section was rewritten for the ribbon; the controls outlived the grid.

**YR.1 and YR.21 are the ones worth being fussy about.** Both are about landing
precisely: the row heights are precomputed so a scroll target is exact rather
than approximate, and an off-by-one lands you on the wrong month without ever
looking broken. YR.1 is worth checking on both a small and a large phone, since
the centring is measured against the viewport rather than a fixed number of
rows.

**今天 stays hidden for the length of a momentum glide (#76).** Flick hard and
the floating control is gone until the ribbon stops moving, which is longer
here than on any other surface because the list is long enough to glide. Known,
deliberately unchanged until testers say whether it matters. Not a YR failure.

### CS — 類別 sheet

| # | Case | Expected |
| --- | --- | --- |
| CS.1 | Open it | Two-level tree, Subcategories always expanded, 新增類別 last |
| CS.2 | A visible Category | White glyph on the Category color |
| CS.3 | Tap a Category row | The circle goes hollow; the family hides |
| CS.4 | Tap it again | The whole family returns **[auto]** |
| CS.5 | A Subcategory row | A check-circle in the parent's color, filled when visible |
| CS.6 | Tap a Subcategory | Only that child toggles **[auto]** |
| CS.7 | Hide a parent, show one child | The parent's circle stays lit while any member is visible |
| CS.8 | 全部隱藏 | Everything hides; the label flips to 全部顯示 **[auto]** |
| CS.9 | 全部顯示 | Everything returns **[auto]** |
| CS.10 | Tap ✎ on any row | The editor opens for it **[auto]** |
| CS.11 | Tap 新增類別 | The editor opens in create mode **[auto]** |
| CS.12 | 完成 or the scrim | Closes; changes already applied |
| CS.13 | Reopen after closing | The same visibility state **[auto]** |
| CS.14 | The sheet with every Category deleted | Only 新增類別; no empty tree, no error **[auto]** |
| CS.15 | Type a Category's name in the search field | Only that Category's family remains **[auto]** |
| CS.16 | Type a Subcategory's name | Its parent stays as context; the parent's other children drop **[auto]** |
| CS.17 | Clear the field | The whole tree returns, visibility unchanged **[auto]** |
| CS.18 | Type something nothing matches | Only the pinned 新增類別 row remains **[auto]** |
| CS.19 | While filtered, tap a parent row | The whole family toggles, including members the search is hiding **[auto]** |
| CS.20 | While filtered, 全部隱藏 | Acts on every Category, not just the matches **[auto]** |
| CS.21 | Type a name, then 新增類別 | The editor opens with that name already in the field **[auto]** |

Keyboard cases are in **KB**.

### CE — Category editor

| # | Case | Expected |
| --- | --- | --- |
| CE.1 | Open in create mode | Name focused, the preview icon beside it |
| CE.2 | Type a name | The preview updates live |
| CE.3 | Empty name | 儲存 disabled **[auto]** |
| CE.4 | Tap the 上層分類 row | The list swaps in for the summary row **[auto]** |
| CE.5 | Pick a parent | The list collapses, the choice marked ✓ |
| CE.6 | Pick 無 | Collapses back to an independent Category **[auto]** |
| CE.7 | With a parent chosen | The color and icon blocks render disabled, with the inherit note |
| CE.8 | Editing an existing Category | The parent row is not tappable — parenthood is fixed **[auto]** |
| CE.9 | Tap a preset color | Selected with a ring; the preview follows |
| CE.10 | Scroll the icon grid | Scrolls inside its card, not the sheet |
| CE.11 | Tap an icon | It becomes the selection **[auto]** |
| CE.12 | Which icon is selected | Its cell fills with the Category color, glyph in white — identifiable at a glance **[auto]** |
| CE.13 | Save | The sheet closes and the change shows everywhere **[API]** |
| CE.14 | Editing a parent: the 子類別 list | Every child listed, each opening its own editor |
| CE.15 | 新增子類別 from there | Create mode with the parent preselected |
| CE.16 | An unused Category | 刪除類別 offered; deleting removes it **[API]** **[auto]** |
| CE.17 | A Category with Entries | No delete; the in-use explanation instead **[API]** |
| CE.18 | A Category with children | No delete; the children explanation instead **[API]** |
| CE.20 | Airplane mode, save | 儲存失敗，請再試一次; nothing lost **[auto]** |
| CE.21 | Change the color after choosing an icon | The chosen cell takes the new color; the icon stays chosen **[auto]** |
| CE.22 | With a parent chosen, the dimmed icon grid | The inherited glyph is still identifiable, filled in the parent's color **[auto]** |

Keyboard cases are in **KB**.

### CD — Color drawer

| # | Case | Expected |
| --- | --- | --- |
| CD.1 | Tap 自訂顏色 | Opens on the current color |
| CD.2 | Drag in the saturation area | The color follows the drag, live |
| CD.3 | Drag the hue strip | The area repaints in the new hue |
| CD.4 | Very dark and very light picks | Allowed; the preview is the guardrail, not a clamp |
| CD.5 | The preview week | The chosen color appears as real dots beside existing Categories **[auto]** |
| CD.6 | The side-by-side row | Your Categories' colors next to the chosen one, ringed |
| CD.7 | The hex readout | Matches the chosen color, uppercase |
| CD.8 | Tap the readout, type a valid hex | The picker jumps to it **[auto]** |
| CD.9 | Type a partial or invalid hex | Ignored quietly, nothing jumps **[auto]** |
| CD.10 | 已存的顏色, when colors have been saved | Most-recent first; tapping one selects it |
| CD.11 | 已存的顏色, on a fresh User | The row is absent, not empty **[API]** **[auto]** |
| CD.12 | 完成, then save the Category | The color is applied **and** joins 已存的顏色 **[API]** |
| CD.13 | 完成, then **cancel** the editor | The color does **not** join 已存的顏色 **[API]** |
| CD.14 | Save more than twelve custom colors over time | The oldest drop; the cap holds **[API]** **[auto]** |
| CD.15 | Airplane mode, open the drawer | The saved row is simply empty; the picker still works |
| CD.16 | Long-press a color in 已存的顏色 | A confirmation, saying the Categories using it keep it |
| CD.17 | Cancel that confirmation | The color stays in the row **[auto]** |
| CD.18 | Confirm it | The color leaves 已存的顏色 there and then, with the drawer still open **[API]** **[auto]** |
| CD.19 | A Category wearing the forgotten color | Still wears it — on its editor, on the month view, in the day list **[API]** **[auto]** |
| CD.20 | Reopen the drawer | The color is still gone; the rest of the row is in the same order **[API]** **[auto]** |
| CD.21 | In the hex readout, type `#` and six digits, then one more | The field stops accepting characters **[auto]** |

**CD.18–CD.20 need this round's API deployed.** `DELETE /color-recents/{hex}`
arrives with #47; against an older revision the long-press and its
confirmation still work (CD.16, CD.17, both client-side) and confirming then
reports 移除失敗. That is the deployment gap, not the feature.

Keyboard cases are in **KB**.

### ST — Settings and account

| # | Case | Expected |
| --- | --- | --- |
| ST.1 | Open it | The account's email, a 連結帳戶 card under it, the 語言 row and the 每日提醒 switch, a 關於 card with 隱私權政策 and 服務條款, 登出, 刪除帳號 |
| ST.2 | Tap 語言 | The sheet offers exactly 系統預設 / 繁體中文 / English |
| ST.3 | The two language names | Shown as endonyms, never translated **[auto]** |
| ST.4 | Pick 繁體中文 | The UI switches immediately; the row's value updates |
| ST.5 | Pick English | Same, in the other direction |
| ST.6 | Pick 系統預設 | Follows the phone again |
| ST.7 | After switching | Entry titles and Category names are untouched **[auto]** |
| ST.8 | Relaunch after switching | The choice survived **[auto]** |
| ST.10 | 刪除帳號 | Confirmation naming the 30-day grace **[auto]** |
| ST.11 | Cancel it | Nothing happens **[auto]** |
| ST.15 | 登出 from the deactivated screen | Sign-in screen; signing back in returns to the gate **[API]** |
| ST.16 | Deactivate on one device, use the app on another | The second device meets the gate **[API]** **[auto]** |
| ST.17 | Deactivate on a second device while this one sits open, then act here | The next request meets the gate rather than failing oddly **[API]** |
| ST.18 | Tap 隱私權政策 | An in-app sheet opens the policy — the page renders, not a 404 **[auto]** |
| ST.19 | Tap 服務條款 | Same, for the terms **[auto]** |
| ST.20 | Close the sheet | Back on 設定 where you were; the app was never left for Safari |
| ST.21 | The contact address on either page | hello.sprinkie.journal@gmail.com, and tapping it opens a mail draft |
| ST.22 | Both pages on a narrow phone | Text wraps, nothing scrolls sideways, the 關於 links at the foot work |
| ST.23 | The 連結帳戶 card | An Apple row and a Google row, each ending in 已連結 (takes no tap) or 連結 as the account holds them; under the card, 已有帳戶？請先用原本的方式登入，再從這裡連結。 **[auto]** |
| ST.24 | Apple row, 連結, finish the Apple sheet | The row turns 已連結 **[auto]** |
| ST.25 | Google row, 連結, finish the Google sheet | The row turns 已連結 **[auto]** |
| ST.26 | After linking, leave 設定 and reopen it, then 登出 and sign in with the method just linked | Still 已連結; the same journal opens, its Entries and Categories intact |
| ST.27 | 連結 a method that already belongs to another account | 此登入方式已屬於另一個帳戶, with 若要連結，請先登入那個帳戶並刪除它；刪除 30 天後，它的登入方式才會釋出。 The row stays 連結, and neither account's journal changes |
| ST.28 | 連結, then close the Apple or Google sheet | Nothing changes; no error line **[auto]** |
| ST.29 | Apple row, 連結, choose Hide My Email on the sheet | The row turns 已連結; 登出, then Sign in with Apple opens this journal, though the relay address matches no account's email |
| ST.30 | Signed out, Sign in with Google using the address of an existing email account whose address is confirmed | Lands in that account's journal, not a new one; its 設定 shows Google 已連結 |
| ST.31 | Airplane mode, open 設定; then airplane mode off, tap 重試 | Under the 連結帳戶 card, 無法載入連結狀態 and 重試, with neither 已連結 nor 連結 on a row; after 重試, each row shows its state and the line is gone **[auto]** |

**ST.1 after Sign in with Apple** may show an `@privaterelay.appleid.com`
address: the User chose Hide My Email, and that relay is their account email.

**ST.27 needs a second account** that already holds the method: sign up a
throwaway with Sign in with Google (or Apple) first, then sign in to the
account under test another way and link. The second account stays as it
was; delete it afterwards from its own 設定.

**ST.30 needs a confirmed email account**: sign up with 使用電子郵件登入
and confirm the address from the inbox before trying Google. Supabase joins
the two only on a confirmed address, so an unconfirmed one gets a new
account instead, which is that rule working.

**ST.18 and ST.19 in English** open Chinese pages. The documents are
Chinese-only until #37 adds English ones (`src/legal.ts`); the row labels
already translate. Not a failure.

### VI — Visibility, across surfaces

| # | Case | Expected |
| --- | --- | --- |
| VI.1 | Hide a Category, check the month grid | **Its dots are gone** **[API]** **[auto]** |
| VI.2 | Check the day panel beneath | Its Entries are gone **[auto]** |
| VI.3 | Open a day holding one | The card is absent; others remain **[auto]** |
| VI.4 | Open the year view | **Days it colored lose their box, and the count drops** **[API]** **[auto]** |
| VI.5 | A day whose Entries are all hidden | An empty cell, never an error **[auto]** |
| VI.6 | A day with a hidden first Entry | The year box takes the topmost **visible** Entry's color **[API]** **[auto]** |
| VI.7 | Hide a Subcategory, leave the parent visible | Only refined Entries go **[auto]** |
| VI.8 | Hide a parent, leave one child visible | That child's Entries stay **[auto]** |
| VI.9 | Change visibility on the year view, return to the month | Both agree **[API]** |
| VI.10 | Force-quit with something hidden, relaunch | The hidden-set survived |
| VI.11 | Create a Category while something is hidden | Born visible **[auto]** |
| VI.12 | Delete a hidden Category | Nothing breaks; the stale id is harmless **[auto]** |
| VI.13 | Hide a Category from the day view's 類別 sheet | Its cards leave the day at once, without closing the day **[auto]** |
| VI.14 | Return to the month, then the year view | Both agree with the hide made on the day view, no relaunch **[API]** **[auto]** |

**VI.1 and VI.4 are round-2 reports #6 and #9.** They pass only when the
deployed revision carries the hidden-set.

### KB — Keyboard, across surfaces

One library, one provider at the root (#42, ADR-0006), so these behave the same
way everywhere rather than per screen.

**A dev client needs a native rebuild for this section.**
`react-native-keyboard-controller` is a native dependency, so a dev client
built before #42 landed shows every case failing for a reason that has nothing
to do with the code. Every TestFlight build carries it. (Expo Go was never an
option for this app; reanimated 4 ruled it out long before this.)

No automated test can see any of this. The jest suite loads the library's mock,
which renders the aware scroll view as a plain scroll view, so the whole
section is only ever verified here.

| # | Case | Expected |
| --- | --- | --- |
| KB.1 | Entry form, tap the Category search | The field rises clear of the keyboard, with the list still readable beneath it |
| KB.2 | Entry form on a chosen Category, tap 子類別 | The pill's field rises clear |
| KB.3 | Entry form, tap 標題 and type past three lines | Rises clear, and stays clear as it grows |
| KB.4 | Entry form, tap the note and type past five lines | Stays clear while it scrolls inside itself, rather than sliding back under |
| KB.5 | Category editor, tap 名稱 | The sheet makes room; the field and its preview icon stay visible |
| KB.6 | Color drawer, tap the hex readout | The drawer rises, and the saturation area stays visible while you type |
| KB.7 | Email sign-in, tap 電子郵件 | Rises clear |
| KB.8 | Email sign-in, tap 密碼 | Rises clear |
| KB.9 | With the keyboard up, tap a button below the field | Acts on the first tap; it does not spend the tap dismissing the keyboard |
| KB.10 | Type Chinese into every single-line field, and into the Entry form's title and note, to three lines | No glyph clipped top or bottom, on any line; the placeholder sits centered in the single-line fields and the empty title |
| KB.11 | Dismiss by tapping empty ground, then refocus | Drops and rises again cleanly, no stuck padding |
| KB.12 | The smallest device you have, color drawer, hex field | The drawer's 取消 and 完成 stay reachable |
| KB.13 | 類別 sheet, tap the search field | The sheet makes room; the filtered tree stays readable beneath it |

KB.12 is the one to watch. The drawer is the tallest sheet and its body does
not scroll, so a short screen is where rising runs out of room.

### DR — Drafts

Walk J5 first: it covers the failed save, the 尚未儲存 row, the relaunch and
the retry. These are the variations on it.

| # | Case | Expected |
| --- | --- | --- |
| DR.4 | With staged Photos | They come back with the Draft **[auto]** |
| DR.5 | With a pending Subcategory name | It returns as a pending pill **[auto]** |
| DR.7 | Edit a Draft before retrying | The newer values are what land **[API]** **[auto]** |
| DR.8 | A save where the Entry lands but Photos fail | 照片上傳失敗; retrying updates that Entry rather than making a second **[API]** **[auto]** |
| DR.9 | A Draft on a day you are not viewing | Appears only on its own day |

Lost-response replays (a create whose reply never arrived) are covered by the
Go and jest suites; they cannot be staged by hand.

### PV — Photo viewer

One full-screen viewer, opened by tapping a photo in the Entry form (#118) or
the Entry view (#119).

| # | Case | Expected |
| --- | --- | --- |
| PV.1 | Tap the second of three photos | Opens on that photo; reads 2 / 3 **[auto]** |
| PV.2 | Swipe left and right | One photo per swipe; it stops at the first and the last, and the count follows |
| PV.3 | An Entry with one photo | No count **[auto]** |
| PV.4 | A saved photo on a slow connection | The thumbnail shows at once and the original replaces it |
| PV.5 | A photo staged in the form, not yet saved | Shows from its copy on the phone **[auto]** |
| PV.6 | Drag down slowly | The photo follows the finger and the black thins out |
| PV.7 | Let go after a short drag | The photo springs back; the viewer stays |
| PV.8 | Let go after a long drag | The viewer closes **[auto]** |
| PV.9 | Tap ✕ | Closes **[auto]** |
| PV.10 | A tall and a wide photo | Each fits whole, nothing cropped |
| PV.11 | On a phone with a Dynamic Island or notch | ✕ and the count sit below the status bar, clear of the island |

### LG — App Language

| # | Case | Expected |
| --- | --- | --- |
| LG.1 | Phone in any Chinese locale, fresh install | The app renders Traditional Chinese **[auto]** |
| LG.2 | Phone in any other locale, fresh install | The app renders English **[auto]** |
| LG.3 | Sign up on a Chinese phone | Starter Categories seeded in Chinese **[API]** **[auto]** |
| LG.4 | Sign up on an English phone | Starter Categories seeded in English **[API]** |
| LG.5 | Change the phone's language later | Starter Categories never retranslate **[API]** **[auto]** |
| LG.6 | Every screen in English | Nothing clipped, nothing overlapping **[#37]** |

### RM — Reminder

Needs a phone where Sprinkie has never asked for notification permission:
a fresh install, or reset it with Settings → General → Transfer or Reset
iPhone → Reset → Reset Location & Privacy. The Reminder needs a native
build; an over-the-air update cannot bring it.

| # | Case | Expected |
| --- | --- | --- |
| RM.1 | 設定 → 一般, switch 每日提醒 on | iOS asks for notification permission once; allowed, the switch stays on and 提醒時間 appears showing 21:00 **[auto]** |
| RM.2 | Set 提醒時間 two minutes ahead, lock the phone and wait | The Reminder arrives at that time: 今天有什麼小事想記下來嗎？ / 一天一行，就好。 |
| RM.3 | Change 提醒時間 again, to another minute ahead | It arrives at the new time only, never also at the old one **[auto]** |
| RM.4 | Switch it off, with the time a minute ahead | 提醒時間 disappears and nothing arrives **[auto]** |
| RM.5 | On a reset phone, switch it on and tap Don't Allow | The switch stays off and nothing more is said **[auto]** |
| RM.6 | Switch it on again after RM.5 | No system prompt; the switch stays off, with the line that the Reminder needs notifications and 前往設定 **[auto]** |
| RM.7 | Tap 前往設定, allow notifications for Sprinkie, return | The iOS Settings app opened on Sprinkie; back in 設定 the switch can be turned on |
| RM.8 | With it on, turn Sprinkie's notifications off in the iOS Settings app, return to 設定 | The switch reads off, with the line and 前往設定; allowing them again turns it back on by itself **[auto]** |
| RM.9 | With it on, switch 語言 to English and set the time a minute ahead | The Reminder arrives in English **[auto]** |
| RM.10 | With it on, 登出, set the clock past the time, or wait for it | Nothing arrives; sign back in and 設定 shows 每日提醒 off **[auto]** |
| RM.11 | Same after 刪除帳號, and after 登出 from the deactivated screen | Same **[auto]** |
| RM.12 | With it on, leave Sprinkie unopened for a few days, then open it | The Reminder kept arriving every day; nothing in the app counts the days |
| RM.34 | After RM.5, go back to the month view and open 設定 again | The switch is off, with the line that the Reminder needs notifications and 前往設定, though it was never switched on; no system prompt **[auto]** |

**RM.2 at 21:00**: once per release pass, leave the default time and let
the real 21:00 Reminder arrive on a locked phone.

**A day that already holds an Entry (#137)**: with the Reminder on and
提醒時間 a few minutes ahead, so each case is seen arriving or not.

| # | Case | Expected |
| --- | --- | --- |
| RM.13 | Save an Entry dated today with +, then wait past the time | Nothing arrives today; tomorrow's arrives **[auto]** |
| RM.14 | Delete today's only Entry before the time | Today's Reminder arrives **[auto]** |
| RM.15 | Move today's only Entry to another date before the time | Today's Reminder arrives **[auto]** |
| RM.16 | Hide a Category in 類別, save today's Entry in it | Nothing arrives today **[auto]** |
| RM.17 | In airplane mode, save an Entry dated today, then wait past the time | The save fails and keeps a Draft; the Reminder arrives. Retrying the Draft before the time silences today **[auto]** |
| RM.18 | Save an Entry for yesterday only | Today's Reminder arrives **[auto]** |
| RM.19 | Save today's Entry, force-quit Sprinkie, open it again, wait past the time | Nothing arrives today **[auto]** |
| RM.20 | Save today's Entry on another phone signed in to the same account, leaving Sprinkie on this phone closed; then repeat, opening Sprinkie on this phone before the Reminder time | Left closed, this phone's Reminder still arrives today; opened, today's Reminder is gone (accepted, ADR-0002 amendment) |
| RM.35 | Save today's Entry, force-quit Sprinkie, turn on airplane mode, open it again, wait past the time | Nothing arrives today. Still offline the next morning, open it again: that day's Reminder arrives **[auto]** |

**The invite after a first Entry (#138)**: it plays once per phone, so
each case starts from a fresh install (deleting Sprinkie also resets its
notification permission) and a new account with no Entries, unless the
case says otherwise.

| # | Case | Expected |
| --- | --- | --- |
| RM.21 | Save the first Entry with + | Back on the month view with today's color, 第一個生活片段，收藏好了。 fades in, holds about two seconds and fades out; then the sheet slides up: 要不要每天提醒你記一行？, the wheel at 21:00, 先不用 and 設定提醒 side by side **[auto]** |
| RM.22 | Spin the wheel to 22:30, tap 設定提醒, then Allow | The sheet closes; 設定 shows 每日提醒 on at 22:30 **[auto]** |
| RM.23 | Tap 設定提醒, then Don't Allow | The sheet closes and nothing is said; 設定 shows 每日提醒 off, with the line and 前往設定 **[auto]** |
| RM.24 | Turn Sprinkie's notifications off in the iOS Settings app first, then save the first Entry and tap 設定提醒 | No system prompt; the sheet closes and 之後可以到設定開啟每日提醒。 fades in and out **[auto]** |
| RM.25 | Tap 先不用; on another fresh install, tap above the sheet | Either one closes it; nothing is asked **[auto]** |
| RM.26 | After RM.21, save more Entries, force-quit, open Sprinkie and save again | Neither the line nor the sheet ever comes back **[auto]** |
| RM.27 | Sign in to an account that already has Entries and save one | Neither the line nor the sheet **[auto]** |
| RM.28 | Save the first Entry from the day view's + | Nothing on the day view; going back to the month view plays RM.21 **[auto]** |
| RM.29 | Look at RM.21 against variant B on `prototype/reminder` | Copy left-aligned, the line with no "！" and no emoji, the wheel in 5-minute steps |
| RM.38 | Save the first Entry from the day view's +, force-quit Sprinkie before going back, open it and save another Entry with + | RM.21 plays then: closing Sprinkie early did not use up the invite **[auto]** |
| RM.39 | Switch 每日提醒 on in 設定 first, then save the first Entry | The line plays; no sheet follows **[auto]** |
| RM.40 | Save the first Entry with +, and while the line shows tap 設定, then 返回 | The tap reaches 設定 through the line; back on the month view RM.21 plays again, line and sheet |

**Tapping a Reminder (#140)**: set 提醒時間 a minute ahead for each.

| # | Case | Expected |
| --- | --- | --- |
| RM.30 | Force-quit Sprinkie, lock the phone, tap the Reminder when it arrives and unlock | Sprinkie opens on the Entry form for today; 取消 lands on the month view on today **[auto]** |
| RM.31 | Leave Sprinkie in the background on another month, tap the Reminder | The Entry form for today; 儲存 lands on the month view on today, the new Entry on it **[API]** **[auto]** |
| RM.32 | With Sprinkie open on the month view, wait for the Reminder | It shows as a banner; tapping the banner opens the Entry form for today **[auto]** |
| RM.33 | Let a Reminder arrive and leave it in Notification Center; 登出, force-quit, then tap it | Sign-in opens and nothing else; signing in lands on the month view, not the form **[auto]** |
| RM.36 | Open + on yesterday, write nothing, then tap the Reminder from Notification Center | The form switches to today **[auto]** |
| RM.37 | Open + on yesterday, from the month view and again from yesterday's day view, type a title, then tap the Reminder | The form stays on yesterday, the title still there **[auto]** |

### AX — Accessibility

| # | Case | Expected |
| --- | --- | --- |
| AX.1 | VoiceOver on the month grid | Days are reachable and announced |
| AX.2 | VoiceOver on the 類別 sheet | Rows announce their visibility state |
| AX.3 | VoiceOver on the color drawer | The area and hue strip are adjustable |
| AX.4 | Larger text sizes | Nothing clipped past legibility |
| AX.5 | Every tap target | At least 44pt |
| AX.6 | VoiceOver: swipe up, then down, on the month title | It is announced as adjustable with the full month (2026年10月); up steps to the next month and down to the previous, each announced. ‹ 2026年, 類別 and 設定 stay separate stops **[auto]** |

---

## Automated coverage

The tests behind each **[auto]** case. Paths are under `apps/mobile/src/`, or
`api/internal/server/` for a `_test.go`. A test that weakens or goes away
takes its case's tag with it, and a new test that asserts a whole case adds
the tag.

| # | Tests |
| --- | --- |
| J5.3 | `screens/DayScreen.drafts.test.tsx`, `AppRoot.test.tsx` |
| J6.1 | `AppRoot.test.tsx` |
| SI.5 | `screens/SignInScreen.test.tsx` |
| SI.6 | `screens/SignInScreen.test.tsx` |
| SI.7 | `screens/SignInScreen.test.tsx` |
| SI.8 | `screens/SignInScreen.test.tsx` |
| SI.9 | `AppRoot.test.tsx`, `screens/EmailSignInScreen.test.tsx` |
| SI.11 | `screens/SignInScreen.test.tsx` |
| SI.18 | `screens/EmailSignInScreen.test.tsx` |
| SI.19 | `screens/EmailSignInScreen.test.tsx` |
| SI.21 | `screens/EmailSignInScreen.test.tsx` |
| SI.23 | `screens/EmailSignInScreen.test.tsx` |
| SI.25 | `screens/EmailSignInScreen.test.tsx` |
| SI.26 | `screens/EmailSignInScreen.test.tsx` |
| SI.27 | `screens/EmailSignInScreen.test.tsx` |
| MO.1 | `screens/MonthScreen.test.tsx`, `AppRoot.test.tsx` |
| MO.2 | `screens/MonthScreen.test.tsx` |
| MO.3 | `screens/MonthScreen.test.tsx` |
| MO.4 | `screens/MonthScreen.test.tsx` |
| MO.5 | `screens/MonthScreen.test.tsx` |
| MO.9 | `screens/MonthScreen.test.tsx` |
| MO.10 | `screens/MonthScreen.test.tsx` |
| MO.11 | `screens/MonthScreen.test.tsx` |
| MO.15 | `screens/MonthScreen.test.tsx` |
| MO.16 | `screens/MonthScreen.test.tsx` |
| MO.17 | `screens/MonthScreen.test.tsx`, `AppRoot.test.tsx` |
| MO.18 | `screens/MonthScreen.test.tsx`, `AppRoot.test.tsx` |
| MO.19 | `screens/MonthScreen.test.tsx` |
| MO.20 | `screens/MonthScreen.test.tsx` |
| MO.21 | `screens/MonthScreen.test.tsx` |
| MO.22 | `screens/MonthScreen.test.tsx` |
| MO.23 | `screens/MonthScreen.test.tsx` |
| MO.24 | `screens/MonthScreen.test.tsx` |
| MO.25 | `screens/MonthScreen.test.tsx` |
| MO.30 | `calendar/CalendarFloatingActions.test.tsx` |
| MO.32 | `AppRoot.test.tsx` |
| MO.33 | `AppRoot.test.tsx` |
| MO.34 | `AppRoot.test.tsx` |
| DA.2 | `screens/DayScreen.test.tsx` |
| DA.3 | `AppRoot.test.tsx` |
| DA.4 | `screens/DayScreen.test.tsx`, `entries_edit_test.go` |
| DA.7 | `AppRoot.test.tsx` |
| DA.8 | `screens/DayScreen.drafts.test.tsx` |
| DA.9 | `screens/DayScreen.drafts.test.tsx` |
| DA.11 | `screens/DayScreen.drafts.test.tsx`, `AppRoot.test.tsx` |
| DA.13 | `screens/DayScreen.test.tsx` |
| DA.15 | `screens/DayScreen.test.tsx` |
| DA.16 | `screens/DayScreen.test.tsx` |
| DA.22 | `screens/DayScreen.test.tsx`, `calendar/CategorySheet.test.tsx` |
| EV.2 | `AppRoot.test.tsx` |
| EV.4 | `AppRoot.test.tsx` |
| EV.6 | `AppRoot.test.tsx` |
| EV.7 | `AppRoot.test.tsx` |
| EV.8 | `AppRoot.test.tsx` |
| EV.9 | `AppRoot.test.tsx` |
| EV.10 | `AppRoot.test.tsx` |
| EV.14 | `AppRoot.test.tsx` |
| EV.15 | `AppRoot.test.tsx` |
| EF.1 | `screens/EntryFormScreen.test.tsx` |
| EF.5 | `screens/EntryFormScreen.test.tsx` |
| EF.7 | `screens/DayScreen.test.tsx` |
| EF.10 | `screens/DayScreen.test.tsx`, `screens/EntryFormScreen.test.tsx` |
| EF.12 | `screens/EntryFormScreen.test.tsx` |
| EF.15 | `screens/EntryFormScreen.test.tsx` |
| EF.16 | `screens/EntryFormScreen.test.tsx` |
| EF.17 | `screens/EntryFormScreen.test.tsx`, `entries/save.test.ts` |
| EF.18 | `screens/EntryFormScreen.test.tsx`, `entries/save.test.ts` |
| EF.19 | `screens/EntryFormScreen.test.tsx` |
| EF.20 | `screens/EntryFormScreen.test.tsx` |
| EF.21 | `screens/DayScreen.test.tsx` |
| EF.26 | `screens/EntryFormScreen.test.tsx` |
| EF.27 | `screens/EntryFormScreen.test.tsx` |
| EF.28 | `screens/EntryFormScreen.test.tsx` |
| EF.30 | `screens/EntryFormScreen.test.tsx` |
| EF.31 | `screens/EntryFormScreen.test.tsx`, `entries_test.go` |
| EF.33 | `entries_edit_test.go`, `screens/EntryFormScreen.test.tsx` |
| EF.36 | `screens/DayScreen.test.tsx` |
| EF.38 | `screens/DayScreen.drafts.test.tsx` |
| EF.40 | `screens/EntryFormScreen.test.tsx` |
| EF.41 | `screens/EntryFormScreen.test.tsx`, `screens/DayScreen.test.tsx` |
| EF.44 | `screens/EntryFormScreen.test.tsx` |
| EF.46 | `screens/EntryFormScreen.test.tsx` |
| EF.47 | `screens/EntryFormScreen.test.tsx` |
| EF.51 | `screens/EntryFormScreen.test.tsx` |
| EF.55 | `screens/EntryFormScreen.test.tsx` |
| EF.56 | `screens/EntryFormScreen.test.tsx` |
| EF.57 | `screens/EntryFormScreen.test.tsx` |
| EF.59 | `screens/EntryFormScreen.test.tsx` |
| YR.2 | `screens/YearScreen.test.tsx`, `years_test.go` |
| YR.4 | `screens/YearScreen.test.tsx`, `calendar/ribbon.test.ts` |
| YR.6 | `calendar/ribbon.test.ts` |
| YR.7 | `screens/YearScreen.test.tsx` |
| YR.8 | `screens/YearScreen.test.tsx` |
| YR.9 | `screens/YearScreen.test.tsx` |
| YR.10 | `screens/YearScreen.test.tsx` |
| YR.12 | `screens/YearScreen.test.tsx` |
| YR.15 | `screens/YearScreen.test.tsx` |
| YR.16 | `screens/YearScreen.test.tsx` |
| YR.17 | `screens/YearScreen.test.tsx` |
| YR.20 | `screens/YearScreen.test.tsx` |
| YR.21 | `screens/YearScreen.test.tsx`, `screens/MonthScreen.test.tsx` |
| CS.4 | `calendar/hidden.test.ts` |
| CS.6 | `calendar/CategorySheet.test.tsx` |
| CS.8 | `calendar/CategorySheet.test.tsx` |
| CS.9 | `calendar/CategorySheet.test.tsx` |
| CS.10 | `calendar/CategorySheet.test.tsx` |
| CS.11 | `calendar/CategorySheet.test.tsx` |
| CS.13 | `AppRoot.test.tsx` |
| CS.14 | `calendar/CategorySheet.test.tsx` |
| CS.15 | `calendar/CategorySheet.test.tsx` |
| CS.16 | `calendar/CategorySheet.test.tsx` |
| CS.17 | `calendar/CategorySheet.test.tsx` |
| CS.18 | `calendar/CategorySheet.test.tsx` |
| CS.19 | `calendar/CategorySheet.test.tsx` |
| CS.20 | `calendar/CategorySheet.test.tsx` |
| CS.21 | `calendar/CategorySheet.test.tsx` |
| CE.3 | `categories/CategoryEditorSheet.test.tsx` |
| CE.4 | `categories/CategoryEditorSheet.test.tsx` |
| CE.6 | `categories/CategoryEditorSheet.test.tsx` |
| CE.8 | `categories/CategoryEditorSheet.test.tsx` |
| CE.11 | `categories/CategoryEditorSheet.test.tsx` |
| CE.12 | `categories/CategoryEditorSheet.test.tsx` |
| CE.16 | `calendar/CategorySheet.test.tsx` |
| CE.20 | `calendar/CategorySheet.test.tsx` |
| CE.21 | `categories/CategoryEditorSheet.test.tsx` |
| CE.22 | `categories/CategoryEditorSheet.test.tsx` |
| CD.5 | `categories/ColorPresetPicker.test.tsx` |
| CD.8 | `categories/ColorDrawer.test.tsx` |
| CD.9 | `categories/ColorDrawer.test.tsx` |
| CD.11 | `colors_test.go` |
| CD.14 | `colors_test.go` |
| CD.17 | `categories/ColorPresetPicker.test.tsx` |
| CD.18 | `categories/ColorPresetPicker.test.tsx` |
| CD.19 | `colors_test.go` |
| CD.20 | `colors_test.go` |
| CD.21 | `categories/ColorDrawer.test.tsx` |
| ST.3 | `screens/SettingsScreen.language.test.tsx` |
| ST.7 | `AppRoot.test.tsx` |
| ST.8 | `screens/SettingsScreen.language.test.tsx` |
| ST.10 | `screens/SettingsScreen.test.tsx` |
| ST.11 | `screens/SettingsScreen.test.tsx` |
| ST.16 | `AppRoot.test.tsx`, `account_test.go` |
| ST.18 | `screens/SettingsScreen.test.tsx` |
| ST.19 | `screens/SettingsScreen.test.tsx` |
| ST.23 | `screens/SettingsScreen.test.tsx` |
| ST.24 | `screens/SettingsScreen.test.tsx` |
| ST.25 | `screens/SettingsScreen.test.tsx` |
| ST.28 | `screens/SettingsScreen.test.tsx` |
| ST.31 | `screens/SettingsScreen.test.tsx` |
| VI.1 | `months_test.go` |
| VI.2 | `AppRoot.test.tsx` |
| VI.3 | `AppRoot.test.tsx` |
| VI.4 | `years_test.go` |
| VI.5 | `months_test.go` |
| VI.6 | `years_test.go` |
| VI.7 | `months_test.go` |
| VI.8 | `months_test.go` |
| VI.11 | `calendar/hidden.test.ts` |
| VI.12 | `AppRoot.test.tsx` |
| VI.13 | `AppRoot.test.tsx` |
| VI.14 | `AppRoot.test.tsx` |
| DR.4 | `screens/DayScreen.drafts.test.tsx`, `entries/save.test.ts` |
| DR.5 | `screens/EntryFormScreen.test.tsx` |
| DR.7 | `screens/DayScreen.drafts.test.tsx`, `entries/save.test.ts` |
| DR.8 | `screens/DayScreen.drafts.test.tsx`, `entries/save.test.ts` |
| PV.1 | `entries/PhotoViewer.test.tsx` |
| PV.3 | `entries/PhotoViewer.test.tsx` |
| PV.5 | `entries/PhotoViewer.test.tsx` |
| PV.8 | `entries/PhotoViewer.test.tsx` |
| PV.9 | `entries/PhotoViewer.test.tsx` |
| LG.1 | `i18n/appLanguage.test.ts` |
| LG.2 | `i18n/appLanguage.test.ts`, `i18n/englishScreens.test.tsx` |
| LG.3 | `AppRoot.test.tsx`, `me_test.go` |
| LG.5 | `me_test.go` |
| RM.1 | `AppRoot.test.tsx` |
| RM.3 | `AppRoot.test.tsx` |
| RM.4 | `AppRoot.test.tsx` |
| RM.5 | `AppRoot.test.tsx` |
| RM.6 | `AppRoot.test.tsx` |
| RM.8 | `AppRoot.test.tsx` |
| RM.9 | `AppRoot.test.tsx` |
| RM.10 | `AppRoot.test.tsx` |
| RM.11 | `AppRoot.test.tsx` |
| RM.13 | `AppRoot.test.tsx` |
| RM.14 | `AppRoot.test.tsx` |
| RM.15 | `AppRoot.test.tsx` |
| RM.16 | `AppRoot.test.tsx` |
| RM.17 | `AppRoot.test.tsx` |
| RM.18 | `AppRoot.test.tsx` |
| RM.19 | `AppRoot.test.tsx` |
| RM.21 | `AppRoot.test.tsx` |
| RM.22 | `AppRoot.test.tsx` |
| RM.23 | `AppRoot.test.tsx` |
| RM.24 | `AppRoot.test.tsx` |
| RM.25 | `AppRoot.test.tsx` |
| RM.26 | `AppRoot.test.tsx` |
| RM.27 | `AppRoot.test.tsx` |
| RM.28 | `AppRoot.test.tsx` |
| RM.30 | `AppRoot.test.tsx` |
| RM.31 | `AppRoot.test.tsx` |
| RM.32 | `AppRoot.test.tsx` |
| RM.33 | `AppRoot.test.tsx` |
| RM.34 | `AppRoot.test.tsx` |
| RM.35 | `AppRoot.test.tsx` |
| RM.36 | `AppRoot.test.tsx` |
| RM.37 | `AppRoot.test.tsx` |
| RM.38 | `AppRoot.test.tsx` |
| RM.39 | `AppRoot.test.tsx` |
| AX.6 | `screens/MonthScreen.test.tsx` |
