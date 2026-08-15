-- Fix: RETURNS TABLE (internal_reference text, status ...) creates PL/pgSQL
-- variables with those names. Unqualified "internal_reference" and "status"
-- in WHERE/UPDATE are ambiguous vs bill_transactions columns.
-- Error seen on Refresh Status: column reference "internal_reference" is ambiguous

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
  v_before numeric;
  v_after numeric;
  did_refund boolean := false;
BEGIN
  IF _outcome NOT IN ('successful', 'failed', 'pending') THEN
    RAISE EXCEPTION 'invalid outcome';
  END IF;

  SELECT * INTO b
  FROM public.bill_transactions bt
  WHERE bt.internal_reference = _internal_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction not found';
  END IF;

  -- Already final → idempotent
  IF b.status IN ('successful', 'failed') THEN
    SELECT wlt.balance INTO v_after
    FROM public.wallets wlt
    WHERE wlt.id = b.wallet_id;

    bill_id := b.id;
    internal_reference := b.internal_reference;
    status := b.status;
    balance_after := v_after;
    refunded := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF _outcome = 'pending' THEN
    UPDATE public.bill_transactions bt
    SET metadata = coalesce(bt.metadata, '{}'::jsonb) || coalesce(_payload, '{}'::jsonb),
        provider_transaction_id = coalesce(
          nullif(trim(_provider_transaction_id), ''),
          bt.provider_transaction_id
        )
    WHERE bt.id = b.id;

    SELECT wlt.balance INTO v_after
    FROM public.wallets wlt
    WHERE wlt.id = b.wallet_id;

    bill_id := b.id;
    internal_reference := b.internal_reference;
    status := 'pending'::public.tx_status;
    balance_after := v_after;
    refunded := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF _outcome = 'successful' THEN
    UPDATE public.bill_transactions bt
    SET status = 'successful',
        provider_transaction_id = coalesce(
          nullif(trim(_provider_transaction_id), ''),
          bt.provider_transaction_id
        ),
        metadata = coalesce(bt.metadata, '{}'::jsonb) || coalesce(_payload, '{}'::jsonb)
    WHERE bt.id = b.id;

    UPDATE public.wallet_transactions wt
    SET status = 'successful',
        metadata = coalesce(wt.metadata, '{}'::jsonb)
          || jsonb_build_object('finalized', 'successful')
    WHERE wt.metadata->>'bill_reference' = b.internal_reference;

    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      b.user_id,
      'Airtime purchase successful',
      coalesce(b.provider, 'Network') || ' airtime of NGN ' ||
        to_char(b.amount, 'FM999,999,990.00') || ' delivered.',
      'success'::public.notification_type,
      jsonb_build_object('reference', b.internal_reference)
    );

    SELECT wlt.balance INTO v_after
    FROM public.wallets wlt
    WHERE wlt.id = b.wallet_id;

    bill_id := b.id;
    internal_reference := b.internal_reference;
    status := 'successful'::public.tx_status;
    balance_after := v_after;
    refunded := false;
    RETURN NEXT;
    RETURN;
  END IF;

  -- failed → refund once
  SELECT * INTO w FROM public.wallets wlt WHERE wlt.id = b.wallet_id FOR UPDATE;
  v_before := w.balance;
  v_after := v_before + b.amount;
  UPDATE public.wallets wlt SET balance = v_after WHERE wlt.id = w.id;
  did_refund := true;

  UPDATE public.bill_transactions bt
  SET status = 'failed',
      provider_transaction_id = coalesce(
        nullif(trim(_provider_transaction_id), ''),
        bt.provider_transaction_id
      ),
      metadata = coalesce(bt.metadata, '{}'::jsonb)
        || coalesce(_payload, '{}'::jsonb)
        || jsonb_build_object('refunded', true)
  WHERE bt.id = b.id;

  UPDATE public.wallet_transactions wt
  SET status = 'failed',
      metadata = coalesce(wt.metadata, '{}'::jsonb)
        || jsonb_build_object('refunded', true)
  WHERE wt.metadata->>'bill_reference' = b.internal_reference;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, balance_before, balance_after,
    reference, status, description, metadata
  ) VALUES (
    w.id, b.user_id, 'refund', b.amount, v_before, v_after,
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

  bill_id := b.id;
  internal_reference := b.internal_reference;
  status := 'failed'::public.tx_status;
  balance_after := v_after;
  refunded := did_refund;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_airtime_purchase(text, public.tx_status, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_airtime_purchase(text, public.tx_status, text, jsonb)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
