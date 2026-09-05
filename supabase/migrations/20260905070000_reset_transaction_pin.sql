-- Allow authenticated users to reset transaction PIN after password re-auth (app layer).

CREATE OR REPLACE FUNCTION public.reset_transaction_pin(_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  uid uuid := auth.uid();
  hashed text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  hashed := crypt(_pin, gen_salt('bf'));

  INSERT INTO public.transaction_pins (user_id, pin_hash, failed_attempts, locked_until)
  VALUES (uid, hashed, 0, NULL)
  ON CONFLICT (user_id) DO UPDATE
  SET
    pin_hash = EXCLUDED.pin_hash,
    failed_attempts = 0,
    locked_until = NULL,
    updated_at = now();
END;
$fn$;

REVOKE ALL ON FUNCTION public.reset_transaction_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_transaction_pin(text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
