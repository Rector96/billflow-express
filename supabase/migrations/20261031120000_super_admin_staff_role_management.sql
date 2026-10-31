-- Owner-only staff role management. Super Admin itself can only be bootstrapped through controlled SQL.
CREATE OR REPLACE FUNCTION public.admin_grant_staff_role(_email text, _role text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); target_id uuid; matches integer; normalized_email text := lower(trim(COALESCE(_email, '')));
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid, 'super_admin') THEN RAISE EXCEPTION 'forbidden_role'; END IF;
  IF _role NOT IN ('admin', 'support') THEN RAISE EXCEPTION 'invalid_staff_role'; END IF;
  IF normalized_email = '' OR normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
  SELECT count(*)::integer, min(id) INTO matches, target_id FROM auth.users WHERE lower(email) = normalized_email;
  IF matches = 0 THEN RAISE EXCEPTION 'account_not_found'; END IF;
  IF matches > 1 THEN RAISE EXCEPTION 'ambiguous_account'; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (target_id, _role::public.app_role) ON CONFLICT (user_id, role) DO NOTHING;
  PERFORM public.admin_write_audit('staff_role_granted', 'Granted ' || _role || ' role to ' || normalized_email, 'user', target_id::text, jsonb_build_object('role', _role, 'email', normalized_email));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_staff_role(_user_id uuid, _role text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); removed integer;
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid, 'super_admin') THEN RAISE EXCEPTION 'forbidden_role'; END IF;
  IF _role NOT IN ('admin', 'support') THEN RAISE EXCEPTION 'invalid_staff_role'; END IF;
  IF _user_id = uid THEN RAISE EXCEPTION 'cannot_change_self'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role::public.app_role;
  GET DIAGNOSTICS removed = ROW_COUNT;
  IF removed = 0 THEN RAISE EXCEPTION 'staff_role_not_found'; END IF;
  PERFORM public.admin_write_audit('staff_role_removed', 'Removed ' || _role || ' role', 'user', _user_id::text, jsonb_build_object('role', _role));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_staff_role(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_remove_staff_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_staff_role(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_remove_staff_role(uuid, text) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
