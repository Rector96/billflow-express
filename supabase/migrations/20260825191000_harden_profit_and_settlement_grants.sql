-- Settlement and profit finalization are trusted server operations only.
REVOKE EXECUTE ON FUNCTION public.complete_bill_purchase(text, public.tx_status, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_airtime_purchase(text, public.tx_status, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_transaction_profit(text, numeric, numeric, numeric, numeric, numeric, uuid, text, text, text, numeric) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.complete_bill_purchase(text, public.tx_status, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_airtime_purchase(text, public.tx_status, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_transaction_profit(text, numeric, numeric, numeric, numeric, numeric, uuid, text, text, text, numeric) TO service_role;

-- These wrappers provide the customer identity required by completion ownership checks.
CREATE OR REPLACE FUNCTION public.trusted_complete_bill_purchase(
  _user_id uuid, _internal_reference text, _outcome public.tx_status,
  _provider_transaction_id text DEFAULT NULL, _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (bill_id uuid, internal_reference text, status public.tx_status, balance_after numeric, refunded boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF auth.role() <> 'service_role' OR _user_id IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  RETURN QUERY SELECT * FROM public.complete_bill_purchase(_internal_reference, _outcome, _provider_transaction_id, _payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.trusted_complete_airtime_purchase(
  _user_id uuid, _internal_reference text, _outcome public.tx_status,
  _provider_transaction_id text DEFAULT NULL, _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (bill_id uuid, internal_reference text, status public.tx_status, balance_after numeric, refunded boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF auth.role() <> 'service_role' OR _user_id IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  RETURN QUERY SELECT * FROM public.complete_airtime_purchase(_internal_reference, _outcome, _provider_transaction_id, _payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.trusted_record_transaction_profit(
  _internal_reference text, _customer_amount numeric, _provider_cost numeric DEFAULT NULL,
  _provider_commission numeric DEFAULT NULL, _rockpay_fee numeric DEFAULT NULL,
  _profit numeric DEFAULT NULL, _pricing_rule_id uuid DEFAULT NULL, _service text DEFAULT NULL,
  _provider text DEFAULT NULL, _product_code text DEFAULT NULL, _provider_amount numeric DEFAULT NULL
)
RETURNS TABLE (id uuid, already_recorded boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT * FROM public.record_transaction_profit(
    _internal_reference, _customer_amount, _provider_cost, _provider_commission,
    _rockpay_fee, _profit, _pricing_rule_id, _service, _provider, _product_code, _provider_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.trusted_complete_bill_purchase(uuid, text, public.tx_status, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trusted_complete_airtime_purchase(uuid, text, public.tx_status, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trusted_record_transaction_profit(text, numeric, numeric, numeric, numeric, numeric, uuid, text, text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trusted_complete_bill_purchase(uuid, text, public.tx_status, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.trusted_complete_airtime_purchase(uuid, text, public.tx_status, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.trusted_record_transaction_profit(text, numeric, numeric, numeric, numeric, numeric, uuid, text, text, text, numeric) TO service_role;

NOTIFY pgrst, 'reload schema';