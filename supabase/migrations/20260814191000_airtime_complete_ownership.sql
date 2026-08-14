-- Phase 4A.3: Harden complete_airtime_purchase authorization.
-- ADDITIVE safety: only the bill owner or staff may finalize a bill.
-- Does not change wallet math, refund-once, or success-once rules.

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
  uid uuid := auth.uid();
  b public.bill_transactions%ROWTYPE;
  w public.wallets%ROWTYPE;
  before numeric;
  after numeric;
  did_refund boolean := false;
  p_code text;
  p_status text;
  p_msg text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF _outcome NOT IN ('successful', 'failed', 'pending') THEN
    RAISE EXCEPTION 'invalid outcome';
  END IF;

  p_code := nullif(trim(coalesce(_payload->>'vtpass_code', '')), '');
  p_status := nullif(trim(coalesce(_payload->>'vtpass_status', '')), '');
  p_msg := nullif(trim(coalesce(_payload->>'response_description', '')), '');

  SELECT * INTO b FROM public.bill_transactions
  WHERE internal_reference = _internal_reference
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction not found'; END IF;

  -- Owner or staff only (SECURITY DEFINER must not allow cross-user finalize)
  IF b.user_id <> uid AND NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Idempotent: already final — refresh provider snapshot only, never move money
  IF b.status IN ('successful', 'failed') THEN
    UPDATE public.bill_transactions
    SET metadata = coalesce(metadata, '{}'::jsonb) || coalesce(_payload, '{}'::jsonb),
        provider_transaction_id = coalesce(nullif(_provider_transaction_id, ''), provider_transaction_id),
        provider_response_code = coalesce(p_code, provider_response_code),
        provider_status = coalesce(p_status, provider_status),
        provider_response_message = coalesce(p_msg, provider_response_message),
        provider_channel = coalesce(provider_channel, 'vtpass'),
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
        provider_channel = coalesce(provider_channel, 'vtpass'),
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
        provider_channel = coalesce(provider_channel, 'vtpass'),
        metadata = coalesce(metadata, '{}'::jsonb) || coalesce(_payload, '{}'::jsonb),
        updated_at = now()
    WHERE id = b.id;

    UPDATE public.wallet_transactions
    SET status = 'successful',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('finalized', 'successful'),
        updated_at = now()
    WHERE metadata->>'bill_reference' = b.internal_reference;

    IF b.status = 'pending' THEN
      INSERT INTO public.notifications (user_id, title, message, type, metadata)
      VALUES (
        b.user_id,
        'Airtime purchase successful',
        'Your Airtime purchase of NGN ' || to_char(b.amount, 'FM999,999,990.00') || ' was successful.',
        'success'::public.notification_type,
        jsonb_build_object('reference', b.internal_reference)
      );
    END IF;

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
      provider_transaction_id = coalesce(nullif(_provider_transaction_id, ''), provider_transaction_id),
      provider_response_code = coalesce(p_code, provider_response_code),
      provider_status = coalesce(p_status, provider_status),
      provider_response_message = coalesce(p_msg, provider_response_message),
      provider_channel = coalesce(provider_channel, 'vtpass'),
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
    'Refund: Airtime ' || b.internal_reference,
    jsonb_build_object(
      'bill_reference', b.internal_reference,
      'title', 'Airtime Refund',
      'service_slug', 'airtime',
      'channel', 'vtpass'
    )
  );

  IF b.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      b.user_id,
      'Airtime purchase failed',
      'Your Airtime purchase failed. Your wallet has been refunded.',
      'warning'::public.notification_type,
      jsonb_build_object('reference', b.internal_reference)
    );
  END IF;

  RETURN QUERY SELECT b.id, b.internal_reference, 'failed'::public.tx_status, after, did_refund;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_airtime_purchase(text, public.tx_status, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_airtime_purchase(text, public.tx_status, text, jsonb)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
