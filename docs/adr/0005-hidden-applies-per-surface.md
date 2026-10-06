# Hidden applies per surface; no visible-world module

The Hidden set (GLOSSARY.md, #30) is applied three different ways on purpose, matched to each surface's data source: the month view filters server-side (dots are aggregated by the API) and client-side (its day panel already holds fetched Entries); the day view filters client-side only and derives partialDay to disable drag-reorder on a partial list; the year view filters server-side only. A 2026-09-11 architecture review proposed deepening this into one visible-world module that screens ask for "the visible Entries of a surface." Rejected, and this record exists so future reviews walk past it instead of re-proposing it:

1. A visible-world module that does not own data fetching is a pass-through — the per-surface implementations stay different underneath one cosmetic interface, failing the deletion test. One that does own fetching is the query-layer/refresh redesign by another name, which is deliberately parked with the navigation decision (HomeScreen's route switch comments it).
2. Hidden's semantics have been stable since #30 shipped, and nothing on the roadmap touches visibility. Deepening pays off on the next change to a module; there is none coming.
3. The one real leak the review found — HiddenParams declared independently in api/client.ts and calendar/hidden.ts — was fixed by importing one type (9988643), not by a module.

Revisit when any of these becomes true: a fourth surface consumes visibility, Hidden's meaning changes, or the query/refresh redesign happens (then visibility folds into it).
