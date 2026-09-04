-- Fix exam-pins start_bill_purchase: use bill_payment enum (not debit).
-- The previous migration used 'debit' which is not in wallet_tx_type enum,
-- which surfaced as a misleading "RockPay Care migration" error in the app.

CREATE OR REPLACE FUNCTION public.start_bill_purchase(
  _service_slug text,
  _service_label text,
  _provider text,
  _product text,
  _customer_identifier text,
  _amount numeric,
  _pin text,
  _metadata jsonb DEFAULT '{}'::jsonb,
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
  slug text;
  existing uuid;
  amt numeric;
  min_amt numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  slug := lower(trim(coalesce(_service_slug, '')));
  IF slug NOT IN ('cable', 'electricity', 'data', 'exam-pins') THEN
    RAISE EXCEPTION 'unsupported_service';
  END IF;

  amt := round(coalesce(_amount, 0), 2);
  min_amt := CASE
    WHEN slug = 'data' THEN 1
    WHEN slug = 'exam-pins' THEN 50
    ELSE 50
  END;
  IF amt < min_amt OR amt > 500000 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'invalid_pin'; END IF;
  IF nullif(trim(coalesce(_provider, '')), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_provider';
  END IF;
  IF nullif(trim(coalesce(_customer_identifier, '')), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_identifier';
  END IF;

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
  IF before < amt THEN RAISE EXCEPTION 'insufficient_funds'; END IF;
  after := before - amt;
  UPDATE public.wallets SET balance = after WHERE id = w.id;

  ref := public.new_reference('BIL');

  INSERT INTO public.bill_transactions (
    user_id, wallet_id, service, provider, product, amount,
    customer_identifier, internal_reference, status, metadata,
    provider_request_id, provider_channel
  ) VALUES (
    uid, w.id,
    coalesce(nullif(trim(_service_label), ''), initcap(slug)),
    lower(trim(_provider)),
    coalesce(nullif(trim(_product), ''), ''),
    amt,
    trim(_customer_identifier),
    ref,
    'pending',
    coalesce(_metadata, '{}'::jsonb) || jsonb_build_object(
      'service_slug', slug,
      'channel', 'vtpass',
      'title', coalesce(_metadata->>'title', initcap(slug) || ' Payment')
    ),
    rid,
    'vtpass'
  )
  RETURNING id INTO bid;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, balance_before, balance_after,
    reference, status, description, metadata
  ) VALUES (
    w.id, uid, 'bill_payment', amt, before, after,
    public.new_reference('WAL'), 'pending',
    coalesce(_metadata->>'service_label', initcap(slug) || ' Payment'),
    jsonb_build_object(
      'bill_reference', ref,
      'bill_id', bid,
      'provider_request_id', rid,
      'title', coalesce(_metadata->>'title', initcap(slug) || ' Payment'),
      'service_slug', slug,
      'service_label', coalesce(_metadata->>'service_label', initcap(slug) || ' Payment'),
      'masked', coalesce(_metadata->>'masked', '••••' || right(trim(_customer_identifier), 4)),
      'channel', 'vtpass',
      'customer', _metadata->>'customer'
    )
  );

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    uid,
    initcap(slug) || ' payment is being confirmed',
    'We are confirming your payment of NGN ' || to_char(amt, 'FM999,999,990.00') || '.',
    'pending'::public.notification_type,
    jsonb_build_object('reference', ref)
  );

  bill_id := bid;
  internal_reference := ref;
  request_id := rid;
  balance_after := after;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.start_bill_purchase(text, text, text, text, text, numeric, text, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_bill_purchase(text, text, text, text, text, numeric, text, jsonb, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
