# RockPay admin operations standard

## Support workflow

1. Search for the customer using the minimum account information required.
2. Confirm the correct customer record before discussing account-specific information.
3. Search the relevant transaction using transaction ID/provider request ID/customer/date.
4. Determine whether the issue is: funding, verification, provider processing, settlement, requery, refund, or display/history.
5. Never mark a transaction successful manually.
6. Never edit wallet balances directly as a normal support action.
7. For unresolved provider transactions, use the existing trusted/requery path and preserve the original provider request ID.
8. Record the support action and outcome in an auditable support trail.

## Required admin controls

- RBAC with explicit roles/permissions.
- Read-only customer/transaction investigation for support staff.
- Restricted financial/configuration actions for authorized operations staff.
- Server-side authorization for every privileged action; UI hiding is not security.
- Audit logging for customer-data access where required by policy, pricing changes, wallet/reconciliation actions, and privileged transaction actions.
- Pagination and bounded date ranges for all operational lists.
- Search indexes for high-volume customer and transaction lookup.
- No service-role credentials in browser code.
- No provider credentials, payment secrets, or sensitive authentication material in admin views.

## Incident categories

- Provider catalogue unavailable
- Customer verification failed
- Provider payment failed
- Provider payment pending/unknown
- Wallet funding initiated but not confirmed
- Wallet funding confirmed but balance mismatch
- Duplicate/idempotency conflict
- Settlement/profit reconciliation mismatch
- Customer-facing history/receipt issue

Every category should have a distinct operational state and recovery path.
