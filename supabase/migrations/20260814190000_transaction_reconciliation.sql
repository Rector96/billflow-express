-- Phase 4A.2: Transaction reconciliation fields (ADDITIVE only).
-- Does not change wallet math, Paystack, PIN, or Airtime API behavior.
-- Existing rows keep NULL on new columns; metadata remains source of truth for older txs.

ALTER TABLE public.bill_transactions
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS provider_response_code text,
  ADD COLUMN IF NOT EXISTS provider_response_message text,
  ADD COLUMN IF NOT EXISTS provider_channel text;

-- Helpful lookups (partial indexes stay small)
CREATE INDEX IF NOT EXISTS idx_bill_internal_reference
  ON public.bill_transactions (internal_reference);

CREATE INDEX IF NOT EXISTS idx_bill_provider_transaction_id
  ON public.bill_transactions (provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bill_status_created
  ON public.bill_transactions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bill_channel_status
  ON public.bill_transactions (provider_channel, status, created_at DESC)
  WHERE provider_channel IS NOT NULL;

-- Backfill channel from known metadata / airtime product path (safe, non-destructive)
UPDATE public.bill_transactions
SET provider_channel = 'vtpass'
WHERE provider_channel IS NULL
  AND (
    coalesce(metadata->>'channel', '') = 'vtpass'
    OR coalesce(metadata->>'provider_name', '') = 'vtpass'
    OR product = 'VTU'
  );

-- Enhance complete_airtime_purchase to persist provider status fields without changing money rules.
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
  p_code text;
  p_status text;
  p_msg text;
BEGIN
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

  -- Idempotent: already final
  IF b.status IN ('successful', 'failed') THEN
    -- Still merge latest provider snapshot for investigation (no money move)
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

    -- Notify only on meaningful transition pending → successful
    IF b.status = 'pending' THEN
      INSERT INTO public.notifications (user_id, title, message, type, metadata)
      VALUES (
        b.user_id,
        'Airtime purchase successful',
        coalesce(b.provider, 'Network') || ' airtime of NGN ' ||
          to_char(b.amount, 'FM999,999,990.00') || ' delivered.',
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
      'Your airtime purchase failed. NGN ' || to_char(b.amount, 'FM999,999,990.00') ||
        ' has been returned to your wallet.',
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

-- Staff-only: list bill rows that need reconciliation attention (read model).
CREATE OR REPLACE FUNCTION public.admin_reconciliation_queue(_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  lim int := LEAST(GREATEST(COALESCE(_limit, 50), 1), 200);
BEGIN
  IF uid IS NULL OR NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC)
    FROM (
      SELECT
        b.id,
        b.internal_reference,
        b.service,
        b.provider,
        b.amount,
        b.status AS rockpay_status,
        b.provider_status,
        b.provider_response_code,
        b.provider_request_id,
        b.provider_transaction_id,
        b.provider_channel,
        b.customer_identifier,
        b.user_id,
        b.created_at,
        b.updated_at,
        CASE
          WHEN b.status = 'pending'
            AND coalesce(b.provider_status, '') IN ('delivered', 'success', 'successful')
            THEN 'provider_success_rockpay_pending'
          WHEN b.status = 'failed'
            AND coalesce(b.provider_status, '') IN ('delivered', 'success', 'successful')
            THEN 'provider_success_rockpay_failed'
          WHEN b.status = 'successful'
            AND coalesce(b.provider_status, '') IN ('failed')
            THEN 'provider_failed_rockpay_success'
          WHEN b.status = 'pending'
            AND b.provider_request_id IS NULL
            THEN 'missing_provider_reference'
          WHEN b.status = 'pending'
            AND b.created_at < now() - interval '15 minutes'
            THEN 'stale_pending'
          WHEN b.status = 'pending'
            AND coalesce(b.provider_response_code, '') = ''
            AND b.provider_request_id IS NOT NULL
            THEN 'awaiting_provider_response'
          ELSE 'other'
        END AS reason
      FROM public.bill_transactions b
      WHERE
        (
          (b.status = 'pending' AND coalesce(b.provider_status, '') IN ('delivered', 'success', 'successful'))
          OR (b.status = 'failed' AND coalesce(b.provider_status, '') IN ('delivered', 'success', 'successful'))
          OR (b.status = 'successful' AND coalesce(b.provider_status, '') IN ('failed'))
          OR (b.status = 'pending' AND b.provider_request_id IS NULL)
          OR (b.status = 'pending' AND b.created_at < now() - interval '15 minutes')
        )
      ORDER BY b.created_at DESC
      LIMIT lim
    ) t
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reconciliation_queue(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reconciliation_queue(int) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
