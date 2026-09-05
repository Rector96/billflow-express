-- Direct bill pay: Paystack collects customer amount, then server fulfills via VTpass.
-- No wallet debit/refund on this path. Wallet purchase path unchanged.

CREATE OR REPLACE FUNCTION public.start_direct_bill_order(
  _service_slug text,
  _service_label text,
  _provider text,
  _product text,
  _customer_identifier text,
  _amount numeric,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _request_id text DEFAULT NULL
)
RETURNS TABLE (
  bill_id uuid,
  internal_reference text,
  request_id text,
  paystack_reference text,
  amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  uid uuid := auth.uid();
  w public.wallets%ROWTYPE;
  ref text;
  rid text;
  ps_ref text;
  bid uuid;
  slug text;
  amt numeric;
  existing uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  slug := lower(trim(coalesce(_service_slug, '')));
  IF slug NOT IN ('cable', 'electricity') THEN
    RAISE EXCEPTION 'unsupported_service';
  END IF;

  amt := round(coalesce(_amount, 0), 2);
  IF amt < 50 OR amt > 500000 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF nullif(trim(coalesce(_provider, '')), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_provider';
  END IF;
  IF nullif(trim(coalesce(_customer_identifier, '')), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_identifier';
  END IF;

  SELECT * INTO w FROM public.wallets WHERE user_id = uid;
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance, status)
    VALUES (uid, 0, 'active')
    RETURNING * INTO w;
  END IF;

  rid := nullif(trim(coalesce(_request_id, '')), '');
  IF rid IS NOT NULL THEN
    SELECT id INTO existing FROM public.bill_transactions
    WHERE user_id = uid AND provider_request_id = rid LIMIT 1;
    IF existing IS NOT NULL THEN
      RETURN QUERY
        SELECT b.id, b.internal_reference, b.provider_request_id,
               coalesce(b.external_reference, b.metadata->>'paystack_reference'),
               b.amount
        FROM public.bill_transactions b
        WHERE b.id = existing;
      RETURN;
    END IF;
  ELSE
    rid := public.vtpass_request_id();
  END IF;

  ref := public.new_reference('BIL');
  ps_ref := public.new_reference('DIR');

  INSERT INTO public.bill_transactions (
    user_id, wallet_id, service, provider, product, amount,
    customer_identifier, internal_reference, status, metadata,
    provider_request_id, provider_channel, external_reference
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
      'payment_mode', 'direct_paystack',
      'paystack_reference', ps_ref,
      'title', coalesce(_metadata->>'title', initcap(slug) || ' Payment')
    ),
    rid,
    'vtpass',
    ps_ref
  )
  RETURNING id INTO bid;

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    uid,
    'Complete payment to continue',
    'Pay NGN ' || to_char(amt, 'FM999,999,990.00') || ' securely to process your ' || initcap(slug) || ' bill.',
    'info'::public.notification_type,
    jsonb_build_object('reference', ref, 'paystack_reference', ps_ref)
  );

  RETURN QUERY SELECT bid, ref, rid, ps_ref, amt;
END;
$$;

REVOKE ALL ON FUNCTION public.start_direct_bill_order(text, text, text, text, text, numeric, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_direct_bill_order(text, text, text, text, text, numeric, jsonb, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.complete_direct_bill_purchase(
  _internal_reference text,
  _outcome public.tx_status,
  _provider_transaction_id text DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  bill_id uuid,
  internal_reference text,
  status public.tx_status,
  amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  uid uuid := auth.uid();
  b public.bill_transactions%ROWTYPE;
  p_code text;
  p_status text;
  p_msg text;
  slug text;
  token text;
  mode text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _outcome NOT IN ('successful', 'failed', 'pending') THEN
    RAISE EXCEPTION 'invalid outcome';
  END IF;

  p_code := nullif(trim(coalesce(_payload->>'vtpass_code', '')), '');
  p_status := nullif(trim(coalesce(_payload->>'vtpass_status', '')), '');
  p_msg := nullif(trim(coalesce(_payload->>'response_description', '')), '');
  token := nullif(trim(coalesce(_payload->>'purchased_code', _payload->>'token', '')), '');

  SELECT * INTO b FROM public.bill_transactions
  WHERE internal_reference = _internal_reference
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction not found'; END IF;

  IF b.user_id <> uid AND NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  mode := coalesce(b.metadata->>'payment_mode', '');
  IF mode <> 'direct_paystack' THEN
    RAISE EXCEPTION 'not_direct_bill';
  END IF;

  slug := coalesce(b.metadata->>'service_slug', lower(b.service));

  IF b.status IN ('successful', 'failed') THEN
    UPDATE public.bill_transactions
    SET metadata = coalesce(metadata, '{}'::jsonb) || coalesce(_payload, '{}'::jsonb),
        provider_transaction_id = coalesce(nullif(_provider_transaction_id, ''), provider_transaction_id),
        provider_response_code = coalesce(p_code, provider_response_code),
        provider_status = coalesce(p_status, provider_status),
        provider_response_message = coalesce(p_msg, provider_response_message),
        updated_at = now()
    WHERE id = b.id;
    RETURN QUERY SELECT b.id, b.internal_reference, b.status, b.amount;
    RETURN;
  END IF;

  IF _outcome = 'pending' THEN
    UPDATE public.bill_transactions
    SET metadata = coalesce(metadata, '{}'::jsonb) || coalesce(_payload, '{}'::jsonb),
        provider_transaction_id = coalesce(nullif(_provider_transaction_id, ''), provider_transaction_id),
        provider_response_code = coalesce(p_code, provider_response_code),
        provider_status = coalesce(p_status, provider_status),
        provider_response_message = coalesce(p_msg, provider_response_message),
        updated_at = now()
    WHERE id = b.id;
    RETURN QUERY SELECT b.id, b.internal_reference, 'pending'::public.tx_status, b.amount;
    RETURN;
  END IF;

  IF _outcome = 'successful' THEN
    UPDATE public.bill_transactions
    SET status = 'successful',
        provider_transaction_id = coalesce(nullif(_provider_transaction_id, ''), provider_transaction_id),
        provider_response_code = coalesce(p_code, provider_response_code),
        provider_status = coalesce(p_status, provider_status),
        provider_response_message = coalesce(p_msg, provider_response_message),
        metadata = coalesce(metadata, '{}'::jsonb) || coalesce(_payload, '{}'::jsonb)
          || CASE WHEN token IS NOT NULL THEN jsonb_build_object('token', token, 'purchased_code', token) ELSE '{}'::jsonb END,
        updated_at = now()
    WHERE id = b.id;

    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      b.user_id,
      initcap(slug) || ' payment successful',
      'Your ' || initcap(slug) || ' purchase of NGN ' || to_char(b.amount, 'FM999,999,990.00') || ' was successful.'
        || CASE WHEN token IS NOT NULL THEN ' Token is on your receipt.' ELSE '' END,
      'success'::public.notification_type,
      jsonb_build_object('reference', b.internal_reference)
    );

    RETURN QUERY SELECT b.id, b.internal_reference, 'successful'::public.tx_status, b.amount;
    RETURN;
  END IF;

  UPDATE public.bill_transactions
  SET status = 'failed',
      provider_transaction_id = coalesce(nullif(_provider_transaction_id, ''), provider_transaction_id),
      provider_response_code = coalesce(p_code, provider_response_code),
      provider_status = coalesce(p_status, provider_status),
      provider_response_message = coalesce(p_msg, provider_response_message),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(_payload, '{}'::jsonb) ||
        jsonb_build_object('direct_pay_failed', true),
      updated_at = now()
  WHERE id = b.id;

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  VALUES (
    b.user_id,
    initcap(slug) || ' could not be completed',
    'Payment was received but the provider could not fulfill this bill. Open Care with your reference for a refund.',
    'warning'::public.notification_type,
    jsonb_build_object('reference', b.internal_reference)
  );

  RETURN QUERY SELECT b.id, b.internal_reference, 'failed'::public.tx_status, b.amount;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_direct_bill_purchase(text, public.tx_status, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_direct_bill_purchase(text, public.tx_status, text, jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trusted_complete_direct_bill_purchase(
  _user_id uuid,
  _internal_reference text,
  _outcome public.tx_status,
  _provider_transaction_id text DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (bill_id uuid, internal_reference text, status public.tx_status, amount numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF auth.role() <> 'service_role' OR _user_id IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  RETURN QUERY SELECT * FROM public.complete_direct_bill_purchase(
    _internal_reference, _outcome, _provider_transaction_id, _payload
  );
END;
$$;

REVOKE ALL ON FUNCTION public.trusted_complete_direct_bill_purchase(uuid, text, public.tx_status, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trusted_complete_direct_bill_purchase(uuid, text, public.tx_status, text, jsonb)
  TO service_role;

NOTIFY pgrst, 'reload schema';
