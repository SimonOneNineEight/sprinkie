# The Filter applies per surface, sent to the API as its complement

Superseded by ADR-0010 (2026-11-14): the complement leaked Subcategories the app had not loaded, so the API now takes the Filter itself.

Supersedes ADR-0005, whose revisit trigger ("Hidden's meaning changes") fired with ADR-0008. Its conclusion stands: the Filter is applied per surface, matched to each surface's data source, with no visible-world module. The month view's dots and the year view are filtered server-side, the month's day panel and the day view client-side, and the day view still derives partialDay to disable drag-reorder on a partial list. ADR-0005's three reasons still hold.

What changed is the shape on the wire, and the surprising part is that it did not. The client turns the Filter into its complement, every current Category and Subcategory it does not choose, and sends that as the existing hidden-set params. The API, its SQL and the generated client stay as they were, so the change ships over the air with no server deploy and no window where an old app and a new API disagree. The alternative, an include-list param on the months and years endpoints, reads more naturally but buys nothing the complement does not, at the price of a coordinated server and app release.

The complement is computed against the current Category list, so it has to be recomputed whenever Categories change: a new Subcategory of a chosen Category joins the Filter, and anything else created while a Filter is on stays outside it.

Revisit when the API changes those endpoints for another reason (then an include-list is free), when a fourth surface consumes the Filter, or when the query/refresh redesign happens.
