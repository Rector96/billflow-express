-- Fail closed until these services have real provider-backed integrations.
CREATE OR REPLACE FUNCTION public.reject_unsupported_generic_bill()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  slug text := lower(trim(coalesce(NEW.metadata->>'service_slug', '')));
  service_name text := lower(trim(coalesce(NEW.service, '')));
BEGIN
  IF slug IN ('education', 'internet', 'water', 'insurance', 'exam-pins')
     OR service_name IN ('education', 'internet', 'water', 'insurance', 'exam pins') THEN
    RAISE EXCEPTION 'unsupported_service';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_unsupported_generic_bill ON public.bill_transactions;
CREATE TRIGGER trg_reject_unsupported_generic_bill
  BEFORE INSERT ON public.bill_transactions
  FOR EACH ROW EXECUTE FUNCTION public.reject_unsupported_generic_bill();

REVOKE ALL ON FUNCTION public.reject_unsupported_generic_bill() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';