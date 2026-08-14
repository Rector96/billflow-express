-- Phase 4A: Airtime provider settlement (VTpass sandbox).
-- Additive only. Does not change Paystack funding paths.
--
-- Model:
-- 1) start_airtime_purchase: PIN + debit + bill/wallet rows as pending
-- 2) complete_airtime_purchase: server-only finalizer
--      successful → mark successful (debit already applied)
--      failed     → refund once + mark failed
-- Client never sets outcome.

ALTER TABLE public.bill_transactions
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_request_id text,
  ADD COLUMN IF NOT EXISTS provider_transaction_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_provider_request_id
  ON public.bill_transactions (provider_request_id)
  WHERE provider_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bill_provider_status
  ON public.bill_transactions (provider, status, created_at DESC);

-- Lagos-style request id: YYYYMMDDHHmm + random (min 12 numeric prefix)
CREATE OR REPLACE FUNCTION public.vtpass_request_id()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  lagos timestamptz := now() AT TIME ZONE 'Africa/Lagos';
  prefix text;
BEGIN
  prefix := to_char(lagos, 'YYYYMMDDHH24MI');
  RETURN prefix || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
END;
$$;

REVOKE ALL ON FUNCTION public.vtpass_request_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vtpass_request_id() TO authenticated, service_role;

-- ========== START (debit + pending) ==========
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

  -- PIN
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

  -- Idempotency: reuse open pending for same request_id
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
    provider, provider_request_id
  ) VALUES (
    uid, w.id, 'Airtime', prov, 'VTU', round(_amount, 2),
    phone, ref, 'pending',
    jsonb_build_object(
      'title', 'Airtime Purchase',
      'service_slug', 'airtime',
      'service_label', upper(prov) || ' Airtime',
      'masked', '••••' || right(phone, 4),
      'channel', 'vtpass'
    ),
    'vtpass', rid
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

REVOKE ALL ON FUNCTION public.start_airtime_purchase(text, text, numeric, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_airtime_purchase(text, text, numeric, text, text)
  TO authenticated, service_role;

-- ========== COMPLETE (server authority) ==========
CREATE OR REPLACE FUNCTION public.complete_airtime_purchase(
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
  b public.bill_transactions%ROWTYPE;
  w public.wallets%ROWTYPE;
  before numeric;
  after numeric;
  did_refund boolean := false;
BEGIN
  IF _outcome NOT IN ('successful', 'failed', 'pending') THEN
    RAISE EXCEPTION 'invalid outcome';
  END IF;

  SELECT * INTO b FROM public.bill_transactions
  WHERE internal_reference = _internal_reference
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction not found'; END IF;

  -- Idempotent: already final
  IF b.status IN ('successful', 'failed') THEN
    SELECT balance INTO after FROM public.wallets WHERE id = b.wallet_id;
    RETURN QUERY SELECT b.id, b.internal_reference, b.status, after, false;
    RETURN;
  END IF;

  IF _outcome = 'pending' THEN
    UPDATE public.bill_transactions
    SET metadata = coalesce(metadata, '{}'::jsonb) || coalesce(_payload, '{}'::jsonb),
        provider_transaction_id = coalesce(_provider_transaction_id, provider_transaction_id)
    WHERE id = b.id;
    SELECT balance INTO after FROM public.wallets WHERE id = b.wallet_id;
    RETURN QUERY SELECT b.id, b.internal_reference, 'pending'::public.tx_status, after, false;
    RETURN;
  END IF;

  IF _outcome = 'successful' THEN
    UPDATE public.bill_transactions
    SET status = 'successful',
        provider_transaction_id = coalesce(_provider_transaction_id, provider_transaction_id),
        metadata = coalesce(metadata, '{}'::jsonb) || coalesce(_payload, '{}'::jsonb)
    WHERE id = b.id;

    UPDATE public.wallet_transactions
    SET status = 'successful',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('finalized', 'successful')
    WHERE metadata->>'bill_reference' = b.internal_reference;

    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      b.user_id,
      'Airtime purchase successful',
      coalesce(b.provider, 'Network') || ' airtime of NGN ' ||
        to_char(b.amount, 'FM999,999,990.00') || ' delivered.',
      'success'::public.notification_type,
      jsonb_build_object('reference', b.internal_reference)
    );

    SELECT balance INTO after FROM public.wallets WHERE id = b.wallet_id;
    RETURN QUERY SELECT b.id, b.internal_reference, 'successful'::public.tx_status, after, false;
    RETURN;
  END IF;

  -- failed → refund once
  SELECT * INTO w FROM public.wallets WHERE id = b.wallet_id FOR UPDATE;
  before := w.balance;
  after := before + b.amount;
  UPDATE public.wallets SET balance = after WHERE id = w.id;
  did_refund := true;

  UPDATE public.bill_transactions
  SET status = 'failed',
      provider_transaction_id = coalesce(_provider_transaction_id, provider_transaction_id),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(_payload, '{}'::jsonb) ||
        jsonb_build_object('refunded', true)
  WHERE id = b.id;

  UPDATE public.wallet_transactions
  SET status = 'failed',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('refunded', true)
  WHERE metadata->>'bill_reference' = b.internal_reference;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, balance_before, balance_after,
    reference, status, description, metadata
  ) VALUES (
    w.id, b.user_id, 'refund', b.amount, before, after,
    public.new_reference('RFD'), 'successful',
    'Refund: Airtime ' || b.internal_reference,
    jsonb_build_object(
      'bill_reference', b.internal_reference,
      'title', 'Airtime Refund',
      'service_slug', 'airtime',
      'channel', 'vtpass'
    )
  );

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    b.user_id,
    'Airtime purchase failed',
    'Your airtime purchase failed. NGN ' || to_char(b.amount, 'FM999,999,990.00') ||
      ' has been returned to your wallet.',
    'warning'::public.notification_type,
    jsonb_build_object('reference', b.internal_reference)
  );

  RETURN QUERY SELECT b.id, b.internal_reference, 'failed'::public.tx_status, after, did_refund;
END;
$$;

-- Callable by authenticated user (own tx) for requery path + service_role
REVOKE ALL ON FUNCTION public.complete_airtime_purchase(text, public.tx_status, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_airtime_purchase(text, public.tx_status, text, jsonb)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
