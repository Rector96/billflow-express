-- Harden trusted settlement wrappers for server-side service_role calls.
-- The wrapper must preserve the customer identity while keeping the inner
-- completion function in its trusted/service-role execution path.

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
  IF auth.role() <> 'service_role' OR _user_id IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Make both auth.role() and auth.uid() deterministic inside the nested
  -- completion function. The customer id is retained for ownership/audit,
  -- while the role remains service_role for the trusted execution path.
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', _user_id::text, 'role', 'service_role')::text,
    true
  );

  RETURN QUERY
  SELECT * FROM public.complete_bill_purchase(
    _internal_reference,
    _outcome,
    _provider_transaction_id,
    _payload
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trusted_complete_airtime_purchase(
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
  IF auth.role() <> 'service_role' OR _user_id IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', _user_id::text, 'role', 'service_role')::text,
    true
  );

  RETURN QUERY
  SELECT * FROM public.complete_airtime_purchase(
    _internal_reference,
    _outcome,
    _provider_transaction_id,
    _payload
  );
END;
$$;

REVOKE ALL ON FUNCTION public.trusted_complete_bill_purchase(uuid, text, public.tx_status, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trusted_complete_airtime_purchase(uuid, text, public.tx_status, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trusted_complete_bill_purchase(uuid, text, public.tx_status, text, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.trusted_complete_airtime_purchase(uuid, text, public.tx_status, text, jsonb)
  TO service_role;

NOTIFY pgrst, 'reload schema';
