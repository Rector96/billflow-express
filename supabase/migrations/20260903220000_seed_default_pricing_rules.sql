-- Default service-level pricing rules (safe fixed markups).
-- Idempotent: skips insert when an identical active service-level rule already exists.

INSERT INTO public.pricing_rules (
  service, provider, product_code, markup_type, markup_value, min_amount, max_amount, is_active, priority
)
SELECT v.service, NULL, NULL, 'fixed', v.markup_value, NULL, NULL, true, 0
FROM (VALUES
  ('airtime'::text, 5.00::numeric),
  ('data', 10.00),
  ('cable', 20.00),
  ('electricity', 25.00)
) AS v(service, markup_value)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.pricing_rules pr
  WHERE pr.service = v.service
    AND pr.provider IS NULL
    AND pr.product_code IS NULL
    AND pr.is_active = true
    AND pr.markup_type = 'fixed'
    AND pr.markup_value = v.markup_value
);
