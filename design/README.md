# Sprinkie Design System

> Local note (added on pull, 2026-08-18): this directory is the repo's copy of the
> "daily-wlog Design System" project on claude.ai/design (the design source of truth for
> implementation). Pulled: `tokens/`, `components/`, `styles.css`, the `ui_kits/ios-app`
> screens (as `screens/`), `readme.md` (this file), `github.md`. Deliberately not pulled:
> `_ds_bundle.js` (compiled), `guidelines/` preview cards, `review/`, the icon SVGs
> (standard Lucide glyphs — see `assets/icons.md` for the 79-glyph manifest), and the
> browser-demo harness (`Shell.jsx`, `index.html`, `App.jsx`).
>
> `canvas/` holds the **"Daily-wlog iOS prototype"** design canvas with all nine designed
> surfaces (see `canvas/README.md`) — the five screens here plus the category sheet, custom
> color drawer, sign-in, and the filter explorations.

A design system for **Sprinkie**, a mobile-first personal life journal (React Native, iOS
first). A person writes a few short entries a day — title, optional note, up to ten photos —
each carrying exactly one category. The month calendar is the product's face: as the habit
grows, the grid fills with colored dots. The five-minute session should feel like closing a
small ritual, not operating software.

Aesthetic family: **Apple Calendar's airiness × Apple Journal's warmth**. The chrome is quiet
and neutral; color belongs to the user's categories and nowhere else.

## Sources

Everything here derives from the brief and domain docs in the linked repository — read them
before extending this system, they are the ratified guardrails:

- **Repo:** <https://github.com/SimonOneNineEight/sprinkie>
  - `DESIGN.md` — the ratified design brief: identity, typography, color, theming, the five MVP
    screens, eleven explicit bans, and the intended feel. This system fills in exact values
    inside those rules and adds nothing that contradicts them.
  - `CONTEXT.md` — the domain glossary (User, Journal, Category, Subcategory, Entry) and the
    words to avoid (tag, label, habit, diary, post, log).
  - `docs/adr/` — React Native + Expo, thin API over Supabase.
  - `docs/research/` — background research, not design input.

The repository contains **no application code, no design file and no image or logo assets** at
the time of writing (it is a docs-and-issues repo). So: no logo was created — the brand name is
set in plain type wherever a mark would go — and no product screenshots were used. Anyone
extending this system should re-read the repo; once app code lands, its real components should
override the recreations here.

- **Icon substitution:** the brief calls for an SF Symbols-style drawn family. SF Symbols is not
  redistributable, so [Lucide](https://lucide.dev) (MIT) stands in at stroke weight 1.75 — the
  closest match in stroke feel. Thirty glyphs are vendored in `assets/icons/`. **Flagged for
  the user:** swap these for the real SF Symbols set (or an exported subset) in production.
- **Font substitution:** none. `-apple-system` resolves to SF Pro for Latin and PingFang TC for
  Han on Apple platforms; Noto Sans TC and Microsoft JhengHei are named as fallbacks elsewhere.
  No webfont is shipped and no substitute display face was introduced, because the brief bans
  custom faces.

## Index

| Path | What it is |
| --- | --- |
| `styles.css` | The single entry point consumers link. `@import` list only. |
| `tokens/` | `colors.css`, `categories.css`, `typography.css`, `spacing.css`, `radius.css`, `elevation.css`, `motion.css` |
| `components/core/` | Button, IconButton, AddButton, TextField, ListRow, NavBar, Icon |
| `components/categories/` | CategoryDot, CategoryDots, CategoryIcon, CategoryPicker, ColorPresetPicker |
| `components/calendar/` | MonthGrid, DayCell, DayPanel, MiniMonth |
| `components/entries/` | EntryCard, PhotoGrid |
| `ui_kits/ios-app/` | Click-through recreation of the five MVP screens |
| `guidelines/` | Foundation specimen cards (Colors, Type, Spacing, Brand) |
| `assets/icons/` | 30 vendored Lucide SVGs |
| `SKILL.md` | Agent-skill entry point |
| `github.md` | Source-repo association and sync record |

## Components

Every component is `<Name>.jsx` + `<Name>.d.ts` + `<Name>.prompt.md`, styled only through the
CSS custom properties. The inventory follows the five MVP screens — nothing speculative.

- **Core:** `Button`, `IconButton`, `AddButton`, `TextField`, `ListRow`, `NavBar`
- **Categories:** `CategoryDot`, `CategoryDots`, `CategoryIcon`, `CategoryPicker`, `ColorPresetPicker`
- **Calendar:** `MonthGrid`, `DayCell`, `DayPanel`, `MiniMonth`
- **Entries:** `EntryCard`, `PhotoGrid`

### Intentional additions

- `Icon` — a thin wrapper over the vendored glyph set, so no component hand-rolls an SVG.
- `AddButton` — the brief specifies a persistent "+" with weight from shape, fill and depth;
  it is distinct enough from `Button` to be its own primitive.
- `CategoryDots` — enforces the "up to four dots, then +n" rule in one place.

## Language

**Traditional Chinese (zh-TW) is the primary language; English is secondary.** Every piece of
interface copy ships in zh-TW, and mocks are built with real Chinese content — never English
placeholder text. English appears only in this documentation, in component and token names, and
inside a user's own entry text (people write 「跟 Amy 喝咖啡」 naturally).

- **Type stack:** `-apple-system` resolves to SF Pro for Latin and **PingFang TC** for Han on
  Apple platforms — the pairing iOS uses itself. `"PingFang TC", "Noto Sans TC",
  "Microsoft JhengHei"` are named for other platforms. No webfont ships.
- **Line height is looser than the Latin-only scale** to give Han characters room: body 17/24,
  notes and section headers 15/22, metadata 13/19, titles 28/36.
- **Letter-spacing is 0.** The iOS optical values are negative (`-0.41px` at body size) and
  crowd Han glyphs. `--track-latin-body` / `--track-latin-title` keep the old values for
  Latin-only surfaces.
- **Punctuation is full-width:** 「」for quoting a name the user typed, 、between list items,
  。at the end of a sentence, （）for parentheses. Never mix in ASCII `" , .` inside Chinese copy.
- **Numbers and Latin words stay half-width**, with no space added around them (`3 / 10`,
  `8月11日`, `跟 Amy 喝咖啡` keeps its natural spaces).
- **Dates:** `8月11日 星期二` in panel headers, `8月11日` in compact bars, `8月` as the nav
  title with `2026年` beneath. Weekday header is the single characters 日一二三四五六.
- **Vocabulary (the glossary, in zh-TW):** 使用者 · 日誌 · 類別 · 子類別 · 紀錄. Avoid 標籤,
  日記, 習慣, 貼文.

## Content fundamentals

Copy is short, plain and unceremonious. It labels things and then stops.

- **Voice:** the app narrates nothing. Labels are nouns (類別, 子類別, 備註（選填）), actions are
  verbs (儲存, 取消, 新增紀錄, 建立類別, 刪除類別). No taglines, no explanation of what a button does.
- **Person:** the app neither speaks as 我 nor addresses the reader as 你. Possessives are
  dropped — 類別, not 你的類別.
- **No 喔/囉/呦 and no exclamation marks.** The tone is calm and factual, closer to iOS system
  copy than to a consumer app's chirp.
- **Empty states:** a flat grey statement, 這天沒有紀錄. No illustration, no invitation.
- **No cheerleading.** Banned outright: 太棒了, 繼續保持, streak counts, badges, confetti. The
  month filling with color is the entire reward system.
- **No emoji**, anywhere — not in copy, never as a category icon.
- **No decorative microcopy** that repeats an icon: a trash glyph does not need 永久刪除這個類別.
- **Constraints are stated plainly** where they matter: `3 / 10` under the photo add tile;
  已有紀錄使用這個類別。重新命名會一併帶著走，因此不提供刪除。
- **English equivalents**, where a second language is needed: Save · Cancel · New entry ·
  Category · Subcategory · Note (optional) · Create category · Delete category · No entries.

Seeded categories: 工作 · 運動 · 美食 · 旅遊 · 個人, each on its own preset color.

Sample entry titles, for tone when mocking: 跟 Amy 喝咖啡 · 上健身房 · 陽明山步道 · 一蘭拉麵 ·
番茄終於紅了 · 打電話給爸爸. Short, factual, no punchlines.

## Visual foundations

**Color.** Chrome is white, grey, black — full stop. There is no brand accent token and none
should be added. `--background` is `#F4F4F5`, panels and cards are pure white, text runs from
`#1C1C1E` primary to `#8E8E93` tertiary, hairlines are `#E4E4E7`. The only saturated color on
screen comes from the ten preset category colors: clean, bright mid-tones (`clay`, `orange`,
`ochre`, `green`, `eucalyptus`, `blue`, `indigo`, `violet`, `pink`, `brown`), lightness staggered
across the set so all ten stay separable as 7px dots on white. Bright, not neon — the chrome
stays neutral, so these carry all the color on screen. Each has a `-tint` (13% wash, for chips
and soft states) and an `-ink` (darkened, for text on that tint). Users can also pick a custom
color; components accept any CSS color in place of a preset name.

**Type.** SF Pro + PingFang TC at one scale, few sizes: 34/28 titles, 17 body and entry titles,
15 notes and section headers, 13 metadata, 12 weekday header, 15 day numerals, 8 year-view
numerals. Line heights are the CJK-loosened set (17/24, 15/22, 13/19) and tracking is 0 — see
**Language** above. Regular weight carries content; semibold marks state (today, selected day,
section headers) and is never the only signal. No serifs, no display faces, no second family.

**Spacing and layout.** 2/4/6/8/12/16/20/24/32/40. Screen gutter 16, card padding 14, row height
44, grid cell 52 tall, panel gap 12, FAB 56 inset 24. Hit targets never below 44. Layout is
fixed and shallow: a translucent nav bar pinned at top, the grid, one panel or one card level,
and the floating "+" bottom-right. Nesting stops there — no card inside a card, no panel inside
a panel.

**Backgrounds.** Flat color only. No imagery, no illustration, no pattern, no texture, and **no
gradients on chrome** — the one place a soft edge appears is the nav bar's translucent material
(`rgba(255,255,255,0.82)` + `saturate(180%) blur(20px)`), used so content scrolls under it.
Photos are the only imagery, and they are the user's own; in mocks they appear as neutral grey
tiles with a small image glyph.

**Depth.** Shadows are near-invisible and layered rather than dramatic: `--shadow-card`
`0 1px 2px rgba(0,0,0,.05)`; `--shadow-panel` adds a 16px ambient at 4%; `--shadow-fab`
`0 2px 5px/.12` + `0 8px 20px/.10`; `--shadow-dragging` lifts a card being reordered. No inner
shadows except the 1px inset hairlines used for separators and the focus ring.

**Radii.** 4, 6, 8, 10, 12 (card), 14 (panel), 20 (sheet), pill for dots, swatches and the "+".
Photo tiles 8. Year-view day boxes 3. Cards are white, radius 12, no border, one hairline shadow.

**States.** Press is opacity `0.72` for text and rows, `scale(0.97)` for the "+"; nothing changes
hue on press. Hover is not a design target (touch first); on pointer devices reuse the press
opacity. Selection is a ring in near-black, never a fill in color. Focus is a 1px near-black
inset ring on fields. Disabled is grey-on-grey (`--control-disabled-*`). Destructive is the one
tinted text color, `#A33A2E`, and appears only where deletion is legitimately available.

**Motion.** 90ms press, 150ms selection/focus, 240ms content swap, 300ms month swipe and screen
push, 320ms sheets. Easing `cubic-bezier(0.4,0,0.2,1)` standard, `cubic-bezier(0.16,1,0.3,1)`
for entrances. Fades and slides only — no bounce, no spring overshoot, no blinking or pulsing
dots, no confetti or celebration animation of any kind.

**Transparency and blur** appear exactly once: the nav bar material. Everything else is opaque.
Scrims behind sheets are `rgba(0,0,0,0.28)` flat — no protection gradients.

**Theming.** Light mode only; the app declares itself light-only to iOS. `tokens/categories.css`
carries a rough `[data-theme="dark-reference"]` column of dark-tuned category siblings as a
reference for the later dark pass — unpolished and unused by any component.

## Iconography

- **Set:** Lucide SVGs, vendored in `assets/icons/` (30 glyphs), rendered through the `Icon`
  component at stroke weight 1.75 and sizes 13–26. They stand in for SF Symbols, which the brief
  names and which cannot be redistributed — **substitution flagged**, swap in production.
- **No icon font, no sprite sheet**: one flat SVG per glyph, fetched and inlined so it inherits
  `currentColor`.
- **One weight, one style.** Outline only; never mix filled and outline glyphs in a row. Category
  glyphs are drawn (`dumbbell`, `briefcase`, `plane`, `utensils`, `book-open`, `users`, `music`,
  `sprout`, `map-pin`, `heart`, `tag` as the default).
- **Emoji are banned as category icons** and everywhere else. Unicode characters (`✓`, `→`, `•`)
  are not used as icons either — the drawn glyph or nothing.
- **Color:** icons are `--icon-default` (`#4A4A4F`) or `--icon-muted` in chrome. A category glyph
  is white on a solid square in its category color — the same value as that day's dot. The softer
  glyph-on-tint treatment is available via `filled={false}` for dense lists.
- **Never** invent a glyph or draw one inline; add a file to `assets/icons/` instead.

## Working rules

1. Hardcoded hex values are banned in implementation. Every color is a semantic token.
2. Chrome takes no hue. If a design needs emphasis, use weight, fill, size or depth.
3. Four dots maximum per day, then `+n`. One color per day in the year view, never stripes.
4. Grid → one panel → one card. Stop nesting.
5. Nothing celebrates, nothing pulses, nothing carousels.
