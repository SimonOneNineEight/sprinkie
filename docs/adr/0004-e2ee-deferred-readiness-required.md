# E2EE deferred, E2EE-readiness mandatory

Sprinkie's category peers (Day One, Apple Journal) encrypt journals end-to-end, and we deliberately do not — yet. MVP threat reality is a TestFlight cohort where conventional security (TLS, encryption at rest, strict per-user authorization, the never-log-content rule) covers the actual risks, while E2EE's costs land on our weakest quarter: key-lifecycle code by a solo builder learning Go, a recovery-code UX surface, a redesigned AI reflection, and a key-sharing protocol the future couple journal would immediately demand. Early key-handling bugs eating a journal is a worse failure for this product than the operator being technically able to read ciphertext we never look at.

The deferral is only honest because readiness is enforced from the first migration, keeping later E2EE a contained client-side project (background re-encryption of blobs, Apple ADP-style opt-in) instead of a rewrite:

1. Entry content (title, note) is one opaque, versioned blob column; the server stores and returns it but never parses it. Structure (dates, category IDs, positions) stays server-readable — calendars and filters never need content.
2. No server-side feature may read content: no backend full-text search, no batch jobs over entries.
3. The Phase 2 weekly reflection is client-initiated by design (the phone assembles the week's text and calls the AI), so encryption's arrival doesn't break it.
4. Decision checkpoint: before public App Store launch, E2EE returns to the table with the PM, judged against the category bar.
