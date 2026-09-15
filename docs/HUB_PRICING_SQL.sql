-- RockPay hub catalog fees — REAL pricing_rules schema
-- Columns: service, provider, product_code, markup_type, markup_value,
--          min_amount, max_amount, is_active, priority
-- Use selling_price so the fee is exactly markup_value (flat Naira).
-- Do NOT use fixed_fee / percent_fee / active — those columns do not exist.

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

-- Optional: inspect
-- SELECT service, markup_type, markup_value, is_active, priority
-- FROM public.pricing_rules
-- WHERE service IN ('tin','documents','nin_slip','vehicle_license_sticker')
-- ORDER BY service;
