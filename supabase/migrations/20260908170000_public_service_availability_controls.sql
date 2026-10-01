-- Admin-controlled public availability for customer-facing services.
-- This is intentionally service-level first; VTpass provider/catalogue data remains dynamic.

CREATE TABLE IF NOT EXISTS public.service_availability (
  service_slug text PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.service_availability (service_slug, is_enabled)
VALUES
  ('airtime', true),
  ('data', true),
  ('electricity', true),
  ('cable', true),
  ('education', false),
  ('exam-pins', false)
ON CONFLICT (service_slug) DO NOTHING;

ALTER TABLE public.service_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service availability readable" ON public.service_availability;
CREATE POLICY "service availability readable"
  ON public.service_availability
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.admin_set_service_availability(
  _service_slug text,
  _enabled boolean
)
RETURNS public.service_availability
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  result public.service_availability;
BEGIN
  IF uid IS NULL OR NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF lower(trim(_service_slug)) NOT IN
    ('airtime', 'data', 'electricity', 'cable', 'education', 'exam-pins') THEN
    RAISE EXCEPTION 'unsupported_service';
  END IF;

  INSERT INTO public.service_availability (service_slug, is_enabled, updated_at, updated_by)
  VALUES (lower(trim(_service_slug)), _enabled, now(), uid)
  ON CONFLICT (service_slug) DO UPDATE
    SET is_enabled = EXCLUDED.is_enabled,
        updated_at = now(),
        updated_by = uid
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_service_availability(text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_service_availability(text, boolean)
  TO authenticated, service_role;

-- Defense in depth: a disabled service cannot create a new bill transaction even if
-- someone bypasses the customer UI and calls the purchase RPC directly.
CREATE OR REPLACE FUNCTION public.enforce_service_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  slug text;
  enabled boolean;
BEGIN
  slug := lower(trim(coalesce(NEW.metadata->>'service_slug', '')));
  IF slug = '' THEN
    slug := lower(trim(coalesce(NEW.service, '')));
  END IF;

  IF slug = '' THEN
    RETURN NEW;
  END IF;

  SELECT sa.is_enabled INTO enabled
  FROM public.service_availability sa
  WHERE sa.service_slug = slug;

  IF enabled IS FALSE THEN
    RAISE EXCEPTION 'service_disabled';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_service_availability ON public.bill_transactions;
CREATE TRIGGER trg_enforce_service_availability
BEFORE INSERT ON public.bill_transactions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_service_availability();

REVOKE ALL ON FUNCTION public.enforce_service_availability() FROM PUBLIC;

CREATE INDEX IF NOT EXISTS idx_service_availability_enabled
  ON public.service_availability (is_enabled, service_slug);

NOTIFY pgrst, 'reload schema';
