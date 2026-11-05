-- For sqlc only, never applied: the Supabase CLI creates this table itself
-- and records each file of supabase/migrations/ in it as it applies it
-- (`supabase db push`, `supabase start`). Only the column the health query
-- reads is declared.
create schema supabase_migrations;

create table supabase_migrations.schema_migrations (
    version text primary key
);
