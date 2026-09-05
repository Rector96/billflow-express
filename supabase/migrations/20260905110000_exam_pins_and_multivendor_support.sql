-- Migration: Exam PINs, Education, and Multi-Vendor Settlement Support
-- Adds 'exam-pins' and 'education' to public.start_bill_purchase
-- Adds trusted_complete_bill_purchase for secure server-side settlements
-- Ensures service_role and authenticated users can complete bill payments

-- 1. Update start_bill_purchase to allow 'exam-pins', 'education', 'airtime', 'data', 'cable', 'electricity'
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
  chan text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  slug := lower(trim(coalesce(_service_slug, '')));
  IF slug NOT IN ('cable', 'electricity', 'data', 'exam-pins', 'education', 'airtime') THEN
    RAISE EXCEPTION 'unsupported_service';
  END IF;

  amt := round(coalesce(_amount, 0), 2);
  -- Low floor for data packs / airtime; 50 floor for others
  min_amt := CASE WHEN slug IN ('data', 'airtime') THEN 1 ELSE 50 END;
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
  chan := coalesce(_metadata->>'channel', _metadata->>'vendor', 'vtpass');

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
      'channel', chan,
      'title', coalesce(_metadata->>'title', initcap(slug) || ' Payment')
    ),
    rid,
    chan
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
      'channel', chan,
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

-- 2. Update complete_bill_purchase to support service_role and multi-vendor settlements
CREATE OR REPLACE FUNCTION public.complete_bill_purchase(
  _internal_reference text,
  _outcome public.tx_status,
  _provider_transaction_id text DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  bill_id uuid,
  internal_reference text,
  status public.tx_status,
  balance_after numeric,
  refunded boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  uid uuid := auth.uid();
  is_svc boolean := (
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  );
  b public.bill_transactions%ROWTYPE;
  w public.wallets%ROWTYPE;
  before numeric;
  after numeric;
  did_refund boolean := false;
  p_code text;
  p_status text;
  p_msg text;
  slug text;
  token text;
  chan text;
BEGIN
  IF uid IS NULL AND NOT is_svc THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _outcome NOT IN ('successful', 'failed', 'pending') THEN
    RAISE EXCEPTION 'invalid outcome';
  END IF;

  p_code := nullif(trim(coalesce(_payload->>'vtpass_code', _payload->>'code', '')), '');
  p_status := nullif(trim(coalesce(_payload->>'vtpass_status', _payload->>'status', '')), '');
  p_msg := nullif(trim(coalesce(_payload->>'response_description', _payload->>'message', '')), '');
  token := nullif(trim(coalesce(_payload->>'purchased_code', _payload->>'token', _payload->>'pin', '')), '');
  chan := coalesce(_payload->>'vendor', _payload->>'channel', 'vtpass');

  SELECT * INTO b FROM public.bill_transactions
  WHERE internal_reference = _internal_reference
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction not found'; END IF;

  IF NOT is_svc AND b.user_id <> uid AND NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  slug := coalesce(b.metadata->>'service_slug', lower(b.service));

  IF b.status IN ('successful', 'failed') THEN
    UPDATE public.bill_transactions
    SET metadata = coalesce(metadata, '{}'::jsonb) || coalesce(_payload, '{}'::jsonb),
        provider_transaction_id = coalesce(nullif(_provider_transaction_id, ''), provider_transaction_id),
        provider_response_code = coalesce(p_code, provider_response_code),
        provider_status = coalesce(p_status, provider_status),
        provider_response_message = coalesce(p_msg, provider_response_message),
        provider_channel = coalesce(chan, provider_channel),
        updated_at = now()
    WHERE id = b.id;
    SELECT balance INTO after FROM public.wallets WHERE id = b.wallet_id;
    RETURN QUERY SELECT b.id, b.internal_reference, b.status, after, false;
    RETURN;
  END IF;

  IF _outcome = 'pending' THEN
    UPDATE public.bill_transactions
    SET metadata = coalesce(metadata, '{}'::jsonb) || coalesce(_payload, '{}'::jsonb),
        provider_transaction_id = coalesce(nullif(_provider_transaction_id, ''), provider_transaction_id),
        provider_response_code = coalesce(p_code, provider_response_code),
        provider_status = coalesce(p_status, provider_status),
        provider_response_message = coalesce(p_msg, provider_response_message),
        provider_channel = coalesce(chan, provider_channel),
        updated_at = now()
    WHERE id = b.id;
    SELECT balance INTO after FROM public.wallets WHERE id = b.wallet_id;
    RETURN QUERY SELECT b.id, b.internal_reference, 'pending'::public.tx_status, after, false;
    RETURN;
  END IF;

  IF _outcome = 'successful' THEN
    UPDATE public.bill_transactions
    SET status = 'successful',
        provider_transaction_id = coalesce(nullif(_provider_transaction_id, ''), provider_transaction_id),
        provider_response_code = coalesce(p_code, provider_response_code),
        provider_status = coalesce(p_status, provider_status),
        provider_response_message = coalesce(p_msg, provider_response_message),
        provider_channel = coalesce(chan, provider_channel),
        metadata = coalesce(metadata, '{}'::jsonb) || coalesce(_payload, '{}'::jsonb)
          || CASE WHEN token IS NOT NULL THEN jsonb_build_object('token', token, 'purchased_code', token) ELSE '{}'::jsonb END,
        updated_at = now()
    WHERE id = b.id;

    UPDATE public.wallet_transactions
    SET status = 'successful',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('finalized', 'successful')
          || CASE WHEN token IS NOT NULL THEN jsonb_build_object('token', token) ELSE '{}'::jsonb END,
        updated_at = now()
    WHERE metadata->>'bill_reference' = b.internal_reference;

    IF b.status = 'pending' THEN
      INSERT INTO public.notifications (user_id, title, message, type, metadata)
      VALUES (
        b.user_id,
        initcap(slug) || ' payment successful',
        CASE
          WHEN slug = 'exam-pins' THEN 'Your ' || b.provider || ' PIN purchase was successful. View your PIN in receipt.'
          ELSE 'Your ' || initcap(slug) || ' purchase of NGN ' || to_char(b.amount, 'FM999,999,990.00') || ' was successful.'
            || CASE WHEN token IS NOT NULL THEN ' Token: ' || token ELSE '' END
        END,
        'success'::public.notification_type,
        jsonb_build_object('reference', b.internal_reference)
      );
    END IF;

    SELECT balance INTO after FROM public.wallets WHERE id = b.wallet_id;
    RETURN QUERY SELECT b.id, b.internal_reference, 'successful'::public.tx_status, after, false;
    RETURN;
  END IF;

  -- failed -> refund once
  SELECT * INTO w FROM public.wallets WHERE id = b.wallet_id FOR UPDATE;
  before := w.balance;
  after := before + b.amount;
  UPDATE public.wallets SET balance = after WHERE id = w.id;
  did_refund := true;

  UPDATE public.bill_transactions
  SET status = 'failed',
      provider_transaction_id = coalesce(nullif(_provider_transaction_id, ''), provider_transaction_id),
      provider_response_code = coalesce(p_code, provider_response_code),
      provider_status = coalesce(p_status, provider_status),
      provider_response_message = coalesce(p_msg, provider_response_message),
      provider_channel = coalesce(chan, provider_channel),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(_payload, '{}'::jsonb) ||
        jsonb_build_object('refunded', true),
      updated_at = now()
  WHERE id = b.id;

  UPDATE public.wallet_transactions
  SET status = 'failed',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('refunded', true),
      updated_at = now()
  WHERE metadata->>'bill_reference' = b.internal_reference;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, balance_before, balance_after,
    reference, status, description, metadata
  ) VALUES (
    w.id, b.user_id, 'refund', b.amount, before, after,
    public.new_reference('RFD'), 'successful',
    'Refund: ' || initcap(slug) || ' ' || b.internal_reference,
    jsonb_build_object(
      'bill_reference', b.internal_reference,
      'title', initcap(slug) || ' Refund',
      'service_slug', slug,
      'channel', chan
    )
  );

  IF b.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      b.user_id,
      initcap(slug) || ' payment failed',
      'Your ' || initcap(slug) || ' purchase failed. Your wallet has been refunded.',
      'warning'::public.notification_type,
      jsonb_build_object('reference', b.internal_reference)
    );
  END IF;

  RETURN QUERY SELECT b.id, b.internal_reference, 'failed'::public.tx_status, after, did_refund;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_bill_purchase(text, public.tx_status, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_bill_purchase(text, public.tx_status, text, jsonb)
  TO authenticated, service_role;

-- 3. Trusted helper for backend service settlements
CREATE OR REPLACE FUNCTION public.trusted_complete_bill_purchase(
  _user_id uuid,
  _internal_reference text,
  _outcome public.tx_status,
  _provider_transaction_id text DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  bill_id uuid,
  internal_reference text,
  status public.tx_status,
  balance_after numeric,
  refunded boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.complete_bill_purchase(
    _internal_reference,
    _outcome,
    _provider_transaction_id,
    _payload
  );
END;
$$;

REVOKE ALL ON FUNCTION public.trusted_complete_bill_purchase(uuid, text, public.tx_status, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trusted_complete_bill_purchase(uuid, text, public.tx_status, text, jsonb)
  TO service_role;

-- 4. Useful performance indexes
CREATE INDEX IF NOT EXISTS idx_bill_tx_internal_ref ON public.bill_transactions (internal_reference);
CREATE INDEX IF NOT EXISTS idx_bill_tx_provider_req ON public.bill_transactions (provider_request_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_bill_ref ON public.wallet_transactions ((metadata->>'bill_reference'));

NOTIFY pgrst, 'reload schema';
