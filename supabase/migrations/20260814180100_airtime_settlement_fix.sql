-- Fix start_airtime_purchase: existing bill_transactions.provider stores network (mtn/glo/...).
-- Channel 'vtpass' lives in metadata only.

CREATE OR REPLACE FUNCTION public.start_airtime_purchase(
  _provider text,
  _phone text,
  _amount numeric,
  _pin text,
  _request_id text DEFAULT NULL
)
RETURNS TABLE (
  bill_id uuid,
  internal_reference text,
  request_id text,
  balance_after numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  uid uuid := auth.uid();
  w public.wallets%ROWTYPE;
  pin_row public.transaction_pins%ROWTYPE;
  ref text;
  rid text;
  before numeric;
  after numeric;
  bid uuid;
  phone text;
  prov text;
  existing uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 50 OR _amount > 50000 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'invalid_pin'; END IF;

  phone := regexp_replace(coalesce(_phone, ''), '[^0-9]', '', 'g');
  IF phone ~ '^234' AND length(phone) = 13 THEN
    phone := '0' || substr(phone, 4);
  END IF;
  IF phone !~ '^0[789][01][0-9]{8}$' THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  prov := lower(trim(coalesce(_provider, '')));
  IF prov NOT IN ('mtn', 'glo', 'airtel', 'etisalat', '9mobile') THEN
    RAISE EXCEPTION 'unsupported_network';
  END IF;
  IF prov = '9mobile' THEN prov := 'etisalat'; END IF;

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

  rid := nullif(trim(coalesce(_request_id, '')), '');
  IF rid IS NOT NULL THEN
    SELECT id INTO existing FROM public.bill_transactions
    WHERE user_id = uid AND provider_request_id = rid LIMIT 1;
    IF existing IS NOT NULL THEN
      RETURN QUERY
        SELECT b.id, b.internal_reference, b.provider_request_id, w2.balance
        FROM public.bill_transactions b
        JOIN public.wallets w2 ON w2.user_id = uid
        WHERE b.id = existing;
      RETURN;
    END IF;
  ELSE
    rid := public.vtpass_request_id();
  END IF;

  SELECT * INTO w FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet not found'; END IF;
  IF w.status <> 'active' THEN RAISE EXCEPTION 'wallet not active'; END IF;

  before := w.balance;
  IF before < round(_amount, 2) THEN RAISE EXCEPTION 'insufficient_funds'; END IF;
  after := before - round(_amount, 2);
  UPDATE public.wallets SET balance = after WHERE id = w.id;

  ref := public.new_reference('BIL');

  INSERT INTO public.bill_transactions (
    user_id, wallet_id, service, provider, product, amount,
    customer_identifier, internal_reference, status, metadata,
    provider_request_id, provider_transaction_id
  ) VALUES (
    uid, w.id, 'Airtime', prov, 'VTU', round(_amount, 2),
    phone, ref, 'pending',
    jsonb_build_object(
      'title', 'Airtime Purchase',
      'service_slug', 'airtime',
      'service_label', upper(prov) || ' Airtime',
      'masked', '••••' || right(phone, 4),
      'channel', 'vtpass',
      'provider_name', 'vtpass'
    ),
    rid,
    NULL
  )
  RETURNING id INTO bid;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, balance_before, balance_after,
    reference, status, description, metadata
  ) VALUES (
    w.id, uid, 'bill_payment', round(_amount, 2), before, after,
    public.new_reference('WAL'), 'pending',
    upper(prov) || ' Airtime',
    jsonb_build_object(
      'bill_reference', ref,
      'bill_id', bid,
      'provider_request_id', rid,
      'title', 'Airtime Purchase',
      'service_slug', 'airtime',
      'service_label', upper(prov) || ' Airtime',
      'masked', '••••' || right(phone, 4),
      'channel', 'vtpass'
    )
  );

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    uid,
    'Airtime purchase is being confirmed',
    'We are confirming your ' || upper(prov) || ' airtime of NGN ' ||
      to_char(round(_amount, 2), 'FM999,999,990.00') || '.',
    'pending'::public.notification_type,
    jsonb_build_object('reference', ref)
  );

  RETURN QUERY SELECT bid, ref, rid, after;
END;
$$;

NOTIFY pgrst, 'reload schema';
