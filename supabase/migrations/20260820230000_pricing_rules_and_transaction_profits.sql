-- RockPay Pricing Engine
-- ADDITIVE only. Does not alter existing bill_transactions semantics,
-- wallet RPCs, or payment flows.
-- bill_transactions.amount continues to mean "amount charged to customer".

-- ---------------------------------------------------------------------------
-- 1. pricing_rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service         text NOT NULL
                    CHECK (service IN ('airtime', 'data', 'cable', 'electricity')),
  provider        text NULL,                 -- e.g. 'mtn', 'dstv', 'ikeja-electric'
  product_code    text NULL,                 -- variation_code / plan code
  markup_type     text NOT NULL
                    CHECK (markup_type IN ('fixed', 'percentage', 'selling_price')),
  markup_value    numeric(14, 2) NOT NULL
                    CHECK (markup_value >= 0),
  min_amount      numeric(14, 2) NULL
                    CHECK (min_amount IS NULL OR min_amount >= 0),
  max_amount      numeric(14, 2) NULL
                    CHECK (max_amount IS NULL OR max_amount >= 0),
  is_active       boolean NOT NULL DEFAULT true,
  priority        integer NOT NULL DEFAULT 0, -- higher wins when multiple match
  created_by      uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pricing_rules_min_max_ok
    CHECK (min_amount IS NULL OR max_amount IS NULL OR min_amount <= max_amount)
);

-- Helpful indexes for rule matching
CREATE INDEX IF NOT EXISTS idx_pricing_rules_lookup
  ON public.pricing_rules (service, provider, product_code, is_active, priority DESC);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_service_active
  ON public.pricing_rules (service, is_active)
  WHERE is_active = true;

COMMENT ON TABLE public.pricing_rules IS
  'RockPay customer-facing pricing rules. Matching order: product > provider+service > service default. Higher priority wins.';

COMMENT ON COLUMN public.pricing_rules.markup_type IS
  'fixed = add NGN; percentage = add % of base; selling_price = force exact customer price';

COMMENT ON COLUMN public.pricing_rules.priority IS
  'Higher number wins when multiple rules otherwise match the same specificity level';

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_pricing_rules_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pricing_rules_updated_at ON public.pricing_rules;
CREATE TRIGGER trg_pricing_rules_updated_at
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pricing_rules_updated_at();

-- ---------------------------------------------------------------------------
-- 2. transaction_profits
-- ---------------------------------------------------------------------------
-- SECURITY NOTE:
-- All future writes to this table MUST happen through the trusted server-side
-- transaction flow or a SECURITY DEFINER helper.
-- Never accept client-supplied financial values (customer_amount, provider_cost,
-- provider_commission, rockpay_fee, profit, or pricing_rule_id).
-- Those values must be derived only from backend pricing rules and (when
-- available) the real VTpass/provider response.
CREATE TABLE IF NOT EXISTS public.transaction_profits (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_transaction_id   uuid NOT NULL
                          REFERENCES public.bill_transactions (id) ON DELETE CASCADE,
  customer_amount       numeric(14, 2) NOT NULL
                          CHECK (customer_amount >= 0),
  provider_cost         numeric(14, 2) NULL
                          CHECK (provider_cost IS NULL OR provider_cost >= 0),
  provider_commission   numeric(14, 2) NULL
                          CHECK (provider_commission IS NULL OR provider_commission >= 0),
  rockpay_fee           numeric(14, 2) NULL
                          CHECK (rockpay_fee IS NULL OR rockpay_fee >= 0),
  profit                numeric(14, 2) NULL,
  pricing_rule_id       uuid NULL
                          REFERENCES public.pricing_rules (id) ON DELETE SET NULL,
  currency              text NOT NULL DEFAULT 'NGN',
  calculated_at         timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT transaction_profits_one_per_bill
    UNIQUE (bill_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_profits_bill
  ON public.transaction_profits (bill_transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_profits_rule
  ON public.transaction_profits (pricing_rule_id)
  WHERE pricing_rule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_profits_calculated
  ON public.transaction_profits (calculated_at DESC);

COMMENT ON TABLE public.transaction_profits IS
  'Financial breakdown for a bill transaction. Writes only via trusted server-side flow / SECURITY DEFINER. Never accept client-supplied financial values.';

COMMENT ON COLUMN public.transaction_profits.customer_amount IS
  'Amount actually charged to the customer (matches bill_transactions.amount).';

COMMENT ON COLUMN public.transaction_profits.provider_cost IS
  'Actual effective VTpass/provider cost. NULL until reliably known. Never invent.';

COMMENT ON COLUMN public.transaction_profits.provider_commission IS
  'Commission or discount returned by the provider. NULL unless actually returned. Never invent.';

COMMENT ON COLUMN public.transaction_profits.rockpay_fee IS
  'RockPay markup/convenience fee charged to the customer because of the pricing rule (e.g. +₦10). Separate from provider_commission.';

COMMENT ON COLUMN public.transaction_profits.profit IS
  'customer_amount - provider_cost, only when provider_cost is reliably known. Never infer from markup alone. NULL until then.';

COMMENT ON COLUMN public.transaction_profits.pricing_rule_id IS
  'Rule that produced the customer-facing price, if any. NULL when fallback (zero markup) was used.';

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_profits ENABLE ROW LEVEL SECURITY;

-- pricing_rules: staff can read; only admin/super_admin can write
-- has_role signature: has_role(_user_id uuid, _role public.app_role)
DROP POLICY IF EXISTS pricing_rules_staff_select ON public.pricing_rules;
CREATE POLICY pricing_rules_staff_select
  ON public.pricing_rules
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS pricing_rules_admin_insert ON public.pricing_rules;
CREATE POLICY pricing_rules_admin_insert
  ON public.pricing_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS pricing_rules_admin_update ON public.pricing_rules;
CREATE POLICY pricing_rules_admin_update
  ON public.pricing_rules
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS pricing_rules_admin_delete ON public.pricing_rules;
CREATE POLICY pricing_rules_admin_delete
  ON public.pricing_rules
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- transaction_profits: staff can read only.
-- No INSERT / UPDATE / DELETE policies for authenticated =
-- clients cannot write. Future writes must go through trusted
-- server-side transaction flow or SECURITY DEFINER helpers and
-- must never accept client-supplied financial values.
DROP POLICY IF EXISTS transaction_profits_staff_select ON public.transaction_profits;
CREATE POLICY transaction_profits_staff_select
  ON public.transaction_profits
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Grants
GRANT SELECT ON public.pricing_rules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;

GRANT SELECT ON public.transaction_profits TO authenticated;
-- No INSERT/UPDATE/DELETE grant to authenticated for transaction_profits

NOTIFY pgrst, 'reload schema';
