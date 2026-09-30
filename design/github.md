repo: SimonOneNineEight/sprinkie
branch: main

## Last sync

date: 2026-08-17T23:05:00Z

### Updated in this project

- Switched the system to Traditional Chinese (zh-TW) as primary language: PingFang TC in the type stack, CJK line heights, zero tracking, full-width punctuation rules, zh-TW component defaults and mock content.
- Built the token layer (neutral chrome, 10 bright category presets, SF Pro + PingFang TC scale) from `DESIGN.md`.
- Authored 17 components across core, categories, calendar and entries.
- Recreated the five MVP screens as the `ui_kits/ios-app` click-through kit, plus a printable review document.

## Screen map

| Project screen | Built from |
| --- | --- |
| `ui_kits/ios-app/MonthScreen.jsx` | `DESIGN.md` → Screens 1, Color, Typography |
| `ui_kits/ios-app/DayScreen.jsx` | `DESIGN.md` → Screens 2, Explicit bans 4, 11 |
| `ui_kits/ios-app/EntryFormScreen.jsx` | `DESIGN.md` → Screens 3; `CONTEXT.md` (Category, Subcategory, Entry) |
| `ui_kits/ios-app/YearScreen.jsx` | `DESIGN.md` → Screens 4, Color (year view rules) |
| `ui_kits/ios-app/CategoriesScreen.jsx` | `DESIGN.md` → Screens 5 |
| `tokens/*.css` | `DESIGN.md` → Typography, Color, Theming |
| `readme.md` (language, content fundamentals) | `CONTEXT.md`, `DESIGN.md` → Explicit bans, Feel; zh-TW brief from chat |
| `review/Design System Review.html` | All of the above, assembled for review |

Note: the repository contains documentation only — no app code, design file or image assets —
so nothing was copied from it verbatim. The `commit:` line is omitted deliberately: only the
tree hash was resolved during import, not a commit sha.
