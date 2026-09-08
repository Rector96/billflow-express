# Phase 9 — Full Production Test & Failure Simulation

## Automated contracts

- Pricing fallback keeps customer amount equal to provider base when no verified rule exists.
- Active pricing cannot reduce the customer amount below provider base.
- Product-specific pricing outranks provider-level pricing.
- Inactive pricing cannot affect a transaction.
- Negative, NaN, and infinite amounts are rejected.
- VTpass code `000` is treated as successful even when content status is empty.
- Explicit successful provider content is treated as successful.
- Known pending provider responses remain pending.
- Unknown non-success provider responses are not treated as successful.

## Manual/provider verification still required

### Wallet funding
- successful Paystack funding credits exactly once;
- failed/abandoned funding does not credit the wallet;
- callback replay is idempotent;
- webhook replay is idempotent;
- amount/reference/currency mismatch is rejected.

### Bill services
- Airtime: success, failure, pending, requery, duplicate submission.
- Data: catalogue, plan selection, purchase, settlement, receipt.
- Electricity: meter verification, purchase, token/result, failure/pending recovery.
- Cable TV: customer verification, package selection, purchase, settlement.
- Education/exam PINs: successful and failed provider outcomes, with no generic payment bypass.

### Wallet and settlement
- insufficient balance cannot create a provider purchase;
- concurrent debit cannot overspend the wallet;
- successful provider outcome debits once;
- failed outcome refunds/reserves correctly;
- pending outcome remains recoverable;
- duplicate settlement does not double-debit or double-refund;
- successful transaction profit is recorded once.

### Administration and abuse
- staff can search customers and transactions server-side;
- transaction investigation links to the correct customer/Care record;
- reconciliation identifies wallet anomalies;
- repeated requests do not bypass idempotency;
- one customer cannot read or modify another customer's transaction/support data;
- forged references and transaction identifiers cannot settle payments.

## Release blocker

The customer payment UI still derives its displayed payment total locally from the selected variation/manual amount. The authoritative server pricing quote exists, but the UI is not yet wired to it. Non-zero pricing rules must remain disabled until the customer-visible amount and server debit amount are derived from the same server-side quote.

## Release rule

Do not merge Phase 9 into `main` or deploy production until the automated contracts pass and the provider/Paystack manual matrix has been executed with real test credentials, with transaction, wallet, settlement, and profit records verified in the database.