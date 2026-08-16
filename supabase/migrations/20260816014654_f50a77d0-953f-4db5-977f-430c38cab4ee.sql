CREATE OR REPLACE FUNCTION public.__apply_migration(sql text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $fn$ BEGIN EXECUTE sql; END; $fn$;
REVOKE ALL ON FUNCTION public.__apply_migration(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__apply_migration(text) TO sandbox_exec;