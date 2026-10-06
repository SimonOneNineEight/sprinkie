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
| After an API deploy | Every case marked **[API]** |
| Chasing a bug | Its section first, before touching code |

## Before you start

```sh
# The revision this run gates
gcloud run revisions list --service daily-wlog-api --region us-west1 --limit 1

# A device build must source the hosted env or it silently talks to localhost
cd apps/mobile && pnpm start:hosted
```

Journey 1 and the account-lifecycle cases need a **throwaway User**, since
they end in deactivation. Everything else runs on a **standing test User**
whose Journal carries several months of Entries across at least three
Categories, one of them with Subcategories, and at least one day holding five
or more Entries.

## Recording a run

Post a comment on the release issue:

```
Manual pass — <date>
Build: <EAS build number, or commit sha for a dev client>
Revision: <Cloud Run revision, e.g. daily-wlog-api-00004-fwr>
Device: <model>, iOS <version>
Scope: full | [API] only

Failures: <case ids, or "none">
```

The revision line is the point of the exercise. Without it, "was this build
ever tested against the current server" has no answer.

## Legend

**[API]** — the case crosses the network to `daily-wlog-api` or Supabase
Storage, so a deploy can break it with the app untouched. The post-deploy pass
is exactly these.

**[#NN]** — a known open defect. The case states the behavior we want, it
fails today, and ticket #NN closes it. A first run is expected to list these,
and they are not news.

Cases describe the app **as it ships today**. Where round 2 changes a
behavior, the ticket that changes it updates its case in the same branch;
each section names the tickets heading for it.

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
| J3.2 | Tap ‹年, pick a month from a past year | Year view opens, then that month **[API]** |
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
| J5.3 | Force-quit, relaunch, open the day | The row is still there |
| J5.4 | Airplane mode off, tap it, tap 儲存 | Saves; the row disappears; the Photo is on the Entry **[API]** |

### J6 — Leaving and coming back

Throwaway User. Ends deactivated.

| # | Steps | Expected |
| --- | --- | --- |
| J6.1 | 設定 → 登出 | Sign-in screen |
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
| SI.1 | The screen at rest | Wordmark, one line of promise, provider buttons. Nothing else |
| SI.2 | Sign in with Apple | Completes and lands on the month view **[API]** |
| SI.3 | Cancel the Apple sheet | Returns to sign-in with **no** error message — a cancelled sheet is a decision |
| SI.4 | Sign in with Google | Completes and lands on the month view **[API]** |
| SI.5 | Cancel the Google sheet | Returns to sign-in; an error here is acceptable, a crash is not |
| SI.6 | 使用電子郵件登入 | The email page opens on its own |
| SI.7 | Email page, back chevron | Returns to the provider screen |
| SI.8 | Email + password, 登入 | Signs in **[API]** |
| SI.9 | Toggle to 建立帳戶, submit a new address | Either signs in, or shows the confirm-your-email notice **[API]** |
| SI.10 | Wrong password | Plain error, nothing lost from the fields **[API]** |
| SI.11 | Empty email or password, submit | Nothing happens; no request fired |
| SI.12 | Airplane mode, submit | Plain error, no crash |
| SI.13 | Password field | Masked, and offers the right autofill (current vs new) per mode |

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
| MO.1 | Open the app | Lands on this month with today selected |
| MO.2 | Today's cell, unselected | Thin ring |
| MO.3 | Today's cell, selected | Filled circle |
| MO.4 | Tap another day | The filled circle moves to it; today keeps the ring |
| MO.5 | Tap the selected day again | The day view opens |
| MO.6 | A day with Entries | Dots in Category colors, in Entry order, touching **[API]** |
| MO.7 | A day with five or more Entries | Four dots and a **+** overflow glyph, sitting on the dots' line **[API]** |
| MO.8 | Days outside the month | Greyed and not tappable |
| MO.9 | Swipe left / right | One month per swipe, both directions, repeatedly **[API]** |
| MO.10 | Swipe several months fast | Each settle loads that month's dots; the month you left never paints on the one you arrived at, even for an instant **[API]** |
| MO.11 | Move to a month that is not this month | No day is selected until you tap one |
| MO.12 | The day panel | The selected day's Entry titles with Category icons **[API]** |
| MO.13 | A panel row for an Entry with Photos | Carries the photo glyph **[API]** |
| MO.14 | Tap the panel header or any row | Opens the day view |
| MO.15 | A day with no Entries | Panel reads 這天沒有紀錄 |
| MO.16 | Tap the floating + | Entry form opens for the **selected** day, not today |
| MO.17 | Tap ‹年 | The year view opens on the year you were viewing, including after swiping across a year boundary |
| MO.18 | Tap 設定 | Settings opens |
| MO.19 | Tap 類別 | The visibility sheet opens |
| MO.20 | Airplane mode, swipe months | Dots are absent, not wrong; no error wall, no crash |
| MO.21 | A month holding no Entries at all | Grid renders with no dots anywhere; the panel reads 這天沒有紀錄 **[API]** |
| MO.22 | Swipe months away, tap the floating 今天 | This month, with today selected **[API]** |
| MO.23 | Tap 今天 while already on this month | Selection returns to today; nothing else moves |
| MO.24 | Hide a Category while its dots are on screen | The dots go; the month never briefly shows the old set **[API]** |
| MO.25 | The nav bar | Only 類別 and 設定; 今天 floats at the bottom |
| MO.30 | The two controls side by side | Both 44pt; their tops and bottoms line up |
| MO.26 | A day with more Entries than the panel fits | The panel scrolls, and its last row scrolls clear of the floating controls |
| MO.27 | Scroll the day panel | Both controls fade out while scrolling and return when it stops |
| MO.28 | Tap between the two controls while they are showing | The tap reaches the panel beneath, not the gap |
| MO.29 | On a device with a home indicator | Both controls sit above the indicator, never over it |
| MO.31 | The controls against the month title and the day card | Their left and right edges line up with both |

### DA — Day view

| # | Case | Expected |
| --- | --- | --- |
| DA.1 | Open a day with Entries | Cards with title, Category icon, Subcategory name, note preview, photo thumbnails **[API]** |
| DA.2 | A day with none: today, then any other date | Today reads 今天還沒有紀錄; every other date reads 這天沒有紀錄 |
| DA.3 | Tap a card | The Entry form opens prefilled |
| DA.4 | Long-press and drag a card | It moves; the order holds on return **[API]** |
| DA.5 | Scroll a long list vertically | Scrolls; no accidental day change |
| DA.6 | Swipe left / right | Previous and next date, gestures surviving the list underneath |
| DA.7 | Back chevron | Returns to the month view |
| DA.8 | Tap the floating + | Entry form for this day |
| DA.9 | A day holding a retained Draft | A 尚未儲存 row above the cards |
| DA.10 | Several Drafts on one day | All of them listed |
| DA.11 | Tap a Draft row | The form opens prefilled from it |
| DA.12 | A day where something is hidden | Hidden cards absent; long-press drag does nothing |
| DA.13 | Airplane mode, open a day | 無法載入紀錄, no crash |
| DA.14 | An Entry whose content will not decode | The card renders （無法讀取的紀錄） rather than failing |
| DA.15 | Airplane mode, long-press and drag a card | 排序失敗，請再試一次, and the order returns to what the server holds **[API]** |
| DA.16 | Tap the floating 今天 | The view moves to today's date **[API]** |
| DA.17 | Scroll a long card list to its end | The last card scrolls clear of the floating controls |
| DA.18 | Scroll the card list | Both controls fade while scrolling and return when it stops |
| DA.19 | Long-press-drag a card near the bottom | The drag works; the faded controls do not intercept it |
| DA.20 | On a device with a home indicator | Both controls sit above the indicator, never over it |
| DA.21 | The gap below the controls | The same on the day, month and year views |
| DA.22 | Tap the 類別 icon in the header | The same sheet the month and year views open: the two-level tree, ✎ per row, 全部隱藏 and 新增類別 |

### EF — Entry form

| # | Case | Expected |
| --- | --- | --- |
| EF.1 | Open from a day | Date row reads that day |
| EF.2 | Tap the date row | The picker sheet opens on that month, the day marked |
| EF.3 | Step the picker's months | Both directions; today wears its mark only in its own month |
| EF.4 | Pick a day | Sheet closes, the date row updates |
| EF.5 | Tap the scrim | Closes without changing the date |
| EF.6 | Before choosing a Category | Only the search field and Category list show; no title or note |
| EF.7 | Type in the search field | The list filters live; every typed character is legible |
| EF.8 | Type a name nothing matches | A 建立「…」 row appears above the pinned 新增類別 row |
| EF.9 | Tap either creation row | The full Category editor opens, prefilled with what you typed |
| EF.10 | Save from that editor | The editor closes and the new Category is selected into the form **[API]** |
| EF.11 | Pick a Category | Its row collapses; title, note, and the photo grid appear |
| EF.12 | Tap the collapsed Category row | Deselects, returning to the list |
| EF.13 | Subcategory pills | One per child, dots in the parent's color |
| EF.14 | Tap a pill, tap it again | Selects, then deselects |
| EF.15 | Tap + in the pill row, type, tap 建立 | Created immediately and selected **[API]** |
| EF.16 | Type a name and leave the field instead | Renders as a selected pending pill; nothing created yet |
| EF.17 | Save with a pending pill | The Subcategory is created with the Entry **[API]** |
| EF.18 | Press return in the Subcategory field | Never creates |
| EF.19 | Tap a pending pill | Deselects and clears it |
| EF.20 | Title field | Stops at 40 characters |
| EF.21 | Empty title | 儲存 disabled |
| EF.22 | Note field | Multiline, grows as you type |
| EF.23 | Tap the photo tile | Camera / library / cancel offered |
| EF.24 | Choose from the library | Multi-select allowed, capped at the slots still free of the three |
| EF.25 | Take a photo | Appears in the grid |
| EF.26 | Deny the camera permission | Nothing happens; no crash, no empty tile |
| EF.27 | Add Photos up to the cap | The tile counts n/3 and disappears at the third |
| EF.28 | Tap a photo tile | Confirmation, then it goes **[API]** for a saved Entry |
| EF.29 | Long-press and drag photos | Order changes and persists after save **[API]** |
| EF.30 | Save an Entry carrying Photos | 儲存 spins for the whole save and the form beneath it is inert; the app never looks hung **[API]** |
| EF.31 | Tap 儲存 twice quickly | One Entry, not two **[API]** |
| EF.32 | Editing: change the Category | Saves; the dot color changes on the grid **[API]** |
| EF.33 | **Editing: change the date, save** | The Entry leaves its day and appears on the target day, last in order **[API]** |
| EF.34 | After EF.33, return to the original day | It is gone from there **[API]** |
| EF.35 | 刪除紀錄, confirm | The Entry and its dot are gone **[API]** |
| EF.36 | 取消 with unsaved edits | Returns without saving |
| EF.37 | Airplane mode, 儲存 | 儲存失敗，請再試一次; the form keeps everything |
| EF.38 | A restored Draft whose photo files the OS purged | 部分照片已無法讀取, and a retry saves what survives |
| EF.39 | Deny the photo-library permission | Nothing happens; no crash, no empty tile |
| EF.40 | Open the form with every Category deleted | Only the pinned 新增類別 row; 儲存 stays disabled until one exists |
| EF.41 | Open an Entry saved with more than three Photos | Every Photo is still there; no add tile, and nothing is deleted **[API]** |
| EF.42 | Attach three of the largest photos on the device at once | All three tiles appear together, and the wait is visibly shorter than the old build |

**EF.33 and EF.34 are round-2 report #1.** They pass only when the deployed
revision carries the date-move.

**EF.42 times the attach; it does not watch for a crash.** Each photo used to
decode its original twice, and #53 halved that. Use the biggest frames the
library holds, a burst export or a 48MP capture, since a 12MP photo is too
quick to tell apart. Expect a wait with nothing on screen either way: there is
no progress indicator, so a slow return is the case passing. What changed is
how slow — on a simulator, three large frames went from ~1150ms to ~700ms.

Do not expect this case to stop the app being killed, and do not treat a crash
here as a #53 regression. The two decodes per photo were always sequential, so
three photos were the most ever decoded at once before the change and still
are. Whether the peak moved at all is unmeasured: on a simulator the same build
varied by 116 MB between runs, wider than the gap between versions, so the
method could not answer it. The peak belongs to the Promise.all in
EntryFormScreen, tracked as #69, and a device has never been measured.

Round 2: #44 (cap of 3, saving spinner). Keyboard cases are in **KB**.

### YR — Year view

The ribbon (#51). A year is no longer a page you turn to, so every case below
is about scrolling rather than paging.

| # | Case | Expected |
| --- | --- | --- |
| YR.1 | Open it | Today's month sits centred, with the preceding months above it — never flush against the top **[API]** |
| YR.2 | A recorded day | A solid box in its first visible Entry's Category color **[API]** |
| YR.3 | Today | Marked in its mini month |
| YR.4 | Scroll down past December | January follows with no break and no page turn |
| YR.5 | The January row | Carries a small year caption, so the new year announces itself |
| YR.6 | Keep scrolling, several years | Months keep coming in both directions; nothing runs out **[API]** |
| YR.7 | Watch the header while scrolling | The year and its count follow the topmost visible month, changing as you cross into another year **[API]** |
| YR.8 | The count, current year vs a past year | This-year wording on the current year, total wording on any other **[API]** |
| YR.9 | Scroll up, years into the past | Months load as they arrive; a year already seen does not refetch **[API]** |
| YR.10 | Tap a mini month | The month view opens on it |
| YR.11 | Tap the year title | The wheel opens directly under the header, the year the header is showing centred; the count beneath is not a tap target |
| YR.12 | Pick a year from the wheel | The ribbon scrolls to that year rather than swapping a page **[API]** |
| YR.13 | Pick a year at either end of the wheel | Scrolls there without crashing; future years are allowed, since backfilling is the product |
| YR.14 | Tap the scrim | The wheel closes, the position unchanged |
| YR.15 | Scroll far away, then tap 今天 | Scrolls back to today's month and stays on the year view |
| YR.16 | Swipe left or right | Nothing happens; the surface scrolls vertically now |
| YR.17 | There is no back button and no chevrons | Correct; scrolling, the title and a month tap are the navigation |
| YR.18 | Tap 類別 | The visibility sheet opens |
| YR.19 | Hide a Category, return | Its days lose their color across every year on screen **[API]** |
| YR.20 | Airplane mode | Mini months render empty, no crash |
| YR.21 | From a month in a past year, tap ‹年 | The ribbon opens on **that month**, not that year's January and not this year |

| YR.22 | The last row of the ribbon | Clears 今天; nothing is trapped under the floating control |
| YR.23 | Scroll, then stop | 今天 fades out while moving and returns when the ribbon settles |
| YR.24 | The home indicator | Clears the floating control, and the control clears the content |

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
| CS.4 | Tap it again | The whole family returns |
| CS.5 | A Subcategory row | A check-circle in the parent's color, filled when visible |
| CS.6 | Tap a Subcategory | Only that child toggles |
| CS.7 | Hide a parent, show one child | The parent's circle stays lit while any member is visible |
| CS.8 | 全部隱藏 | Everything hides; the label flips to 全部顯示 |
| CS.9 | 全部顯示 | Everything returns |
| CS.10 | Tap ✎ on any row | The editor opens for it |
| CS.11 | Tap 新增類別 | The editor opens in create mode |
| CS.12 | 完成 or the scrim | Closes; changes already applied |
| CS.13 | Reopen after closing | The same visibility state |
| CS.14 | The sheet with every Category deleted | Only 新增類別; no empty tree, no error |
| CS.15 | Type a Category's name in the search field | Only that Category's family remains |
| CS.16 | Type a Subcategory's name | Its parent stays as context; the parent's other children drop |
| CS.17 | Clear the field | The whole tree returns, visibility unchanged |
| CS.18 | Type something nothing matches | Only the pinned 新增類別 row remains |
| CS.19 | While filtered, tap a parent row | The whole family toggles, including members the search is hiding |
| CS.20 | While filtered, 全部隱藏 | Acts on every Category, not just the matches |
| CS.21 | Type a name, then 新增類別 | The editor opens with that name already in the field |
| CS.22 | Tap a row while the keyboard is up | It toggles on the first tap, rather than only dropping the keyboard |

Round 2: #48 (CS.15–CS.22). Keyboard cases are in **KB**.

### CE — Category editor

| # | Case | Expected |
| --- | --- | --- |
| CE.1 | Open in create mode | Name focused, the preview icon beside it |
| CE.2 | Type a name | The preview updates live |
| CE.3 | Empty name | 儲存 disabled |
| CE.4 | Tap the 上層分類 row | The list swaps in for the summary row |
| CE.5 | Pick a parent | The list collapses, the choice marked ✓ |
| CE.6 | Pick 無 | Collapses back to an independent Category |
| CE.7 | With a parent chosen | The color and icon blocks render disabled, with the inherit note |
| CE.8 | Editing an existing Category | The parent row is not tappable — parenthood is fixed |
| CE.9 | Tap a preset color | Selected with a ring; the preview follows |
| CE.10 | Scroll the icon grid | Scrolls inside its card, not the sheet |
| CE.11 | Tap an icon | It becomes the selection |
| CE.12 | Which icon is selected | Its cell fills with the Category color, glyph in white — identifiable at a glance |
| CE.13 | Save | The sheet closes and the change shows everywhere **[API]** |
| CE.14 | Editing a parent: the 子類別 list | Every child listed, each opening its own editor |
| CE.15 | 新增子類別 from there | Create mode with the parent preselected |
| CE.16 | An unused Category | 刪除類別 offered; deleting removes it **[API]** |
| CE.17 | A Category with Entries | No delete; the in-use explanation instead **[API]** |
| CE.18 | A Category with children | No delete; the children explanation instead **[API]** |
| CE.19 | Tap empty sheet ground while typing | The keyboard drops |
| CE.20 | Airplane mode, save | 儲存失敗，請再試一次; nothing lost |
| CE.21 | Change the color after choosing an icon | The chosen cell takes the new color; the icon stays chosen |
| CE.22 | With a parent chosen, the dimmed icon grid | The inherited glyph is still identifiable, filled in the parent's color |

Keyboard cases are in **KB**.

### CD — Color drawer

| # | Case | Expected |
| --- | --- | --- |
| CD.1 | Tap 自訂顏色 | Opens on the current color |
| CD.2 | Drag in the saturation area | The color follows the drag, live |
| CD.3 | Drag the hue strip | The area repaints in the new hue |
| CD.4 | Very dark and very light picks | Allowed; the preview is the guardrail, not a clamp |
| CD.5 | The preview week | The chosen color appears as real dots beside existing Categories |
| CD.6 | The side-by-side row | Your Categories' colors next to the chosen one, ringed |
| CD.7 | The hex readout | Matches the chosen color, uppercase |
| CD.8 | Tap the readout, type a valid hex | The picker jumps to it |
| CD.9 | Type a partial or invalid hex | Ignored quietly, nothing jumps |
| CD.10 | 已存的顏色, when colors have been saved | Most-recent first; tapping one selects it |
| CD.11 | 已存的顏色, on a fresh User | The row is absent, not empty **[API]** |
| CD.12 | 完成, then save the Category | The color is applied **and** joins 已存的顏色 **[API]** |
| CD.13 | 完成, then **cancel** the editor | The color does **not** join 已存的顏色 **[API]** |
| CD.14 | Save more than twelve custom colors over time | The oldest drop; the cap holds **[API]** |
| CD.15 | Airplane mode, open the drawer | The saved row is simply empty; the picker still works |
| CD.16 | Long-press a color in 已存的顏色 | A confirmation, saying the Categories using it keep it |
| CD.17 | Cancel that confirmation | The color stays in the row |
| CD.18 | Confirm it | The color leaves 已存的顏色 there and then, with the drawer still open **[API]** |
| CD.19 | A Category wearing the forgotten color | Still wears it — on its editor, on the month view, in the day list **[API]** |
| CD.20 | Reopen the drawer | The color is still gone; the rest of the row is in the same order **[API]** |

**CD.18–CD.20 need this round's API deployed.** `DELETE /color-recents/{hex}`
arrives with #47; against an older revision the long-press and its
confirmation still work (CD.16, CD.17, both client-side) and confirming then
reports 移除失敗. That is the deployment gap, not the feature.

Round 2: #47 (CD.16–CD.20). Keyboard cases are in **KB**.

### ST — Settings and account

| # | Case | Expected |
| --- | --- | --- |
| ST.1 | Open it | The account's email, the 語言 row, a 關於 card with 隱私權政策 and 服務條款, 登出, 刪除帳號 |
| ST.2 | Tap 語言 | The sheet offers exactly 系統預設 / 繁體中文 / English |
| ST.3 | The two language names | Shown as endonyms, never translated |
| ST.4 | Pick 繁體中文 | The UI switches immediately; the row's value updates |
| ST.5 | Pick English | Same, in the other direction |
| ST.6 | Pick 系統預設 | Follows the phone again |
| ST.7 | After switching | Entry titles and Category names are untouched |
| ST.8 | Relaunch after switching | The choice survived |
| ST.9 | 登出 | Sign-in screen |
| ST.10 | 刪除帳號 | Confirmation naming the 30-day grace |
| ST.11 | Cancel it | Nothing happens |
| ST.12 | Confirm it | Deactivated screen **[API]** |
| ST.13 | Relaunch while deactivated | Still the deactivated screen — a session restore alone never reopens it |
| ST.14 | 復原帳號 | The account and its Entries return **[API]** |
| ST.15 | 登出 from the deactivated screen | Sign-in screen; signing back in returns to the gate **[API]** |
| ST.16 | Deactivate on one device, use the app on another | The second device meets the gate **[API]** |
| ST.17 | Deactivate on a second device while this one sits open, then act here | The next request meets the gate rather than failing oddly **[API]** |
| ST.18 | Tap 隱私權政策 | An in-app sheet opens the policy — the page renders, not a 404 |
| ST.19 | Tap 服務條款 | Same, for the terms |
| ST.20 | Close the sheet | Back on 設定 where you were; the app was never left for Safari |
| ST.21 | The contact address on either page | hello.sprinkie.journal@gmail.com, and tapping it opens a mail draft |
| ST.22 | Both pages on a narrow phone | Text wraps, nothing scrolls sideways, the 關於 links at the foot work |

### VI — Visibility, across surfaces

| # | Case | Expected |
| --- | --- | --- |
| VI.1 | Hide a Category, check the month grid | **Its dots are gone** **[API]** |
| VI.2 | Check the day panel beneath | Its Entries are gone |
| VI.3 | Open a day holding one | The card is absent; others remain |
| VI.4 | Open the year view | **Days it colored lose their box, and the count drops** **[API]** |
| VI.5 | A day whose Entries are all hidden | An empty cell, never an error |
| VI.6 | A day with a hidden first Entry | The year box takes the topmost **visible** Entry's color **[API]** |
| VI.7 | Hide a Subcategory, leave the parent visible | Only refined Entries go |
| VI.8 | Hide a parent, leave one child visible | That child's Entries stay |
| VI.9 | Change visibility on the year view, return to the month | Both agree **[API]** |
| VI.10 | Force-quit with something hidden, relaunch | The hidden-set survived |
| VI.11 | Create a Category while something is hidden | Born visible |
| VI.12 | Delete a hidden Category | Nothing breaks; the stale id is harmless |
| VI.13 | Hide a Category from the day view's 類別 sheet | Its cards leave the day at once, without closing the day |
| VI.14 | Return to the month, then the year view | Both agree with the hide made on the day view, no relaunch **[API]** |

**VI.1 and VI.4 are round-2 reports #6 and #9.** They pass only when the
deployed revision carries the hidden-set.

### KB — Keyboard, across surfaces

One library, one provider at the root (#42, ADR-0006), so these behave the same
way everywhere rather than per screen.

**This section needs a native rebuild.** `react-native-keyboard-controller` is
a native dependency, so a binary built before it landed will show every case
failing for a reason that has nothing to do with the code. Confirm the build
carries it before reading anything into a failure here. (Expo Go was never an
option for this app; reanimated 4 ruled it out long before this.)

No automated test can see any of this. The jest suite loads the library's mock,
which renders the aware scroll view as a plain scroll view, so the whole
section is only ever verified here.

| # | Case | Expected |
| --- | --- | --- |
| KB.1 | Entry form, tap the Category search | The field rises clear of the keyboard, with the list still readable beneath it |
| KB.2 | Entry form on a chosen Category, tap 子類別 | The pill's field rises clear |
| KB.3 | Entry form, tap 標題 | Rises clear |
| KB.4 | Entry form, tap the note and type past one line | Stays clear as it grows, rather than sliding back under |
| KB.5 | Category editor, tap 名稱 | The sheet makes room; the field and its preview icon stay visible |
| KB.6 | Color drawer, tap the hex readout | The drawer rises, and the saturation area stays visible while you type |
| KB.7 | Email sign-in, tap 電子郵件 | Rises clear |
| KB.8 | Email sign-in, tap 密碼 | Rises clear |
| KB.9 | With the keyboard up, tap a button below the field | Acts on the first tap; it does not spend the tap dismissing the keyboard |
| KB.10 | Type Chinese into every single-line field | No glyph clipped top or bottom, and the placeholder sits centered |
| KB.11 | Dismiss by tapping empty ground, then refocus | Drops and rises again cleanly, no stuck padding |
| KB.12 | The smallest device you have, color drawer, hex field | The drawer's 取消 and 完成 stay reachable |
| KB.13 | 類別 sheet, tap the search field | The sheet makes room; the filtered tree stays readable beneath it |

KB.12 is the one to watch. The drawer is the tallest sheet and its body does
not scroll, so a short screen is where rising runs out of room.

### DR — Drafts

| # | Case | Expected |
| --- | --- | --- |
| DR.1 | Airplane mode, save a new Entry | Fails; the form keeps its words |
| DR.2 | Leave the form | A 尚未儲存 row on that day |
| DR.3 | Relaunch | The row survived |
| DR.4 | With staged Photos | They come back with the Draft |
| DR.5 | With a pending Subcategory name | It returns as a pending pill |
| DR.6 | Reconnect and retry | Saves; the row goes **[API]** |
| DR.7 | Edit a Draft before retrying | The newer values are what land **[API]** |
| DR.8 | A save where the Entry lands but Photos fail | 照片上傳失敗; retrying updates that Entry rather than making a second **[API]** |
| DR.9 | A Draft on a day you are not viewing | Appears only on its own day |

Lost-response replays (a create whose reply never arrived) are covered by the
Go and jest suites; they cannot be staged by hand.

### LG — App Language

| # | Case | Expected |
| --- | --- | --- |
| LG.1 | Phone in any Chinese locale, fresh install | The app renders Traditional Chinese |
| LG.2 | Phone in any other locale, fresh install | The app renders English |
| LG.3 | Sign up on a Chinese phone | Starter Categories seeded in Chinese **[API]** |
| LG.4 | Sign up on an English phone | Starter Categories seeded in English **[API]** |
| LG.5 | Change the phone's language later | Starter Categories never retranslate **[API]** |
| LG.6 | Every screen in English | Nothing clipped, nothing overlapping **[#37]** |

### AX — Accessibility

| # | Case | Expected |
| --- | --- | --- |
| AX.1 | VoiceOver on the month grid | Days are reachable and announced |
| AX.2 | VoiceOver on the 類別 sheet | Rows announce their visibility state |
| AX.3 | VoiceOver on the color drawer | The area and hue strip are adjustable |
| AX.4 | Larger text sizes | Nothing clipped past legibility |
| AX.5 | Every tap target | At least 44pt |
| AX.6 | VoiceOver: swipe up, then down, on the month title | It is announced as adjustable with the full month (2026年10月); up steps to the next month and down to the previous, each announced. ‹年, 類別 and 設定 stay separate stops |
