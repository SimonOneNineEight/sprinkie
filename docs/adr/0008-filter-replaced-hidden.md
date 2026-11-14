# The Filter replaced Hidden

The 類別 sheet's visibility half used Apple Calendar's model (#30, the 2026-08-20 "full Apple" grilling): everything shows by default, and tapping a row hides it, durably, per device. The PM's phase 2 onboarding spec (#134) asks for the opposite lens: tap 運動 and the calendar shows only the days with 運動. Hidden was replaced, not supplemented, with a Filter (GLOSSARY.md): an empty Filter shows everything, chosen rows are the only ones shown. Two alternatives were rejected:

1. Keep Hidden and add "show only this" beside it (a long-press on a row, layered on the Hidden set). Every row then carries two independent states, and the sheet's one free gesture is a hidden one; the PM's spec describes one control, not two.
2. Express "show only Sport" as a Hidden set (hide everything else). It works on screen, but it overwrites whatever the User had hidden and gives no way back.

The cost is permanent hiding. A Filter lasts until the app is closed, so a User who wanted Work kept off their calendar for good has no way to say so any more. That is accepted on purpose: a lens for looking back (回顧) that survived a relaunch would open the app onto a sparse calendar with nothing on screen saying why, which is the worse failure. Existing Hidden sets were discarded rather than converted, because their complement would switch on a Filter the User never chose.

The sheet keeps the rest of the 08-20 structure: row tap selects, ✎ opens the editor, 新增類別 creates. A 全部 row, checked while the Filter is empty, replaces the 全部隱藏 / 全部顯示 header toggle, and the 類別 nav icon fills in ink while a Filter is on (the app has no accent color; ink is its action color, DESIGN.md).

Revisit if Users ask for permanent hiding back: it would return as its own durable setting, not as a persisted Filter.
