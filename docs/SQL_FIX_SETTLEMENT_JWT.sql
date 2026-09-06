-- Paste in Supabase SQL Editor if history stays Pending while pay shows Success.
-- Makes trusted_complete_* set auth.uid() correctly for service_role callers.

CREATE OR REPLACE FUNCTION public.trusted_complete_bill_purchase(
  _user_id uuid,
  _internal_reference text,
  _outcome public.tx_status,
  _provider_transaction_id text DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (bill_id uuid, internal_reference text, status public.tx_status, balance_after numeric, refunded boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF auth.role() <> 'service_role' OR _user_id IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _user_id::text, 'role', 'authenticated')::text, true);
  RETURN QUERY SELECT * FROM public.complete_bill_purchase(_internal_reference, _outcome, _provider_transaction_id, _payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.trusted_complete_airtime_purchase(
  _user_id uuid,
  _internal_reference text,
  _outcome public.tx_status,
  _provider_transaction_id text DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (bill_id uuid, internal_reference text, status public.tx_status, balance_after numeric, refunded boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF auth.role() <> 'service_role' OR _user_id IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _user_id::text, 'role', 'authenticated')::text, true);
  RETURN QUERY SELECT * FROM public.complete_airtime_purchase(_internal_reference, _outcome, _provider_transaction_id, _payload);
END;
$$;

GRANT EXECUTE ON FUNCTION public.trusted_complete_bill_purchase(uuid, text, public.tx_status, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.trusted_complete_airtime_purchase(uuid, text, public.tx_status, text, jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';

-- One-time repair: align pending wallet rows with successful/failed bills
UPDATE public.wallet_transactions wt
SET status = 'successful', updated_at = now()
FROM public.bill_transactions bt
WHERE wt.metadata->>'bill_reference' = bt.internal_reference
  AND bt.status = 'successful'
  AND wt.status = 'pending';

UPDATE public.wallet_transactions wt
SET status = 'failed', updated_at = now()
FROM public.bill_transactions bt
WHERE wt.metadata->>'bill_reference' = bt.internal_reference
  AND bt.status = 'failed'
  AND wt.status = 'pending';
