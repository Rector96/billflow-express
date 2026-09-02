-- Dedicated NULL-only repair for transaction_profits provider economics.
-- Does NOT change record_transaction_profit insert / ON CONFLICT semantics.
-- service_role only. Never invents costs. Never overwrites non-NULL values.

CREATE OR REPLACE FUNCTION public.trusted_backfill_transaction_profit_costs(
  _internal_reference text,
  _provider_cost numeric DEFAULT NULL,
  _provider_commission numeric DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  updated boolean,
  already_complete boolean,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id uuid;
  v_status text;
  v_profit_id uuid;
  v_customer_amount numeric;
  v_provider_cost numeric;
  v_provider_commission numeric;
  v_profit numeric;
  v_new_cost numeric;
  v_new_commission numeric;
  v_new_profit numeric;
  v_changed boolean := false;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _internal_reference IS NULL OR btrim(_internal_reference) = '' THEN
    RAISE EXCEPTION 'missing_reference';
  END IF;

  IF _provider_cost IS NOT NULL AND _provider_cost < 0 THEN
    RAISE EXCEPTION 'invalid_provider_cost';
  END IF;
  IF _provider_commission IS NOT NULL AND _provider_commission < 0 THEN
    RAISE EXCEPTION 'invalid_provider_commission';
  END IF;

  SELECT bt.id, bt.status
    INTO v_bill_id, v_status
  FROM public.bill_transactions bt
  WHERE bt.internal_reference = btrim(_internal_reference)
  LIMIT 1;

  IF v_bill_id IS NULL THEN
    id := NULL;
    updated := false;
    already_complete := false;
    reason := 'bill_not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_status IS DISTINCT FROM 'successful' THEN
    id := NULL;
    updated := false;
    already_complete := false;
    reason := 'not_successful';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT
    tp.id,
    tp.customer_amount,
    tp.provider_cost,
    tp.provider_commission,
    tp.profit
  INTO
    v_profit_id,
    v_customer_amount,
    v_provider_cost,
    v_provider_commission,
    v_profit
  FROM public.transaction_profits tp
  WHERE tp.bill_transaction_id = v_bill_id
  LIMIT 1;

  -- Repair only: do not create a profit row when none exists
  IF v_profit_id IS NULL THEN
    id := NULL;
    updated := false;
    already_complete := false;
    reason := 'profit_row_missing';
    RETURN NEXT;
    RETURN;
  END IF;

  IF _provider_cost IS NULL AND _provider_commission IS NULL THEN
    id := v_profit_id;
    updated := false;
    already_complete := (v_provider_cost IS NOT NULL AND v_profit IS NOT NULL);
    reason := 'no_values_supplied';
    RETURN NEXT;
    RETURN;
  END IF;

  -- NULL-only fill for cost / commission
  v_new_cost := COALESCE(v_provider_cost, _provider_cost);
  v_new_commission := COALESCE(v_provider_commission, _provider_commission);

  -- Profit: never overwrite non-NULL; only fill when cost is known
  IF v_profit IS NOT NULL THEN
    v_new_profit := v_profit;
  ELSIF v_new_cost IS NOT NULL AND v_customer_amount IS NOT NULL THEN
    v_new_profit := round(v_customer_amount - v_new_cost, 2);
  ELSE
    v_new_profit := NULL;
  END IF;

  IF v_new_cost IS DISTINCT FROM v_provider_cost
     OR v_new_commission IS DISTINCT FROM v_provider_commission
     OR v_new_profit IS DISTINCT FROM v_profit THEN
    v_changed := true;
  END IF;

  IF NOT v_changed THEN
    id := v_profit_id;
    updated := false;
    already_complete := true;
    reason := 'already_complete';
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.transaction_profits tp
  SET
    provider_cost = v_new_cost,
    provider_commission = v_new_commission,
    profit = v_new_profit
  WHERE tp.id = v_profit_id
    AND (tp.provider_cost IS NULL OR v_new_cost IS NOT NULL)
    AND (tp.provider_commission IS NULL OR v_new_commission IS NOT NULL)
    AND (tp.profit IS NULL OR v_new_profit IS NOT NULL);

  id := v_profit_id;
  updated := true;
  already_complete := (v_new_cost IS NOT NULL AND v_new_profit IS NOT NULL);
  reason := 'updated';
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.trusted_backfill_transaction_profit_costs(text, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trusted_backfill_transaction_profit_costs(text, numeric, numeric)
  TO service_role;

COMMENT ON FUNCTION public.trusted_backfill_transaction_profit_costs(text, numeric, numeric) IS
  'NULL-only repair of provider_cost/provider_commission/profit on existing transaction_profits rows for successful bills. service_role only. Never invents values or overwrites non-NULL economics.';

NOTIFY pgrst, 'reload schema';
