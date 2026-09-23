# API v1
Base URL: `/api` · JSON responses use `{ data, meta }`; errors use `{ error: { code, message, details? } }`.

## Public
- `GET /health` — health, mode and provider status
- `POST /auth/register` — `{ email, password }` (password minimum 12 chars)
- `POST /auth/login` — secure HttpOnly access cookie

## Authenticated
- `GET /wallets` — wallet and exact decimal balances
- `GET /transactions`
- `GET /orders`
- `POST /orders` — disabled until execution engine is configured
- `GET /investments`
- `POST /deposits` — disabled until payment provider configuration
- `POST /withdrawals` — disabled until provider + 2FA workflow configuration

## Market
- `GET /markets` — returns an empty list and `provider: NOT_CONFIGURED` unless a trusted source is connected

## Admin
- `GET /audit` — requires ADMIN role

Authentication uses a 15-minute signed token in an HttpOnly, SameSite cookie. Production integration must add rotating opaque refresh tokens stored hashed in `sessions`, CSRF double-submit tokens, and token-family reuse detection.