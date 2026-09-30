# Sprinkie — iOS UI kit

Click-through recreation of the five MVP screens described in `DESIGN.md`
(`SimonOneNineEight/sprinkie`). Open `index.html`; the pill row under the phone
jumps between screens, and the screens navigate each other for real
(select a day → open the day → tap an entry → the form).

| File | Screen |
| --- | --- |
| `MonthScreen.jsx` | Month view (landing): grid, month arrows, selected-day panel, persistent + |
| `DayScreen.jsx` | Day view: entry cards, reorder controls standing in for drag |
| `EntryFormScreen.jsx` | Entry form: category first (with inline create + color pick), title, note, photos |
| `YearScreen.jsx` | Year view: twelve mini months, one color per day |
| `CategoriesScreen.jsx` | Category management: two-level list, color edit, rename, conditional delete |
| `Shell.jsx` | iPhone frame, status bar, scroll region, back action |
| `data.js` | Fake journal: 10 categories, one month of entries |

Everything visual comes from the design system bundle (`_ds_bundle.js`) and the
tokens in `styles.css` — no screen defines its own colors, radii or type.

Fidelity notes: photos render as neutral placeholder tiles (the source repo ships
no imagery); drag-to-reorder is represented by up/down controls; horizontal month
swipe is represented by the two chevrons in the nav bar.

> Local note (added on pull): `Shell.jsx` and `index.html` are browser-demo
> harness glue and were deliberately not pulled into this repo.
