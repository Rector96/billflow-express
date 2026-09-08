-- Accelerate staff-facing wildcard searches as customer and transaction volume grows.
-- pg_trgm is a standard PostgreSQL extension supported by Supabase.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm
  ON public.profiles USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm
  ON public.profiles USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_phone_trgm
  ON public.profiles USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_bill_transactions_reference_trgm
  ON public.bill_transactions USING gin (internal_reference gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_bill_transactions_provider_request_trgm
  ON public.bill_transactions USING gin (provider_request_id gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_bill_transactions_provider_transaction_trgm
  ON public.bill_transactions USING gin (provider_transaction_id gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_bill_transactions_customer_identifier_trgm
  ON public.bill_transactions USING gin (customer_identifier gin_trgm_ops);

NOTIFY pgrst, 'reload schema';
