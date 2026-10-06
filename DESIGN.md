# Sprinkie Design Brief

Ratified by Simon (designer/owner), 2026-08-17. This is the guardrail brief a design session must obey; the produced design system fills in exact values within these rules.

## Identity

A mobile-first personal life journal. Aesthetic family: **Apple Calendar's airiness × Apple Journal's warmth**. The UI chrome is quiet and neutral; color belongs to the user's categories and nowhere else. The calendar is the product's face: a month filling with colored dots should feel like a life filling up.

**Primary language: Traditional Chinese (zh-TW).** All UI copy, all design mocks, and all layout decisions are made on zh-TW text first. **English ships as the second App Language** (amended 2026-09-10, superseding "English arrives post-MVP"): the app follows the phone's language — any Chinese locale renders zh-TW, everything else English — with a per-device override in Settings (系統預設 / 繁體中文 / English). English gets no separate layouts: it rides the zh-TW-tuned screens with an explicit overflow policy (wrap where the layout allows, ellipsis where it doesn't), English typography tokens proven on the specimen screen, and a manual all-screens English pass before release. Starter categories are seeded in the signup-time App Language and never retranslate. The one exception to zh-TW-first is the Wordmark, which is the same Latin string in both languages (CONTEXT.md § Language).

## Typography

- iOS system font stack everywhere: **PingFang TC is the face users actually read** (zh-TW copy and entries), with SF Pro carrying Latin text and numerals. No custom or display faces in MVP.
- Line heights, cell paddings, and truncation rules are set against Chinese text: CJK runs denser and taller than Latin, so a layout that only works on English placeholder text is wrong.
- Recorded evolution: a warm reading face for entry content and the printed book, chosen later against real entries — not now against placeholder text.
- Day numbers and titles: regular weight; today and selected states get semibold, never color alone.
- One type scale, few sizes. Entry titles are short by design (they live in calendar cells and day lists).

## Color

- Primary colors of the app: warm paper `#FAF7F2`, warm greys, and ink `#514A45` (amended 2026-10-05, superseding white/grey/black). Chrome (backgrounds, bars, buttons, grid lines) is neutral only — **no brand accent color exists**. The "+" button and today's marker carry weight through shape, fill, and depth, never through hue.
- **The ink is also the action color.** Primary controls, the selection fill, today's ring and the focus ring are all `#514A45`; the brand's soft button `#D8D1C5` is the secondary half of a button pair, never the leading action — at 1.42 against the paper it cannot carry one. A hue accent was considered and declined: candidates derived from the icon's brand colors are recorded in `docs/icon-brief.md`, and the decision was that one quiet ink doing both jobs suits the product better than a second color competing with the category dots.
- The neutral ramp is the ink's own hue held across the lightness steps, so surfaces and lines sit with the text rather than against it. Values live in `design/tokens/colors.css`; nothing in implementation may hardcode a hex.
- Category colors are the only saturated colors on screen. **Preset palette of 10 muted, dusty mid-tones** that harmonize with the neutral chrome — no neon, no pastel — with lightness deliberately varied across the ten so all remain mutually distinguishable at dot size (6–8px) on white. Exact values are chosen in the design session on the real month-view mock, plus a custom color picker for users.
- Dots may run a point or two larger than saturated equivalents would, compensating for the muted palette.
- A day cell shows up to 4 dots in entry order; overflow is a plain "+" with no count (amended 2026-08-19 from "+n"), never a fifth dot.
- Year view: a day with entries gets a rounded box in the day's FIRST entry's category color, rendered as a solid fill with the day numeral punched out in white. One color per day, never stripes.

## The mark (ratified 2026-10-05, #58)

The app icon is **seven written days in a month with room for nine**: a 3 × 3
grid of rounded squares on warm paper, the centre and bottom-right left empty.
It is the year view abstracted, where a written day is already a rounded box in
its category's color.

Geometry on a 100 × 100 canvas: margin 16, gap 3.13, cell 20.58, corner radius
28% of the cell, footprint 68 × 68. The margin went 12 → 16 after seeing it on a
real home screen: at 12 the corner cells ran toward the squircle's curve and the
mark read as pressed against its container. Each block sits on a shadow offset 0.9
down-right, blurred 1.2, `rgb(90 74 63)` at 22%. Ground `#F7F3ED`.

```
1 #FAA4B5   2 #B3DFEB   3 #F5AA65
4 #DDE48E   5 —         6 #FFF3C4
7 #FDD0D0   8 #B3DFEB   9 —
```

`#B3DFEB` appears twice: six unique colors across seven cells, two days sharing
a category. The vector original is `design/brand/sprinkie-icon.svg`; every
shipped size derives from it.

Three rules this mark lives by, each learned by testing rather than asserted:

- **The hierarchy is the point.** Two main accents anchor five sub-accents.
  Evenly weighted palettes lost the stranger test 30/70; this one won.
- **The shadow carries the pale cells.** At 22% it reaches 1.40 against the
  paper, more than four of the seven cells manage alone. Removing it loses cells
  at small sizes.
- **It does not survive one ink.** In the tinted iOS variant and in one-color
  print it is seven grey squares. Accepted cost of choosing color as the idea.

Brand colors are not UI colors. These seven are for the icon, the sign-in
screen, the printed book and marketing. Category dots inside the app keep their
own palette, which is tuned for legibility at 6–8px and documented above.

## Theming

- **MVP ships light mode only**, declared to iOS as light-only so the system never half-inverts screens.
- Token discipline is mandatory from the first component: every color is a semantic token (background, surface, textPrimary, …); hardcoded hex values are banned in implementation.
- Dark mode is a planned later pass: a second token value column plus ten dark-tuned siblings of the preset palette. The design session designs light screens only; at most a rough dark token column as reference, zero polish.

## Screens (MVP)

1. **Month view** (landing): Apple Calendar-style grid, horizontal swipe between months (swipe-only; the nav bar holds the ‹ 年 label, 類別 and 設定 — no month chevrons), colored dots per day (dots touch — 0px gap), selected-day panel beneath the grid listing that day's entry titles with category icons. **The filled ink circle is the selection** and moves with taps (defaulting to today on open); today, when not selected, wears the thin ring. The "+" creates into the **selected day**, not blindly into today (ratified 2026-09-10, PM feedback round 1); it stays the **floating** ink circle bottom-right, 44pt, the same height as 今天 so the pair lines up (2026-08-19 for the circle; 44 supersedes its original 56, and a brief 2026-09-12 detour into a bottom bar was reverted — depth here is shadow and layering, per ban 7). 今天 returns this surface to now — today's month, with today selected — always present rather than appearing only when you are away from now, and it floats bottom-left as a capsule carrying the word, never a calendar glyph, which in an app made of calendars names the wrong thing. Both controls fade while you scroll and return when you stop, so content passes under them cleanly; scrolling surfaces pad their content to clear them. The nav bar keeps only tools: 類別 and 設定. The ‹ 年 label zooms out to the year containing the month you are viewing, not the current year. (Ratified 2026-09-12, PM feedback round 2.)
2. **Day view**: the date's entries as cards (title, category icon, note preview, photo thumbnails), drag to reorder. Horizontal swipe moves to the previous/next date. 今天 and the + float over the list. (Ratified 2026-09-10; 今天 2026-09-12, PM round 2.)
3. **Entry form**: category picker first (inline "Create …" when typing a new name, plus a pinned 新增類別 row so creation is discoverable before typing), short title field, optional note, photo grid up to 3 with drag order (3 supersedes the original 10, ratified 2026-09-12, PM round 2: a day's record is a glance, not an album). The cap is the server's to enforce, and it compares what an Entry already holds against what it is gaining, so an Entry saved under the old cap keeps every photo and can only fail to add more. Saving runs under a spinner on 儲存 with the form inert beneath it, and the photos upload together rather than one after another; the print-safe image size is untouched, because the printed book is the product. A **date row** defaults to the day the form was opened for and is editable; editing an existing entry may move it to another date, where it appends last. A typed-but-unconfirmed subcategory is created **at save time** together with the entry — it renders as pending in the category line before save, 建立 remains for explicit confirmation, and the return key never creates. Fast path: category + title + save in under a minute. (Date row, save-time creation, pinned row ratified 2026-09-10.)
4. **Year view**: one **continuous vertical ribbon of mini months**, two up, running unbroken through the years — December flows straight into January — opening on today's month with the months before it already on screen rather than flush to the top. Tapping a month enters it. A year is no longer something you see whole, and that is the trade: the twelve-mini-months screen stopped being one screen the moment #50's floating controls needed clearance and the grid became a scroller, so this makes scrolling the point rather than a consolation (ratified 2026-09-12, built 2026-10-06, #51). ±150 years, virtualised as one fixed-length list with exact row heights, so 今天, the wheel and ‹年 all land precisely rather than approximately. The header carries the **topmost visible month's year and that year's count**, both updating as you scroll: with no pages, the header is the only thing that says where you are. January rows carry a quiet **year caption**, added after seeing the ribbon on a device — running through the boundary by design left December and January indistinguishable. 今天 **scrolls back to today's month** and stays on the surface (ratified 2026-09-12, PM round 2: 今天 means "now, on the surface you are on", and navigation depth never changes); ‹年 from the month view scrolls to the exact month that view was showing. There is **no +** — the year view has no selected day, so a + could only mean today, and it is the one calendar surface that is not about writing. Tapping the year title opens the **endless year wheel** (future years allowed — backfilling old memories is the product), which scrolls the ribbon rather than turning a page, and matters more now that paging is gone. No back button, no chevrons, and no year flings: the surface scrolls vertically. (Ratified 2026-09-10; superseded in part 2026-09-12 and 2026-10-06.)
5. **Category management**: two-level list (categories with their subcategories), colored icon editing (preset + custom), rename; delete only offered when unused (in-use categories rename instead — entries follow).
6. **Category create/edit sheet**: one sheet serving both create and edit — name, optional parent category (making it a subcategory), icon picker, color (10 presets + custom picker). Reached from category management **and from the entry form**: the picker's pinned 新增類別 row and the inline 建立「…」 row open this same sheet, prefilled with any typed name; on save the created category (or its parent, refined by the new subcategory) is selected into the entry. (Ratified 2026-09-10, PM round-1 follow-up — overturns 2026-08-18's lightweight in-form quick step: reuse the complete editor over a second creation surface missing icon choice.)
7. **Sign-in**: wordmark, one line of promise, Sign in with Apple + Google buttons per their official styling rules (never restyled), on calm neutral ground. The only brand-moment screen; restraint is the design.
8. **Custom color drawer**: opened from the category sheet's 自訂顏色 option (Apple Journal-like). Hue and lightness/saturation controls — **fully free**: brighter and darker than the presets is allowed by design; the live preview (the chosen color as an actual dot on a mini month grid beside the user's existing categories) is the guardrail, not a clamp. The 10 presets appear as a reference row, plus a **saved custom colors** row: colors the user has used, most-recent first (capped, oldest drops). A saved color can also be forgotten deliberately — long-press, confirm — which frees its slot and leaves every Category wearing that color untouched; a Saved Color is a memory of use, not a possession. (Amended 2026-09-12, PM feedback round 2, #47.) Tint/ink companions for custom colors are derived programmatically. (Ratified 2026-08-18.)
9. **類別 sheet (visibility checklist)**: the 類別 icon (the month and year nav bars, and the day view's header) opens the one sheet fusing visibility with management — the two-level category tree, ✎ per row, always-expanded subcategories, 新增類別. Semantics are Apple Calendar's, not a filter's: every category starts **visible**, tapping a row toggles it, and state is stored as a hidden-set so new categories are born visible. Category rows toggle by icon-circle fill (white icon on category color = visible, hollow ring = hidden); subcategory rows, having no icon of their own, use Apple-style check-circles in the parent's color — the glyph itself tells the level. A parent's circle is the family master switch: lit if any member is visible; tapping it shows or hides the whole family. The header carries one toggle, 全部隱藏 / 全部顯示 (replacing 全部清除). Filter chips are retired — the sheet is the visibility record — and the hidden-set persists across launches. A day whose entries are all hidden renders as an empty cell, never an error; a hidden day's year-view color comes from its topmost visible Entry. The sheet can be searched, over both levels: a matching Subcategory keeps its parent row as context while non-matching siblings drop, and a matching Category keeps its whole family, since the family is the unit its master switch acts on. Visibility semantics do not change under a filter — a parent's circle still governs every member, including those the search is hiding, and 全部隱藏 / 全部顯示 stays global. An edit-mode toggle stays in reserve if the fused surface still confuses testers. (Ratified 2026-09-10, PM feedback round 1; search added 2026-09-13, #48; the day view's header gained the icon 2026-09-12, PM feedback round 2 — the one screen that reads a day in full was the one place you could not change what it shows, and it opens this same sheet, never a thinner read-only twin.)

Settings and other long-tail screens (dialogs, errors, empty states, account deletion) are derived from the system during implementation, not designed in the session; any derived moment that feels wrong gets taken back into a design session individually.

## Explicit bans

1. No blinking or pulsing status dots.
2. No three-column feature grids or marketing-style layouts.
3. No decorative microcopy or labels that repeat what an icon already says.
4. No deep container nesting: the grid, one panel, one card level; stop.
5. No serif fonts, no teal-by-default accents.
6. No empty-state illustrations that outweigh the content they replace.
7. No gradients on chrome — depth comes from shadow and layering only.
8. No emoji as category icons; the icon set is a drawn, consistent-weight family (SF Symbols style).
9. No onboarding carousel: sign in, land on today's month; the seeded categories and the "+" teach everything.
10. No gamification visuals and no cheerleading microcopy: no streak flames, badges, confetti, or "Great job!" — the month filling with color is the reward system.
11. No horizontal carousels for photos in the day view; photos lay out as grids or stacks.

## Feel

Calm, precise, a little joyful when color appears. The user's five minutes should feel like closing a small ritual, not operating software.
