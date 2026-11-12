-- Restrict cross-customer financial/profile/audit reads to Admin and Super Admin.
-- Customer Care retains ticket workflow access and receives contact details only
-- for the customer attached to the ticket being handled.

DROP POLICY IF EXISTS "read own ledger" ON public.wallet_transactions;
CREATE POLICY "read own ledger"
ON public.wallet_transactions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

DROP POLICY IF EXISTS "read own bill tx" ON public.bill_transactions;
CREATE POLICY "read own bill tx"
ON public.bill_transactions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- Replace both permissive profile SELECT policies. Customers retain own-profile
-- access; Admin and Super Admin retain cross-customer profile access.
DROP POLICY IF EXISTS "read own profile" ON public.profiles;
DROP POLICY IF EXISTS "staff read profiles" ON public.profiles;
CREATE POLICY "read own profile or admin profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

DROP POLICY IF EXISTS "staff read audit logs" ON public.admin_audit_logs;
CREATE POLICY "admin read audit logs"
ON public.admin_audit_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- Narrow customer contact lookup for a specific support ticket.
CREATE OR REPLACE FUNCTION public.admin_care_customer_contact(_ticket_id uuid)
RETURNS TABLE (
  full_name text,
  email text,
  phone text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.is_staff(uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT p.full_name::text, p.email::text, p.phone::text
  FROM public.support_tickets t
  JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.id = _ticket_id
  LIMIT 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_care_customer_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_care_customer_contact(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
