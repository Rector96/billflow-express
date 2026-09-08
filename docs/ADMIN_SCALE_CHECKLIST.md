# RockPay Admin and Scale Checklist

Before production, verify these controls with evidence rather than assumptions.

- Server-side pagination on customer and transaction searches.
- Indexes for frequent customer, transaction, provider request ID, status, service, and timestamp filters.
- Bounded dashboard queries and date windows.
- Idempotent wallet credits and bill settlement.
- Safe provider retries and explicit pending/requery handling.
- Rate limiting on authentication, catalogue, verification, purchase, and support-sensitive endpoints.
- Server-side role authorization for every privileged admin action.
- Audit records for sensitive administrative actions.
- No secrets or payment credentials rendered to staff unnecessarily.
- Reconciliation checks for wallet ledger, bill transactions, provider settlement, and profit.
- Error monitoring and alerting for provider, database, wallet, and settlement failures.
- Database backup and restore verification.
- Load tests representing peak concurrent purchases and admin searches.
- Failure tests for duplicate requests, provider timeout, provider success after timeout, webhook/requery races, and database/RPC failure.
- Capacity testing toward at least 100,000 registered users with realistic transaction volumes.
- Production secrets separated from development/test secrets.
- Provider sandbox/live configuration verified before launch.
