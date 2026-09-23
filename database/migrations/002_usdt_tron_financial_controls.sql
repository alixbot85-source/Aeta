-- Restrict current product scope to USDT on TRON while preserving extensible asset tables.
BEGIN;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS approval_count SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS required_approvals SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS risk_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE wallet_balances ADD COLUMN IF NOT EXISTS pending NUMERIC(38,18) NOT NULL DEFAULT 0;
ALTER TABLE wallet_balances ADD COLUMN IF NOT EXISTS invested NUMERIC(38,18) NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS uq_deposits_idempotency ON deposits(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_withdrawals_idempotency ON withdrawals(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_deposits_network_txid ON deposits(network,external_tx_id) WHERE external_tx_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS withdrawal_approvals(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),withdrawal_id UUID NOT NULL REFERENCES withdrawals,admin_id UUID NOT NULL REFERENCES users,decision TEXT NOT NULL CHECK(decision IN('APPROVE','REJECT')),note TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(withdrawal_id,admin_id));
CREATE TABLE IF NOT EXISTS wallet_addresses(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),wallet_id UUID NOT NULL REFERENCES wallets,asset_id UUID NOT NULL REFERENCES assets,network TEXT NOT NULL CHECK(network='TRON'),address TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'ACTIVE',encrypted_private_key BYTEA,created_by UUID REFERENCES users,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(network,address));
CREATE TABLE IF NOT EXISTS balance_adjustment_requests(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),wallet_id UUID NOT NULL REFERENCES wallets,asset_id UUID NOT NULL REFERENCES assets,amount NUMERIC(38,18) NOT NULL CHECK(amount<>0),reason TEXT NOT NULL,source TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'PENDING',requested_by UUID NOT NULL REFERENCES users,approved_by UUID REFERENCES users,ledger_transaction_id UUID UNIQUE,created_at TIMESTAMPTZ DEFAULT now(),approved_at TIMESTAMPTZ);
-- Production services must additionally verify the referenced asset symbol is USDT.
COMMIT;
