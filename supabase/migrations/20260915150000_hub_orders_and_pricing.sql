-- Hub services: dedicated orders table + seed pricing_rules for TIN/vehicle/docs/CAC/NIN
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT).

CREATE TABLE IF NOT EXISTS public.hub_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'successful'
    CHECK (status IN ('pending', 'successful', 'failed')),
  payment_reference text NOT NULL,
  tracking_reference text,
  customer_identifier text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_orders_payment_ref
  ON public.hub_orders (payment_reference);

CREATE INDEX IF NOT EXISTS idx_hub_orders_user_created
  ON public.hub_orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hub_orders_service_status
  ON public.hub_orders (service, status);

ALTER TABLE public.hub_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_orders_select_own ON public.hub_orders;
CREATE POLICY hub_orders_select_own
  ON public.hub_orders FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS hub_orders_insert_service ON public.hub_orders;
CREATE POLICY hub_orders_insert_service
  ON public.hub_orders FOR INSERT
  WITH CHECK (true);

-- Service role inserts from server functions; staff can read all via is_staff.

-- Seed hub fixed fees into pricing_rules when the table exists.
-- Column names match existing admin pricing (service + fixed_fee + active).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pricing_rules'
  ) THEN
    INSERT INTO public.pricing_rules (service, fixed_fee, percent_fee, active)
    SELECT v.service, v.fixed_fee, 0, true
    FROM (VALUES
      ('tin', 1500::numeric),
      ('documents', 3000::numeric),
      ('vehicle', 2500::numeric),
      ('vehicle_license_sticker', 5000::numeric),
      ('vehicle_third_party_insurance', 15000::numeric),
      ('cac', 27500::numeric),
      ('nin_retrieve', 300::numeric),
      ('nin_slip', 500::numeric)
    ) AS v(service, fixed_fee)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pricing_rules pr
      WHERE pr.service = v.service AND coalesce(pr.active, true) = true
    );
  END IF;
EXCEPTION
  WHEN undefined_column OR undefined_table THEN
    RAISE NOTICE 'pricing_rules seed skipped — adjust columns to match your schema';
END $$;

NOTIFY pgrst, 'reload schema';
