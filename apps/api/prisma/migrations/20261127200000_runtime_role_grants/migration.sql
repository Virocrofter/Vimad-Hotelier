-- [TEST-ROLE-GRANTS] 2026-11-27 — restore non-superuser role access after a schema rebuild.
-- prisma migrate reset drops and recreates the public schema; a freshly created
-- schema carries no default PUBLIC grants, silently stripping access for the
-- vimad runtime/test role (tests connect via .env.test, not the superuser).
-- Guarded: no-ops on environments without the vimad role (e.g. production VPS).
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'vimad') THEN
    EXECUTE 'GRANT USAGE, CREATE ON SCHEMA public TO vimad';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vimad';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vimad';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vimad';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO vimad';
  END IF;
END $$;
