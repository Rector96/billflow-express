-- Fail closed for unsupported generic bill services before PIN or wallet work.
CREATE OR REPLACE FUNCTION public.secure_bill_payment(
  _service text,
  _provider text,
  _product text,
  _amount numeric,
  _customer_identifier text,
  _status public.tx_status,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _pin text DEFAULT NULL
)
RETURNS TABLE (bill_id uuid, internal_reference text, balance_after numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  service_name text := lower(trim(coalesce(_service, '')));
  service_slug text := lower(trim(coalesce(_metadata->>'service_slug', '')));
  uid uuid := auth.uid();
  w public.wallets%ROWTYPE;
  pin_row public.transaction_pins%ROWTYPE;
  ref text;
  wallet_ref text;
  before_balance numeric;
  after_balance numeric;
  bill_id_value uuid;
  metadata_value jsonb := coalesce(_metadata, '{}'::jsonb);
BEGIN
  IF service_name IN ('education', 'internet', 'water', 'insurance', 'exam pins')
     OR service_slug IN ('education', 'internet', 'water', 'insurance', 'exam-pins') THEN
    RAISE EXCEPTION 'unsupported_service';
  END IF;
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'invalid_pin'; END IF;

  SELECT * INTO pin_row FROM public.transaction_pins WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pin_not_set'; END IF;
  IF public._pin_is_locked(pin_row.locked_until) THEN RAISE EXCEPTION 'pin_locked'; END IF;
  IF crypt(_pin, pin_row.pin_hash) <> pin_row.pin_hash THEN
    UPDATE public.transaction_pins
    SET failed_attempts = pin_row.failed_attempts + 1,
        locked_until = CASE WHEN pin_row.failed_attempts + 1 >= 5
          THEN now() + interval '15 minutes' ELSE pin_row.locked_until END
    WHERE user_id = uid;
    RAISE EXCEPTION 'invalid_pin';
  END IF;
  UPDATE public.transaction_pins SET failed_attempts = 0, locked_until = NULL WHERE user_id = uid;

  SELECT * INTO w FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet not found'; END IF;
  IF w.status <> 'active' THEN RAISE EXCEPTION 'wallet not active'; END IF;
  before_balance := w.balance;
  IF before_balance < round(_amount, 2) THEN RAISE EXCEPTION 'insufficient_funds'; END IF;
  after_balance := before_balance - round(_amount, 2);
  UPDATE public.wallets SET balance = after_balance WHERE id = w.id;
  ref := public.new_reference('BIL');

  INSERT INTO public.bill_transactions (
    user_id, wallet_id, service, provider, product, amount,
    customer_identifier, internal_reference, status, metadata
  ) VALUES (
    uid, w.id, _service, _provider, _product, round(_amount, 2),
    _customer_identifier, ref, 'successful', metadata_value
  ) RETURNING id INTO bill_id_value;

  wallet_ref := public.new_reference('WAL');
  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, balance_before, balance_after,
    reference, status, description, metadata
  ) VALUES (
    w.id, uid, 'bill_payment', round(_amount, 2), before_balance, after_balance,
    wallet_ref, 'successful', _provider || ' ' || _service,
    metadata_value || jsonb_build_object('bill_reference', ref, 'bill_id', bill_id_value)
  );

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    uid, _provider || ' payment successful',
    _service || ' payment of NGN ' || to_char(round(_amount, 2), 'FM999,999,990.00') || '.',
    'success'::public.notification_type, jsonb_build_object('reference', ref)
  );
  RETURN QUERY SELECT bill_id_value, ref, after_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.secure_bill_payment(text, text, text, numeric, text, public.tx_status, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secure_bill_payment(text, text, text, numeric, text, public.tx_status, jsonb, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';