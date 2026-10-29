-- Expand pricing_rules.service CHECK so hub products can store flat fees.
-- Original constraint only allowed: airtime, data, cable, electricity.

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

COMMENT ON CONSTRAINT pricing_rules_service_check ON public.pricing_rules IS
  'Bill services + hub catalog services for flat selling_price fees';
