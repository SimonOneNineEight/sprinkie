# Thin custom API in front of Supabase

The mobile app never talks to Supabase directly: all traffic goes through a thin API (our code — language decided in ADR-0003), which uses Supabase for Postgres, auth verification, and photo storage. Supabase's client-direct model with row-level security was rejected because business rules (storage quotas, category auto-creation, reminder logic, AI jobs) need one home that isn't spread across RLS policies and client code; a fully custom backend was rejected because auth, session security, and file storage are dangerous to hand-roll and are not this product's differentiator. The layer also means any underlying piece (photo storage economics at scale, background AI/PDF workers) can be swapped later without touching shipped clients.

## Amendment (2026-08, issue #8): media bytes bypass the API

Photo *bytes* are the one exception to "all traffic goes through the API".
The client uploads and downloads them directly against storage using
short-lived presigned URLs that only the API can mint. The API remains the
sole control plane — presign, register, delete, reorder — so the business
rules stay in one home; routing multi-megabyte media through the API would
double bandwidth without adding a rule it needs to enforce. Swappability is
preserved: clients only ever see URLs the API handed them, never storage
credentials or bucket layout.

## Amendment (2026-11, issue #108): /health reads the CLI's migration history

`/health` reports its schema version from `supabase_migrations.schema_migrations`,
a table owned by the Supabase CLI, not by our migrations: the one deliberate
dependency on Supabase internals. It is the only record of which migrations
`supabase db push` actually applied, so it moves with every migration on its
own, where a version we kept ourselves sat at 1 and could not tell a skipped
push from a done one. Leaving Supabase means replacing this one query.

## Amendment (2026-11, phase 2): the Reminder is scheduled on the phone

"Reminder logic" leaves the list of business rules the API owns. The
Reminder is a daily local notification the phone schedules itself, its
time and on/off state kept on that device, so no push tokens, APNs keys
or scheduled job exist on the server. A fixed daily schedule has nothing
for a server to decide: the one rule it carries, no Reminder on a day
that already holds an Entry, the phone answers by asking the API for
today's Entries each time it re-syncs (launch, return to the foreground,
any change to today's Entries), falling back offline to the last answer
it got. The cost is that an Entry written on a second phone silences the
first one's Reminder only once that phone next re-syncs, not the moment
it is written; moving the Reminder behind the API later changes nothing
the User sees.
