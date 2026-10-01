-- Phase 8 security / abuse hardening.
-- Keep customer profile editing limited to non-security identity fields,
-- ensure customer Care tickets cannot be linked to another user's transaction,
-- and remove obsolete demo money-moving RPCs entirely.

-- Customers must never be able to change account_status, billpay_id, email,
-- user_id, timestamps, or other server-controlled profile fields.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone, avatar_url) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "update own profile" ON public.profiles;
CREATE POLICY "update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- A customer may create a Care ticket only for a transaction they own.
-- The existing policy already enforces ownership of the ticket itself; this
-- adds ownership of the optional transaction link as a second boundary.
DROP POLICY IF EXISTS "create own tickets" ON public.support_tickets;
CREATE POLICY "create own tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      transaction_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.bill_transactions bt
        WHERE bt.id = transaction_id
          AND bt.user_id = auth.uid()
      )
    )
  );

-- next_ticket_number is an internal helper used by the SECURITY DEFINER
-- create_care_ticket RPC. It is not a customer API surface.
REVOKE ALL ON FUNCTION public.next_ticket_number() FROM PUBLIC, anon, authenticated, service_role;

-- Demo funding/payment functions are no longer part of RockPay's payment
-- surface. Remove them instead of keeping disabled financial RPCs around.
DROP FUNCTION IF EXISTS public.demo_fund_wallet(numeric, text);
DROP FUNCTION IF EXISTS public.demo_bill_payment(text, text, text, numeric, text, public.tx_status, jsonb);

-- Internal PIN lock helper is not an API endpoint.
REVOKE ALL ON FUNCTION public._pin_is_locked(timestamptz) FROM PUBLIC, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
