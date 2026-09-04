-- Harden staff controls and bootstrap the requested superadmin identity.
ALTER TABLE public.admin_audit_logs
  ALTER COLUMN actor_user_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  _user_id uuid,
  _status text,
  _reason text DEFAULT ''
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prev text;
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid, 'super_admin') THEN
    RAISE EXCEPTION 'forbidden_role';
  END IF;
  IF _status NOT IN ('active', 'suspended', 'closed') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  IF _user_id = uid THEN
    RAISE EXCEPTION 'cannot_change_self';
  END IF;
  IF public.is_staff(_user_id) THEN
    RAISE EXCEPTION 'cannot_change_staff';
  END IF;

  SELECT account_status INTO prev
  FROM public.profiles
  WHERE user_id = _user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  UPDATE public.profiles SET account_status = _status WHERE user_id = _user_id;
  PERFORM public.admin_write_audit(
    CASE WHEN _status = 'active' THEN 'user_reactivate' ELSE 'user_suspend' END,
    COALESCE(nullif(trim(_reason), ''), 'Account status changed to ' || _status),
    'user', _user_id::text,
    jsonb_build_object('from', prev, 'to', _status, 'reason', COALESCE(_reason, ''))
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_account_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid, text, text) TO authenticated, service_role;

DO $$
DECLARE
  matched_user uuid;
  matched_count integer;
BEGIN
  SELECT count(*)::integer, min(id) INTO matched_count, matched_user
  FROM auth.users
  WHERE lower(email) = lower('peteroche32@gmail.com');

  IF matched_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (matched_user, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF matched_count > 1 THEN
    RAISE EXCEPTION 'Multiple Auth users match peteroche32@gmail.com; superadmin bootstrap aborted.';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
