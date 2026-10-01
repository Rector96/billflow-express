-- Corrective pricing seed for hub services.
--
-- The original hub seed was written against fixed_fee/percent_fee/active, while
-- Rockwavehub's real pricing_rules schema uses markup_type/markup_value/is_active.
-- This migration deliberately uses the existing shared schema so admin pricing,
-- getHubServiceFee(), and future provider pricing all read the same columns.
--
-- No price is changed here if an active rule already exists for the service.

INSERT INTO public.pricing_rules (
  service,
  provider,
  product_code,
  markup_type,
  markup_value,
  is_active,
  priority
)
SELECT v.service, NULL, NULL, 'selling_price', v.price, true, 0
FROM (VALUES
  ('tin', 1500::numeric),
  ('documents', 3000::numeric),
  ('vehicle', 2500::numeric),
  ('vehicle_license_sticker', 5000::numeric),
  ('vehicle_third_party_insurance', 15000::numeric),
  ('cac', 27500::numeric),
  ('nin_retrieve', 300::numeric),
  ('nin_slip', 500::numeric),
  ('nin_plastic_card', 2500::numeric),
  ('nin_courier', 0::numeric)
) AS v(service, price)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.pricing_rules pr
  WHERE pr.service = v.service
    AND pr.is_active = true
);

-- A zero courier amount is a valid temporary configuration but is intentionally
-- not treated as a customer-facing standalone price until logistics is connected.
COMMENT ON TABLE public.pricing_rules IS
  'Customer-facing pricing rules for bills and hub services. Hub fixed prices use markup_type=selling_price. Higher priority wins.';

NOTIFY pgrst, 'reload schema';
