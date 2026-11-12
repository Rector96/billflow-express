-- Restrict service availability changes to platform administrators.
-- Support/customer-care staff may inspect the catalogue but cannot disable live services.

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
  previous_enabled boolean;
  normalized_slug text := lower(trim(coalesce(_service_slug, '')));
BEGIN
  IF uid IS NULL OR NOT (
    public.has_role(uid, 'admin') OR public.has_role(uid, 'super_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden_role';
  END IF;

  IF normalized_slug NOT IN
    ('airtime', 'data', 'electricity', 'cable', 'education', 'exam-pins') THEN
    RAISE EXCEPTION 'unsupported_service';
  END IF;
  IF _enabled IS NULL THEN
    RAISE EXCEPTION 'enabled_value_required';
  END IF;

  SELECT is_enabled INTO previous_enabled
  FROM public.service_availability
  WHERE service_slug = normalized_slug
  FOR UPDATE;

  INSERT INTO public.service_availability (service_slug, is_enabled, updated_at, updated_by)
  VALUES (normalized_slug, _enabled, now(), uid)
  ON CONFLICT (service_slug) DO UPDATE
    SET is_enabled = EXCLUDED.is_enabled,
        updated_at = now(),
        updated_by = uid
  RETURNING * INTO result;

  PERFORM public.admin_write_audit(
    'service_availability_changed',
    'Service availability changed: ' || normalized_slug,
    'service',
    normalized_slug,
    jsonb_build_object(
      'from', previous_enabled,
      'to', _enabled
    )
  );

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_service_availability(text, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_service_availability(text, boolean)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
