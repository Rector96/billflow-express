# 100k-user admin scale checklist

Before production launch, verify with evidence:

- Customer lookup uses indexed, bounded queries and pagination.
- Transaction lookup uses indexed transaction/provider/customer/date fields.
- No admin page loads an unbounded transaction or customer table.
- Counts use database aggregates rather than downloading all rows.
- Date filters are bounded and use UTC consistently.
- Repeated provider calls are protected by timeouts and safe retry/requery semantics.
- Financial mutations are idempotent and server-authorized.
- Provider settlement failures cannot silently become successful payments.
- Wallet credit/debit operations are atomic at the database boundary.
- Profit writes are idempotent and tied to successful provider-backed transactions.
- Rate limits and abuse controls exist on customer-facing payment and authentication surfaces.
- Admin actions are audited.
- Error messages do not leak provider credentials, service-role data, SQL details, or unnecessary PII.
- Observability includes error tracking, structured logs, provider latency/failure metrics, payment-state metrics, and reconciliation alerts.
- Load testing covers at least the expected production concurrency and transaction burst profile, not only 100k registered-user count.
- Database backups, restore testing, migration rollback/recovery procedures, and provider incident procedures are documented.

100,000 users is a capacity target, not a guarantee. The application should be declared production-ready only after these controls are measured and verified in the actual deployment environment.
