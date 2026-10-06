# Sprinkie

A personal life-journaling app: a few minutes a day of writing and photos, accumulating into weekly reflections and, eventually, a printed book of your year.

## Language

**User**:
A person with an account. Every User owns a Journal.
_Avoid_: member, account

**Journal**:
A container of Entries belonging to a User. In the MVP each User has exactly one Journal with a single writer; the concept allows multiple Journals per User and multiple writers per Journal (couple journal) in the future.
_Avoid_: diary, book

**Category**:
A user-defined top-level label for what an Entry is about (Sport, Work, Travel). Has a colored icon chosen by the User; Subcategories inherit it. The only labeling system — there is no separate tag layer.
_Avoid_: tag, label, habit

**Subcategory**:
A user-defined refinement of a Category (Sport → basketball, gym, swim).
_Avoid_: tag, sub-tag

**Hidden**:
A per-User visibility state on a Category or Subcategory: while hidden, its Entries are omitted from calendar views. Nothing is hidden by default; hiding is view state and never changes data.
_Avoid_: filter, filtered out

**Entry**:
A record inside a Journal for a specific date: title, optional note, optional photos. Carries exactly one Category, optionally refined by a Subcategory. A date can hold several Entries. Written by one User, its author, which is not necessarily the Journal's owner.
_Avoid_: journal (for a day's record), post, log

**Photo**:
An image attached to an Entry, at most three per Entry (2026-09-12), enforced by the server against what the Entry already holds — an Entry saved under the earlier cap of ten keeps every one of them and can only fail to gain more. Re-encoded on the device before it travels, so no location rides with it; its capture time does, as a recorded value rather than something read back out of the file.
_Avoid_: attachment, image (for the stored thing), media

**App Language**:
The language the interface renders in: Traditional Chinese or English. Follows the phone's language (any Chinese → Traditional Chinese, anything else → English) unless the User overrides it with an explicit per-device choice. Changing it never changes data: Categories and Entries keep their names.
_Avoid_: locale, system language (for the app's own setting)

**Wordmark**:
The app's name as a person reads it: **Sprinkie**, the same Latin string in every App Language. Ratified 2026-09-29: a brand name does not translate, and coining a Chinese one means defending it later. It is the one catalog entry a translation pass leaves alone, which makes it the standing exception to the zh-TW-first rule in DESIGN.md § Identity.
_Avoid_: app name, logo, daily-wlog (the pre-rename name; internal ids that keep it are listed in docs/release.md)

**Starter Category**:
One of the five Categories created for a new User at signup, named in the App Language in effect at that moment. An ordinary Category from then on: renameable, hideable, deletable, and never retranslated.
_Avoid_: default category, seed category

**Draft**:
A failed save kept on the device: the full Entry — words, staged photos' local copies, a still-uncreated Subcategory name — resurfacing on its day until a retry succeeds. Its id doubles as the create's idempotency key, so a lost-response retry lands on the original Entry. Per-device, never on the server.
_Avoid_: unsaved entry, pending entry

**Saved Color**:
A custom color a User has actually worn on a Category, remembered most-recent-first so it can be picked again. A memory of use, not a possession: forgetting one leaves every Category wearing that color untouched, and the ten presets are not Saved Colors.
_Avoid_: recent color, palette, swatch
