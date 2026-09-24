# Production Deployment

1. Provision PostgreSQL 16, Redis, private object storage, queue workers and TLS ingress.
2. Copy `.env.example` into a secrets manager; replace every placeholder with generated secrets.
3. Set `DEMO_MODE=false` only after audited market/payment/custody providers are configured.
4. Apply SQL migrations with a restricted migration role.
5. Run `npm ci && npm run build`; serve frontend assets through CDN and run backend with multiple health-checked replicas.
6. Enforce HTTPS, secure cookies, CSP, WAF/rate limits, database backups/PITR and centralized redacted logs.
7. Run API, ledger invariant, reconciliation, penetration and disaster-recovery tests before accepting funds.

Do not enable deposits, withdrawals, orders, or investment returns until regulatory, compliance and provider controls are approved.