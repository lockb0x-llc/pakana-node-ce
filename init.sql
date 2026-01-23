-- Pakana SQL Schema for Octo (YottaDB SQL Interface)

-- Account state table (hierarchical: ^Account(id, field))
-- Note: Octo maps to hierarchical globals with subscripts
CREATE TABLE accounts (
    id VARCHAR(64) PRIMARY KEY,
    balance BIGINT,
    seq_num BIGINT,
    last_modified BIGINT
) GLOBAL '^Account';

-- Ledger headers table
CREATE TABLE ledgers (
    sequence BIGINT PRIMARY KEY,
    closed_at VARCHAR(30)
) GLOBAL '^Stellar("ledger")';

-- Transaction records table (Phase 3)
-- Note: Octo requires PRIMARY KEY on individual columns, not as trailing constraint
CREATE TABLE stellar_txs (
    ledger_seq BIGINT PRIMARY KEY PIECE 1,
    tx_index INTEGER KEY NUM 1,
    xdr VARCHAR(10000),
    tx_hash VARCHAR(64)
) GLOBAL '^Stellar("ledger", keys("ledger_seq"), "tx", keys("tx_index"))';

-- Trustlines table (Phase 2)
-- Stores non-native asset balances per account
CREATE TABLE trustlines (
    account_id VARCHAR(64) PRIMARY KEY PIECE 1,
    asset_key VARCHAR(128) KEY NUM 1,
    balance BIGINT,
    trust_limit BIGINT
) GLOBAL '^Account(keys("account_id"), "trustlines", keys("asset_key"))';
