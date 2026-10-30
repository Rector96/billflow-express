-- Expire stale Hub checkout intents without discarding payment evidence.
--
-- Expiry stops a pending checkout from being treated as active. It does not
-- delete CAC evidence: a delayed Paystack webhook may still prove that payment
-- occurred inside the original intent validity window.
--
-- A verified late-arriving webhook may finalize an expired intent only when
-- Paystack's paid_at falls between created_at and expires_at.

CREATE OR REPLACE FUNCTION public.expire_hub_payment_intents(
  _batch_size integer DEFAULT 500
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF _batch_size IS NULL OR _batch_size < 1 OR _batch_size > 5000 THEN
    RAISE EXCEPTION 'Invalid Hub intent expiry batch size';
  END IF;

  WITH stale AS (
    SELECT id
    FROM public.hub_payment_intents
    WHERE status = 'pending'
      AND expires_at <= now()
    ORDER BY expires_at ASC
    LIMIT _batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.hub_payment_intents AS intent
  SET status = 'expired',
      updated_at = now()
  FROM stale
  WHERE intent.id = stale.id
    AND intent.status = 'pending';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_hub_payment_intents(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_hub_payment_intents(integer)
  TO service_role;

COMMENT ON FUNCTION public.expire_hub_payment_intents(integer) IS
  'Marks overdue pending Hub intents expired in bounded batches; preserves evidence for verified delayed-payment reconciliation.';

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
BEGIN
  IF _payment_reference IS NULL OR length(trim(_payment_reference)) < 8
     OR _provider_transaction_id IS NULL OR _provider_transaction_id <= 0 THEN
    RAISE EXCEPTION 'Invalid Hub payment finalization arguments';
  END IF;

  SELECT * INTO v_intent
  FROM public.hub_payment_intents
  WHERE payment_reference = _payment_reference
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown Hub payment intent'; END IF;
  IF v_intent.service <> 'cac' OR v_intent.currency <> 'NGN' THEN
    RAISE EXCEPTION 'Unsupported Hub payment intent';
  END IF;

  IF v_intent.status = 'paid' THEN
    IF v_intent.provider_transaction_id <> _provider_transaction_id THEN
      RAISE EXCEPTION 'Hub intent already settled with a different provider transaction';
    END IF;
    SELECT * INTO v_order FROM public.hub_orders
    WHERE payment_reference = _payment_reference LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_order.id, v_order.tracking_reference, v_order.user_id,
        v_order.service, v_order.amount, v_intent.order_payload, true;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Paid Hub intent is missing its order record';
  END IF;

  IF coalesce(_paid_at, now()) > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Paystack payment timestamp is invalid';
  END IF;

  -- Expired is recoverable only for a payment Paystack confirms was completed
  -- within the original 30-minute checkout window. Failed intents stay terminal.
  IF v_intent.status NOT IN ('pending', 'expired')
     OR coalesce(_paid_at, now()) < v_intent.created_at - interval '5 minutes'
     OR coalesce(_paid_at, now()) > v_intent.expires_at THEN
    RAISE EXCEPTION 'Hub payment intent is not eligible for payment reconciliation';
  END IF;

  IF jsonb_typeof(v_intent.order_payload->'applicationFiles') <> 'object'
     OR coalesce(v_intent.order_payload->'applicationFiles'->>'idDocument','') = ''
     OR coalesce(v_intent.order_payload->'applicationFiles'->>'passportPhoto','') = ''
     OR coalesce(v_intent.order_payload->'applicationFiles'->>'signature','') = '' THEN
    RAISE EXCEPTION 'CAC application evidence is incomplete';
  END IF;

  v_tracking := 'CAC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  INSERT INTO public.hub_orders (
    user_id, service, amount, status, payment_reference, tracking_reference,
    customer_identifier, fulfillment_status, paid_at, metadata
  ) VALUES (
    v_intent.user_id, 'cac', v_intent.amount_kobo::numeric / 100, 'pending',
    v_intent.payment_reference, v_tracking,
    v_intent.order_payload->>'nin', 'paid', coalesce(_paid_at, now()),
    jsonb_build_object(
      'channel','hub','demo',false,'fulfillment_status','paid',
      'source','verified_paystack_intent',
      'preferred_name',v_intent.order_payload->>'preferredName',
      'nature',v_intent.order_payload->>'nature',
      'owner_name',v_intent.order_payload->>'ownerName',
      'nin',v_intent.order_payload->>'nin',
      'owner_phone',v_intent.order_payload->>'ownerPhone',
      'owner_email',v_intent.order_payload->>'ownerEmail',
      'business_address',v_intent.order_payload->>'businessAddress',
      'delivery',v_intent.order_payload->>'delivery',
      'shipping_address',v_intent.order_payload->>'shippingAddress',
      'shipping',v_intent.order_payload->'shipping',
      'application',v_intent.order_payload,
      'application_files',v_intent.order_payload->'applicationFiles',
      'provider_transaction_id',_provider_transaction_id,
      'payment_intent_id',v_intent.id
    )
  ) RETURNING * INTO v_order;

  UPDATE public.hub_payment_intents
  SET status='paid', provider_transaction_id=_provider_transaction_id,
      paid_at=coalesce(_paid_at,now()), updated_at=now()
  WHERE id=v_intent.id;

  RETURN QUERY SELECT v_order.id,v_order.tracking_reference,v_order.user_id,
    v_order.service,v_order.amount,v_intent.order_payload,false;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_hub_payment_intent(text,bigint,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_hub_payment_intent(text,bigint,timestamptz)
  TO service_role;
