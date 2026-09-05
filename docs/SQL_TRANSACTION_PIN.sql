-- RockPay / BillFlow — Transaction PIN (run in Supabase SQL Editor if not already applied)
-- Safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.transaction_pins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  failed_attempts int NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_pins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transaction_pins FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.transaction_pins TO service_role;

CREATE OR REPLACE FUNCTION public._pin_is_locked(_locked_until timestamptz)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT _locked_until IS NOT NULL AND _locked_until > now();
$$;

CREATE OR REPLACE FUNCTION public.set_transaction_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'invalid_pin_format'; END IF;
  IF EXISTS (SELECT 1 FROM public.transaction_pins WHERE user_id = uid) THEN
    RAISE EXCEPTION 'pin_already_set';
  END IF;
  INSERT INTO public.transaction_pins (user_id, pin_hash)
  VALUES (uid, crypt(_pin, gen_salt('bf', 10)));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_transaction_pin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.transaction_pins WHERE user_id = uid);
END;
$$;

CREATE OR REPLACE FUNCTION public.change_transaction_pin(_current_pin text, _new_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  uid uuid := auth.uid();
  row public.transaction_pins%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _new_pin IS NULL OR _new_pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'invalid_pin_format'; END IF;
  IF _current_pin IS NULL OR _current_pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'invalid_pin'; END IF;
  SELECT * INTO row FROM public.transaction_pins WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pin_not_set'; END IF;
  IF public._pin_is_locked(row.locked_until) THEN RAISE EXCEPTION 'pin_locked'; END IF;
  IF crypt(_current_pin, row.pin_hash) <> row.pin_hash THEN
    UPDATE public.transaction_pins
    SET failed_attempts = row.failed_attempts + 1,
        locked_until = CASE WHEN row.failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE row.locked_until END
    WHERE user_id = uid;
    RAISE EXCEPTION 'invalid_pin';
  END IF;
  UPDATE public.transaction_pins
  SET pin_hash = crypt(_new_pin, gen_salt('bf', 10)),
      failed_attempts = 0,
      locked_until = NULL,
      updated_at = now()
  WHERE user_id = uid;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_transaction_pin(_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'invalid_pin'; END IF;
  INSERT INTO public.transaction_pins (user_id, pin_hash, failed_attempts, locked_until)
  VALUES (uid, crypt(_pin, gen_salt('bf', 10)), 0, NULL)
  ON CONFLICT (user_id) DO UPDATE
  SET pin_hash = EXCLUDED.pin_hash,
      failed_attempts = 0,
      locked_until = NULL,
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_transaction_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_transaction_pin(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_transaction_pin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_transaction_pin() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.change_transaction_pin(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_transaction_pin(text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.reset_transaction_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_transaction_pin(text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
