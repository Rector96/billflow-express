-- Security hardening:
-- 1) Revoke demo funding/payment RPCs from authenticated users
-- 2) Transaction PIN table + set/verify/change with bcrypt + rate limit/lockout
-- 3) secure_bill_payment requires a valid PIN server-side

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ========== REVOKE DEMO MONEY MOVEMENT ==========
REVOKE ALL ON FUNCTION public.demo_fund_wallet(numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demo_bill_payment(text, text, text, numeric, text, public.tx_status, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_fund_wallet(numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.demo_bill_payment(text, text, text, numeric, text, public.tx_status, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.demo_fund_wallet(_amount numeric, _description text DEFAULT 'Demo wallet funding')
RETURNS TABLE (reference text, balance_after numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'demo_funding_disabled';
END;
$$;

CREATE OR REPLACE FUNCTION public.demo_bill_payment(
  _service text, _provider text, _product text, _amount numeric,
  _customer_identifier text, _status public.tx_status, _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (bill_id uuid, internal_reference text, balance_after numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'demo_payment_disabled';
END;
$$;

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

DROP TRIGGER IF EXISTS trg_transaction_pins_updated ON public.transaction_pins;
CREATE TRIGGER trg_transaction_pins_updated BEFORE UPDATE ON public.transaction_pins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public._pin_is_locked(_locked_until timestamptz)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT _locked_until IS NOT NULL AND _locked_until > now();
$$;

CREATE OR REPLACE FUNCTION public.set_transaction_pin(_pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'invalid_pin_format'; END IF;
  IF EXISTS (SELECT 1 FROM public.transaction_pins WHERE user_id = uid) THEN RAISE EXCEPTION 'pin_already_set'; END IF;
  INSERT INTO public.transaction_pins (user_id, pin_hash) VALUES (uid, crypt(_pin, gen_salt('bf', 10)));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.set_transaction_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_transaction_pin(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.change_transaction_pin(_current_pin text, _new_pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE uid uuid := auth.uid(); row public.transaction_pins%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _new_pin IS NULL OR _new_pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'invalid_pin_format'; END IF;
  IF _current_pin IS NULL OR _current_pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'invalid_pin'; END IF;
  SELECT * INTO row FROM public.transaction_pins WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pin_not_set'; END IF;
  IF public._pin_is_locked(row.locked_until) THEN RAISE EXCEPTION 'pin_locked'; END IF;
  IF crypt(_current_pin, row.pin_hash) <> row.pin_hash THEN
    UPDATE public.transaction_pins SET failed_attempts = row.failed_attempts + 1,
      locked_until = CASE WHEN row.failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE row.locked_until END
    WHERE user_id = uid;
    RAISE EXCEPTION 'invalid_pin';
  END IF;
  UPDATE public.transaction_pins SET pin_hash = crypt(_new_pin, gen_salt('bf', 10)), failed_attempts = 0, locked_until = NULL WHERE user_id = uid;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.change_transaction_pin(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_transaction_pin(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.verify_transaction_pin(_pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE uid uuid := auth.uid(); row public.transaction_pins%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'invalid_pin'; END IF;
  SELECT * INTO row FROM public.transaction_pins WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pin_not_set'; END IF;
  IF public._pin_is_locked(row.locked_until) THEN RAISE EXCEPTION 'pin_locked'; END IF;
  IF crypt(_pin, row.pin_hash) = row.pin_hash THEN
    UPDATE public.transaction_pins SET failed_attempts = 0, locked_until = NULL WHERE user_id = uid;
    RETURN true;
  END IF;
  UPDATE public.transaction_pins SET failed_attempts = row.failed_attempts + 1,
    locked_until = CASE WHEN row.failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE row.locked_until END
  WHERE user_id = uid;
  RAISE EXCEPTION 'invalid_pin';
END;
$$;
REVOKE ALL ON FUNCTION public.verify_transaction_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_transaction_pin(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_transaction_pin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.transaction_pins WHERE user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.has_transaction_pin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_transaction_pin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.secure_bill_payment(
  _service text, _provider text, _product text, _amount numeric,
  _customer_identifier text, _status public.tx_status,
  _metadata jsonb DEFAULT '{}'::jsonb, _pin text DEFAULT NULL
)
RETURNS TABLE (bill_id uuid, internal_reference text, balance_after numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  uid uuid := auth.uid(); w public.wallets%ROWTYPE; pin_row public.transaction_pins%ROWTYPE;
  ref text; wref text; before numeric; after numeric; bid uuid; meta jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF _status NOT IN ('successful', 'pending', 'failed') THEN RAISE EXCEPTION 'invalid status'; END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'invalid_pin'; END IF;
  SELECT * INTO pin_row FROM public.transaction_pins WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pin_not_set'; END IF;
  IF public._pin_is_locked(pin_row.locked_until) THEN RAISE EXCEPTION 'pin_locked'; END IF;
  IF crypt(_pin, pin_row.pin_hash) <> pin_row.pin_hash THEN
    UPDATE public.transaction_pins SET failed_attempts = pin_row.failed_attempts + 1,
      locked_until = CASE WHEN pin_row.failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE pin_row.locked_until END
    WHERE user_id = uid;
    RAISE EXCEPTION 'invalid_pin';
  END IF;
  UPDATE public.transaction_pins SET failed_attempts = 0, locked_until = NULL WHERE user_id = uid;
  SELECT * INTO w FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet not found'; END IF;
  IF w.status <> 'active' THEN RAISE EXCEPTION 'wallet not active'; END IF;
  before := w.balance; meta := COALESCE(_metadata, '{}'::jsonb); ref := public.new_reference('BIL');
  IF _status = 'failed' THEN after := before;
  ELSE
    IF before < round(_amount, 2) THEN RAISE EXCEPTION 'insufficient_funds'; END IF;
    after := before - round(_amount, 2);
    UPDATE public.wallets SET balance = after WHERE id = w.id;
  END IF;
  INSERT INTO public.bill_transactions
    (user_id, wallet_id, service, provider, product, amount, customer_identifier, internal_reference, status, metadata)
  VALUES (uid, w.id, _service, _provider, _product, round(_amount, 2), _customer_identifier, ref, _status, meta)
  RETURNING id INTO bid;
  wref := public.new_reference('WAL');
  INSERT INTO public.wallet_transactions
    (wallet_id, user_id, type, amount, balance_before, balance_after, reference, status, description, metadata)
  VALUES (w.id, uid, 'bill_payment', round(_amount, 2), before, after, wref, _status,
    _provider || ' ' || _service, meta || jsonb_build_object('bill_reference', ref, 'bill_id', bid));
  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (uid,
    CASE _status WHEN 'successful' THEN _provider || ' payment successful' WHEN 'pending' THEN _provider || ' payment pending' ELSE _provider || ' payment failed' END,
    _service || ' payment of NGN ' || to_char(round(_amount, 2), 'FM999,999,990.00') || '.',
    CASE _status WHEN 'successful' THEN 'success'::public.notification_type WHEN 'pending' THEN 'pending'::public.notification_type ELSE 'warning'::public.notification_type END,
    jsonb_build_object('reference', ref));
  RETURN QUERY SELECT bid, ref, after;
END;
$$;
REVOKE ALL ON FUNCTION public.secure_bill_payment(text, text, text, numeric, text, public.tx_status, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secure_bill_payment(text, text, text, numeric, text, public.tx_status, jsonb, text) TO authenticated, service_role;
