-- Atomically finalize a verified CAC payment intent into one Hub order.
-- Only service_role may call this RPC; callers must independently verify Paystack first.

CREATE OR REPLACE FUNCTION public.finalize_hub_payment_intent(
  _payment_reference text,
  _provider_transaction_id bigint,
  _paid_at timestamptz DEFAULT now()
)
RETURNS TABLE (
  order_id uuid,
  tracking_reference text,
  user_id uuid,
  service text,
  amount numeric,
  order_payload jsonb,
  was_existing boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_intent public.hub_payment_intents%ROWTYPE;
  v_order public.hub_orders%ROWTYPE;
  v_tracking text;
  v_existing boolean := false;
BEGIN
  IF _payment_reference IS NULL OR length(trim(_payment_reference)) < 8
     OR _provider_transaction_id IS NULL OR _provider_transaction_id <= 0 THEN
    RAISE EXCEPTION 'Invalid Hub payment finalization arguments';
  END IF;

  SELECT * INTO v_intent
  FROM public.hub_payment_intents
  WHERE payment_reference = _payment_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown Hub payment intent';
  END IF;
  IF v_intent.service <> 'cac' OR v_intent.currency <> 'NGN' THEN
    RAISE EXCEPTION 'Unsupported Hub payment intent';
  END IF;

  IF v_intent.status = 'paid' THEN
    IF v_intent.provider_transaction_id <> _provider_transaction_id THEN
      RAISE EXCEPTION 'Hub intent already settled with a different provider transaction';
    END IF;
    SELECT * INTO v_order
    FROM public.hub_orders
    WHERE payment_reference = _payment_reference
    LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_order.id, v_order.tracking_reference, v_order.user_id,
        v_order.service, v_order.amount, v_intent.order_payload, true;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Paid Hub intent is missing its order record';
  END IF;

  IF v_intent.status <> 'pending' OR v_intent.expires_at < now() THEN
    RAISE EXCEPTION 'Hub payment intent is not pending or has expired';
  END IF;

  v_tracking := 'CAC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  INSERT INTO public.hub_orders (
    user_id, service, amount, status, payment_reference, tracking_reference,
    customer_identifier, fulfillment_status, paid_at, metadata
  ) VALUES (
    v_intent.user_id,
    'cac',
    v_intent.amount_kobo::numeric / 100,
    'pending',
    v_intent.payment_reference,
    v_tracking,
    v_intent.order_payload->>'nin',
    'paid',
    coalesce(_paid_at, now()),
    jsonb_build_object(
      'channel', 'hub',
      'demo', false,
      'fulfillment_status', 'paid',
      'source', 'verified_paystack_intent',
      'preferred_name', v_intent.order_payload->>'preferredName',
      'nature', v_intent.order_payload->>'nature',
      'owner_name', v_intent.order_payload->>'ownerName',
      'nin', v_intent.order_payload->>'nin',
      'owner_phone', v_intent.order_payload->>'ownerPhone',
      'owner_email', v_intent.order_payload->>'ownerEmail',
      'business_address', v_intent.order_payload->>'businessAddress',
      'delivery', v_intent.order_payload->>'delivery',
      'shipping_address', v_intent.order_payload->>'shippingAddress',
      'shipping', v_intent.order_payload->'shipping',
      'provider_transaction_id', _provider_transaction_id,
      'payment_intent_id', v_intent.id
    )
  )
  RETURNING * INTO v_order;

  UPDATE public.hub_payment_intents
  SET status = 'paid',
      provider_transaction_id = _provider_transaction_id,
      paid_at = coalesce(_paid_at, now()),
      updated_at = now()
  WHERE id = v_intent.id;

  RETURN QUERY SELECT v_order.id, v_order.tracking_reference, v_order.user_id,
    v_order.service, v_order.amount, v_intent.order_payload, false;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_hub_payment_intent(text, bigint, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_hub_payment_intent(text, bigint, timestamptz)
  TO service_role;

COMMENT ON FUNCTION public.finalize_hub_payment_intent(text, bigint, timestamptz) IS
  'Atomically creates exactly one CAC hub order and marks its server-owned payment intent paid after Paystack verification.';
