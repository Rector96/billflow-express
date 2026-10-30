-- Lock hub order writes to trusted server-side code only.
-- The original INSERT policy used WITH CHECK (true), which allowed any
-- authenticated customer to create arbitrary hub_orders rows through the API.

DROP POLICY IF EXISTS hub_orders_insert_service ON public.hub_orders;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.hub_orders
  FROM anon, authenticated;

-- Customers and staff retain the existing RLS-governed read access.
GRANT SELECT ON TABLE public.hub_orders TO authenticated;

-- service_role continues to write through trusted server functions and
-- webhook handlers (it bypasses RLS and retains its Supabase service grants).

NOTIFY pgrst, 'reload schema';
