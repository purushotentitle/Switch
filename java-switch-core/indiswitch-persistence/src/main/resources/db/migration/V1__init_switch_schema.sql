-- PostgreSQL 16 Production Switch Schema & Financial Double-Entry Ledger
-- NUMERIC(15,2) for all financial currency amounts

CREATE TABLE IF NOT EXISTS merchants (
    merchant_id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    vpa VARCHAR(128) NOT NULL,
    mcc VARCHAR(4) NOT NULL,
    account_number VARCHAR(34) NOT NULL,
    ifsc_code VARCHAR(11) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    rrn VARCHAR(12) PRIMARY KEY,
    stan VARCHAR(6) NOT NULL,
    mti VARCHAR(4) NOT NULL,
    processing_code VARCHAR(6) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    merchant_id VARCHAR(32) REFERENCES merchants(merchant_id),
    terminal_id VARCHAR(16) NOT NULL,
    masked_pan VARCHAR(24),
    card_brand VARCHAR(32) NOT NULL,
    auth_code VARCHAR(6),
    response_code VARCHAR(2) NOT NULL,
    status VARCHAR(32) NOT NULL,
    mdr_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    gst_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    net_payout NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    fraud_score INT DEFAULT 0,
    emv_arqc VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settlement_batches (
    batch_id VARCHAR(64) PRIMARY KEY,
    run_date DATE NOT NULL,
    total_txns INT NOT NULL,
    matched_txns INT NOT NULL,
    matched_volume NUMERIC(15,2) NOT NULL,
    status VARCHAR(32) NOT NULL,
    ttum_payload TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kafka_transactional_outbox (
    id UUID PRIMARY KEY,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_transactions_stan ON transactions(stan);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed ON kafka_transactional_outbox(processed) WHERE processed = FALSE;
