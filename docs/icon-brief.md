# Sprinkie icon brief (#58)

The written brief a studio produces before drawing anything. Agreed with the PM;
anything not listed here is the designer's call, which in practice means it gets
settled on a contact sheet rather than in prose.

Process and craft rules live in `docs/research/logo-and-app-icon-design-process.md`.
This file is only the decisions.

## What it is

A mark for Sprinkie, a personal life journal whose face is a month calendar
filling with colored dots. The mark has to carry the product for years, so it is
briefed against where the product is going, not only what it ships today.

## The promise it leads with

**This becomes a book you keep.** `GLOSSARY.md` ends at a printed book of your
year and `DESIGN.md` calls the printed book the product.

Known tension, accepted deliberately: the book does not exist yet, so the icon
promises something the first users cannot get. The alternative promises
considered and set aside were *this is the app you know* (the day cell), *see a
whole year* (the year view), and *the calm one* (ban 10, no streaks).

How literally the mark may say "book" is **not decided**. The divergence sheet
carries all three levels — no book shape, an abstracted edge or spine, a drawn
book — and the sheet decides.

## Where it has to work

All four, which together set the real constraints:

| Use | What it forces |
| --- | --- |
| iOS and Android app icon | Legible at 29pt; Apple's ceiling of four visual groups |
| **Printed book cover, one color** | Must read with no color at all, stamped or embossed, no fine detail |
| Sign-in wordmark lockup | Must balance beside the word "Sprinkie"; extreme proportions get hard |
| Favicon, 16–32px | One shape and nothing else |
| Stickers, LINE, merch | Tolerates detail, rewards personality |

The one-color requirement is the binding one. A mark that needs several colors
to read fails the cover, the favicon and the tinted iOS variant at once.

## What it must not resemble

Counted from the 25-icon Taiwan App Store audit (日記, 日誌, 行事曆, habit
tracker, life log):

- **A face.** Eight of twenty-five. Smileys, a bear, a cat, a drawn girl.
- **A book, page, bookmark or stacked cards.** Ten of twenty-five, three of them
  carrying a numeral.
- **Hand-drawn line art on cream.** Eight of twenty-five, the house style of the
  Taiwanese lifestyle shelf.
- **A pen or pencil.** Two, both paired with a smile.
- Specifically: Day One's bookmark, Daylio's green circle with a face, Apple
  Calendar's tear-off page with a date, Google Calendar's "31".

Unclaimed on that shelf, and therefore where this brief aims: **dots as the
subject** (one rival, grey on grey), **multicolor** (none), **precise geometry**
(none), and the **violet-to-magenta hue band** (empty apart from Apple Journal,
which is near-black).

## Materials it may use

- The ten category colors (`design/tokens/categories.css`), muted dusty
  mid-tones. Color is applied **last**; divergence is black only.
- The accent, once settled on the color board. The hue band is already narrowed
  to violet–indigo–magenta by two independent methods: ΔE distance from the
  category palette, and the empty band in the category audit.
- Circles and capsules at the product's own proportions: `MonthGrid.tsx` draws a
  26px holder over 7px dots touching at zero gap.

Not available: SF Symbols, which Apple's HIG prohibits in app icons; and the
vendored Lucide glyphs, which read as UI controls rather than as a brand.
Text in the icon is discouraged, and for a zh-TW/English app the binding reason
is localization.

## Tests it must pass

1. **One color.** Black on white, nothing lost. Paul Rand's single mandatory
   requirement, and the cover's requirement too.
2. **29pt**, the Settings size, and 16px for the favicon.
3. **Four groups or fewer**, Apple's stated complexity ceiling.
4. **On the shelf.** Dropped among the audited rivals at 60pt, it must not
   disappear into the neighborhood.
5. **Strangers.** Six to eight people who have never seen the app: what kind of
   app is this, and a day later, describe the icon.

## Who decides

Simon and the PM. Two people, not a committee. The shortlist picks **two** marks:
a primary and a runner-up, because the runner-up ships as an alternate icon in
the same build and can be swapped without a release.

## Status

- Phase 1, brief: this file.
- Phase 2, category audit: done, 25 icons from the tw storefront.
- Phase 3, divergence: done. 60 marks in one ink across seven families. Five
  survived, four of them the calendar family; every dot-only family was voted
  out, including both round-1 favourites. Designing in black is what exposed
  that: those marks had been leaning on the colored dots.
- Phase 4, reduction: done. Twelve container marks, five kept. The traits that
  carried: content fills the frame, more than one day inside, the frame at full
  weight, and book-ness read from a spine rather than a cover.
- Phase 4b, convergence: done, six crossings. Rendering them large exposed an
  accidental face — a ring and a dot, equal and level inside a tabbed frame,
  reads as eyes under antennae, which is the most crowded idea on the shelf.
  Fixed by staggering the pair and making the two elements unequal.
- Phase 5, testing: 16px and 29pt applied, shelf comparison built, stranger
  test scripted.

## The mark (2026-10-05)

**Seven written days in a month with room for nine.** A 3 × 3 grid of rounded
squares on warm paper; the centre and the bottom-right are left empty.

It won the stranger test **70 / 30** against the calendar-glyph direction, which
is why it ships rather than the marks this brief's earlier draft had shortlisted
(K1c, K3c, K4c — a tabbed calendar frame and its variants, all now retired).

| | |
| --- | --- |
| canvas | 100 × 100, ground `#F7F3ED` |
| grid | margin 16, gap 3.13, cell 20.58, footprint 68 × 68 |
| corner | 28% of the cell |
| empty | slots 5 and 9 |
| shadow | offset 0.9 down-right, blur 1.2, `rgb(90 74 63)` at 22% |

Slots, numbered 1–9 left to right and top to bottom:

```
1 #FAA4B5   2 #B3DFEB   3 #F5AA65
4 #DDE48E   5 —         6 #FFF3C4
7 #FDD0D0   8 #B3DFEB   9 —
```

`#B3DFEB` appears twice, so the mark holds six unique colours across seven
cells. Two days in the same category.

**What the testing taught us, against what the rules predicted:**

- **Two anchors and five whispers.** Slots 1 and 3 are main accents (chroma 34
  and 51); the rest are sub-accents (16–24). Every palette built to an even
  weight lost. The hierarchy is what people responded to.
- **The shadow carries the pale cells.** At 22% its darkest pixel reaches 1.40
  against the paper, which is more contrast than four of the seven cells manage
  on their own. Without it the mark loses cells at small sizes.
- **Known weakness:** `#FFF3C4` measures **1.01** against the ground, the same
  value as the paper, so slot 6 leans entirely on its shadow. `#F5E6A4` would
  lift it to 1.14 with the same hue, and is a one-line change if it ever bothers
  anyone.
- **In one ink it is seven grey squares.** That is the tinted iOS icon and a
  one-colour printed cover. It was the deliberate cost of choosing colour as the
  idea; re-read it before the external TestFlight group, not before the first
  build.

Margin settled at 16 on 2026-10-05, judged on the simulator's home screen rather
than on paper: 12 left the corner cells crowding the squircle. Holding the
cell:gap ratio costs 0.7px per cell at 29pt, which the shadow covers.

**Assets built** (vector first, everything else derived): `sprinkie-icon.svg`,
the 1024 opaque iOS master plus every required size, Android's three layers at
432 with the mark scaled to 72% for the 66dp safe zone, two favicons, and a
flat no-ground mark for the wordmark lockup.

Remaining: drop the assets into `apps/mobile/assets/`, point `app.json` at them
(its Android background is still the placeholder `#E6F4FE`, which should become
`#F7F3ED`), build so a device wears it, and write the icon section into
`DESIGN.md`.
