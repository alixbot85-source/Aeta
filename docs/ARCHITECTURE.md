# Architecture

Frontend never calculates authoritative balances, fills, fees or returns. Backend modules are bounded as `auth`, `users`, `kyc`, `wallet`, `ledger`, `assets`, `markets`, `trading`, `orders`, `investments`, `deposits`, `withdrawals`, `referrals`, `notifications`, `support`, `admin`, and `audit`.

## Financial writes
1. Validate schema, authorization, limits and idempotency key.
2. Begin PostgreSQL `SERIALIZABLE` transaction.
3. Lock balance rows with `SELECT ... FOR UPDATE`.
4. Create transaction and equal debit/credit ledger entries.
5. Derive and update cached balance; assert `total = available + locked`.
6. Add immutable audit record and transactional outbox event.
7. Commit. External side effects are handled idempotently by workers.

Never edit a ledger entry; reversal creates compensating entries. Admin balance adjustment uses maker/checker approval.

## Provider boundaries
MarketDataProvider, PaymentProvider, CustodyProvider and OrderExecutionProvider are interfaces. Their default state is `NOT_CONFIGURED`; no guessed provider or fabricated production response is used.

## Security
Argon2id/bcrypt password hashes, encrypted KYC fields, private file storage, RBAC, rate limiting, secure cookies, CSP/Helmet, validation, parameterized SQL, 2FA challenge for withdrawals, session revocation, alerts and immutable audit export are required. Production keys belong in a secrets manager.