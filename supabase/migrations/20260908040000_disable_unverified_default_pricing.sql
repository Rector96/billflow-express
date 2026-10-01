-- These historical defaults were not based on verified provider economics.
-- Keep pricing server-side, but do not charge customers an invented markup.
UPDATE public.pricing_rules
SET is_active = false
WHERE provider IS NULL
  AND product_code IS NULL
  AND priority = 0
  AND markup_type = 'fixed'
  AND (
    (service = 'airtime' AND markup_value = 5)
    OR (service = 'data' AND markup_value = 10)
    OR (service = 'cable' AND markup_value = 20)
    OR (service = 'electricity' AND markup_value = 25)
  );

NOTIFY pgrst, 'reload schema';
