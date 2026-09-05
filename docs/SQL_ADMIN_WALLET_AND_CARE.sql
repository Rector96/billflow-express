-- Wallet freeze + pricing SELECT for admin UI (safe to re-run)

CREATE OR REPLACE FUNCTION public.admin_set_wallet_status(
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
  IF uid IS NULL OR NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT (public.has_role(uid, 'admin') OR public.has_role(uid, 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden_role';
  END IF;
  IF _status NOT IN ('active', 'frozen', 'closed') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT status INTO prev FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_not_found';
  END IF;

  UPDATE public.wallets SET status = _status WHERE user_id = _user_id;

  PERFORM public.admin_write_audit(
    CASE
      WHEN _status = 'frozen' THEN 'wallet_freeze'
      WHEN _status = 'active' THEN 'wallet_unfreeze'
      ELSE 'wallet_status'
    END,
    COALESCE(nullif(trim(_reason), ''), 'Wallet status → ' || _status),
    'wallet',
    _user_id::text,
    jsonb_build_object('from', prev, 'to', _status, 'reason', COALESCE(_reason, ''))
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_wallet_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_wallet_status(uuid, text, text) TO authenticated, service_role;

GRANT SELECT ON public.pricing_rules TO authenticated;

NOTIFY pgrst, 'reload schema';
