-- ============================================================
-- RockPay hub fees — paste in Supabase SQL Editor (in order)
-- ============================================================
-- WHY previous inserts failed:
--   pricing_rules_service_check only allowed
--   airtime | data | cable | electricity
-- Step 1 expands the check. Step 2 seeds hub fees.

-- ---------- STEP 1: expand allowed services ----------
ALTER TABLE public.pricing_rules
  DROP CONSTRAINT IF EXISTS pricing_rules_service_check;

ALTER TABLE public.pricing_rules
  ADD CONSTRAINT pricing_rules_service_check
  CHECK (
    service IN (
      'airtime',
      'data',
      'cable',
      'electricity',
      'education',
      'exam-pins',
      'internet',
      'tin',
      'documents',
      'cac',
      'nin_retrieve',
      'nin_slip',
      'nin_card_print',
      'nin_plastic_card',
      'nin_courier',
      'vehicle',
      'vehicle_license_sticker',
      'vehicle_third_party_insurance'
    )
  );

-- ---------- STEP 2: seed hub catalog (selling_price = flat ₦ fee) ----------
INSERT INTO public.pricing_rules (
  service, provider, product_code, markup_type, markup_value,
  min_amount, max_amount, is_active, priority
)
SELECT v.service, NULL, NULL, 'selling_price', v.fee, NULL, NULL, true, 100
FROM (VALUES
  ('tin', 1500::numeric),
  ('documents', 3000::numeric),
  ('cac', 27500::numeric),
  ('nin_retrieve', 300::numeric),
  ('nin_slip', 500::numeric),
  ('nin_card_print', 2500::numeric),
  ('nin_plastic_card', 2500::numeric),
  ('nin_courier', 1500::numeric),
  ('vehicle', 2500::numeric),
  ('vehicle_license_sticker', 5000::numeric),
  ('vehicle_third_party_insurance', 15000::numeric)
) AS v(service, fee)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_rules pr
  WHERE pr.service = v.service
    AND pr.is_active = true
    AND pr.markup_type = 'selling_price'
);

-- ---------- optional verify ----------
-- SELECT service, markup_type, markup_value, is_active
-- FROM public.pricing_rules
-- WHERE service NOT IN ('airtime','data','cable','electricity')
-- ORDER BY service;
