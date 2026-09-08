-- RockPay pricing/profit hardening.
--
-- Goals:
-- 1. Never allow an unverified pricing rule to become active.
-- 2. Preserve the real VTpass economics returned by successful transactions.
-- 3. Keep provider commission/discount separate from RockPay markup.
-- 4. Compute profit only from an actual provider cost when VTpass returned it.
--
-- No pricing rates are seeded here. Current provider economics must be verified
-- against the live VTpass account/response before a rule is activated.

ALTER TABLE public.pricing_rules
  ADD COLUMN IF NOT EXISTS economics_source text NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS verified_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pricing_rules.economics_source IS
  'Evidence/source used to verify the pricing economics before activation (for example VTpass API response/commission data).';
COMMENT ON COLUMN public.pricing_rules.verified_at IS
  'Timestamp when the rule economics were explicitly verified.';
COMMENT ON COLUMN public.pricing_rules.verified_by IS
  'Staff user who verified the rule economics.';

-- Existing active rules without verification are unsafe to charge against.
UPDATE public.pricing_rules
SET is_active = false,
    updated_at = now()
WHERE is_active = true
  AND (verified_at IS NULL OR nullif(btrim(economics_source), '') IS NULL);

CREATE OR REPLACE FUNCTION public.enforce_pricing_rule_verification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_active = true THEN
    IF NEW.verified_at IS NULL OR nullif(btrim(NEW.economics_source), '') IS NULL THEN
      RAISE EXCEPTION 'pricing_rule_not_verified';
    END IF;
    IF NEW.markup_value < 0 THEN
      RAISE EXCEPTION 'invalid_markup_value';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pricing_rule_verification ON public.pricing_rules;
CREATE TRIGGER trg_enforce_pricing_rule_verification
  BEFORE INSERT OR UPDATE ON public.pricing_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pricing_rule_verification();

-- Rebuild the trusted profit writer so provider economics can be derived from
-- the server-written VTpass snapshot when callers do not already supply them.
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
  v_meta jsonb;
  v_snapshot jsonb;
  v_tx jsonb;
  v_provider_cost numeric;
  v_provider_commission numeric;
  v_rockpay_fee numeric;
  v_profit numeric;
  v_rule_id uuid;
  v_provider_amount numeric;
BEGIN
  IF _internal_reference IS NULL OR btrim(_internal_reference) = '' THEN
    RAISE EXCEPTION 'missing_reference';
  END IF;
  IF _customer_amount IS NULL OR _customer_amount < 0 THEN
    RAISE EXCEPTION 'invalid_customer_amount';
  END IF;

  SELECT bt.id, bt.status, coalesce(bt.metadata, '{}'::jsonb)
    INTO v_bill_id, v_status, v_meta
  FROM public.bill_transactions bt
  WHERE bt.internal_reference = btrim(_internal_reference)
  LIMIT 1;

  IF v_bill_id IS NULL THEN
    RAISE EXCEPTION 'bill_not_found';
  END IF;

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

  -- The settlement path stores the raw VTpass response under
  -- metadata.vtpass_snapshot. VTpass documents content.transactions.total_amount
  -- as the amount charged by VTpass and commission_details.amount as the actual
  -- commission/discount returned for that transaction.
  v_snapshot := CASE
    WHEN jsonb_typeof(v_meta -> 'vtpass_snapshot') = 'object'
      THEN v_meta -> 'vtpass_snapshot'
    ELSE '{}'::jsonb
  END;
  v_tx := CASE
    WHEN jsonb_typeof(v_snapshot -> 'content' -> 'transactions') = 'object'
      THEN v_snapshot -> 'content' -> 'transactions'
    ELSE '{}'::jsonb
  END;

  v_provider_cost := coalesce(
    _provider_cost,
    nullif(v_tx ->> 'total_amount', '')::numeric
  );
  v_provider_commission := coalesce(
    _provider_commission,
    nullif(v_tx -> 'commission_details' ->> 'amount', '')::numeric,
    nullif(v_tx ->> 'commission', '')::numeric
  );
  v_rockpay_fee := coalesce(
    _rockpay_fee,
    nullif(v_meta ->> 'rockpay_fee', '')::numeric
  );
  v_rule_id := coalesce(
    _pricing_rule_id,
    nullif(v_meta ->> 'pricing_rule_id', '')::uuid
  );
  v_provider_amount := coalesce(
    _provider_amount,
    nullif(v_meta ->> 'provider_amount', '')::numeric,
    nullif(v_snapshot ->> 'amount', '')::numeric
  );

  -- If the provider returned an effective cost, it is the authoritative basis
  -- for profit. Never infer profit from markup/commission alone.
  v_profit := CASE
    WHEN v_provider_cost IS NOT NULL
      THEN round(_customer_amount - v_provider_cost, 2)
    ELSE _profit
  END;

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
    round(_customer_amount, 2),
    v_provider_cost,
    v_provider_commission,
    v_rockpay_fee,
    v_profit,
    v_rule_id
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

REVOKE ALL ON FUNCTION public.record_transaction_profit(text, numeric, numeric, numeric, numeric, numeric, uuid, text, text, text, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_transaction_profit(text, numeric, numeric, numeric, numeric, numeric, uuid, text, text, text, numeric)
  TO service_role;

-- Staff-only economics summary for the existing Admin Pricing area.
-- This is observational only: it never changes prices.
CREATE OR REPLACE FUNCTION public.admin_pricing_economics_summary()
RETURNS TABLE (
  service text,
  provider text,
  transaction_count bigint,
  observed_customer_amount numeric,
  observed_provider_cost numeric,
  observed_provider_commission numeric,
  observed_profit numeric,
  last_observed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    bt.service,
    coalesce(bt.provider, '') AS provider,
    count(*)::bigint AS transaction_count,
    round(sum(tp.customer_amount), 2),
    round(sum(coalesce(tp.provider_cost, 0)), 2),
    round(sum(coalesce(tp.provider_commission, 0)), 2),
    round(sum(coalesce(tp.profit, 0)), 2),
    max(tp.calculated_at)
  FROM public.transaction_profits tp
  JOIN public.bill_transactions bt ON bt.id = tp.bill_transaction_id
  GROUP BY bt.service, bt.provider
  ORDER BY max(tp.calculated_at) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_pricing_economics_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_pricing_economics_summary() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
