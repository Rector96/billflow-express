-- Additive: SECURITY DEFINER helper to record transaction_profits
-- Only callable from trusted server flows. Never accepts client status as success.
-- Idempotent on bill_transaction_id (unique constraint).

CREATE OR REPLACE FUNCTION public.record_transaction_profit(
  _internal_reference text,
  _customer_amount numeric,
  _provider_cost numeric DEFAULT NULL,
  _provider_commission numeric DEFAULT NULL,
  _rockpay_fee numeric DEFAULT NULL,
  _profit numeric DEFAULT NULL,
  _pricing_rule_id uuid DEFAULT NULL,
  _service text DEFAULT NULL,
  _provider text DEFAULT NULL,
  _product_code text DEFAULT NULL,
  _provider_amount numeric DEFAULT NULL
)
RETURNS TABLE (id uuid, already_recorded boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id uuid;
  v_status text;
  v_existing uuid;
  v_new_id uuid;
BEGIN
  IF _internal_reference IS NULL OR btrim(_internal_reference) = '' THEN
    RAISE EXCEPTION 'missing_reference';
  END IF;
  IF _customer_amount IS NULL OR _customer_amount < 0 THEN
    RAISE EXCEPTION 'invalid_customer_amount';
  END IF;

  SELECT bt.id, bt.status
    INTO v_bill_id, v_status
  FROM public.bill_transactions bt
  WHERE bt.internal_reference = btrim(_internal_reference)
  LIMIT 1;

  IF v_bill_id IS NULL THEN
    RAISE EXCEPTION 'bill_not_found';
  END IF;

  -- Only record for confirmed successful provider-backed transactions
  IF v_status IS DISTINCT FROM 'successful' THEN
    RAISE EXCEPTION 'not_successful';
  END IF;

  SELECT tp.id INTO v_existing
  FROM public.transaction_profits tp
  WHERE tp.bill_transaction_id = v_bill_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    id := v_existing;
    already_recorded := true;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.transaction_profits (
    bill_transaction_id,
    customer_amount,
    provider_cost,
    provider_commission,
    rockpay_fee,
    profit,
    pricing_rule_id
  ) VALUES (
    v_bill_id,
    _customer_amount,
    _provider_cost,
    _provider_commission,
    _rockpay_fee,
    _profit,
    _pricing_rule_id
  )
  ON CONFLICT (bill_transaction_id) DO NOTHING
  RETURNING transaction_profits.id INTO v_new_id;

  IF v_new_id IS NULL THEN
    SELECT tp.id INTO v_existing
    FROM public.transaction_profits tp
    WHERE tp.bill_transaction_id = v_bill_id
    LIMIT 1;
    id := v_existing;
    already_recorded := true;
    RETURN NEXT;
    RETURN;
  END IF;

  id := v_new_id;
  already_recorded := false;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.record_transaction_profit FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_transaction_profit TO service_role;
GRANT EXECUTE ON FUNCTION public.record_transaction_profit TO authenticated;

COMMENT ON FUNCTION public.record_transaction_profit IS
  'Trusted insert into transaction_profits for successful bill_transactions only. Idempotent. Never trust client-supplied success.';

NOTIFY pgrst, 'reload schema';
