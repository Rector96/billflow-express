# RockPay Admin Operations Standard

The admin application is the operational workspace for authorized staff. It should make customer support and transaction investigation fast without giving ordinary support staff unrestricted financial power.

## Customer identification
Staff should locate customers using safe, non-secret account attributes and see account status, wallet balance and recent activity, recent transactions, pending/failed transactions, and support history. Never display passwords, authentication tokens, service-role credentials, PINs, card security data, or other secrets.

## Transaction investigation
A transaction detail view should provide a chronological lifecycle: customer/request creation, wallet debit or funding event, provider request ID, provider response, settlement attempt, final application status, requery state when applicable, and profit/accounting state. The UI must distinguish successful, failed, and pending from catalogue, verification, and provider-connectivity errors.

## Support safety
Support staff may investigate and document issues. They must not directly edit wallet balances, transaction financial amounts, provider request IDs, settlement outcomes, or profit records. Financial corrections must use controlled, auditable workflows.

## Roles
Recommended roles are Support, Operations, Finance, Pricing/Admin, and Super Admin. Privileged actions must be authorized server-side; hiding a button is not authorization.

## Audit trail
Sensitive admin actions should record actor, role, action, target entity, timestamp, result, and a safe metadata summary. Never record credentials, payment secrets, or raw authentication material.

## Provider truth
An unresolved provider transaction must never be manually marked successful merely because a customer reports success. Provider-backed settlement remains authoritative. If a customer was debited and confirmation is unresolved, staff should see the explicit pending state and supported requery/reconciliation path.

## Performance
Admin search must use server-side filtering, indexes, pagination, and bounded result sets. Do not load entire customer or transaction tables into the browser.
