-- name: GetSchemaVersion :one
-- The newest migration applied, by its version prefix: what the Supabase CLI
-- recorded, so it moves with every migration without anyone bumping it.
select coalesce(max(version), '0')::bigint as schema_version from supabase_migrations.schema_migrations;
