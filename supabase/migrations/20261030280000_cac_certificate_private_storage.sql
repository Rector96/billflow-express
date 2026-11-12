-- Private storage for completed CAC certificates.
-- Upload/download URLs are minted only by authenticated server functions.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cac-certificates',
  'cac-certificates',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf'];

-- No client policies are granted on this bucket. Server functions use the
-- service role after checking staff permissions, order ownership and payment.
