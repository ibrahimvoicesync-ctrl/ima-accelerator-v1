-- Temporary migration to reload PostgREST schema cache after deals table creation
-- PostgREST caches table metadata and needs explicit NOTIFY after DDL changes
NOTIFY pgrst, 'reload schema';
