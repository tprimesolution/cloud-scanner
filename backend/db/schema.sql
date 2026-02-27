-- Cloud Infrastructure Compliance Scanner - Database Schema
-- Single-account, EC2 IAM role auth

CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    resource_id VARCHAR(512) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    region VARCHAR(64),
    account_id VARCHAR(32),
    raw_metadata JSONB NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(resource_id, resource_type)
);

CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_region ON resources(region);
CREATE INDEX IF NOT EXISTS idx_resources_collected ON resources(collected_at);

CREATE TABLE IF NOT EXISTS resource_metadata (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    key VARCHAR(128) NOT NULL,
    value TEXT,
    UNIQUE(resource_id, key)
);

CREATE TABLE IF NOT EXISTS scan_history (
    id SERIAL PRIMARY KEY,
    scan_type VARCHAR(32) NOT NULL,
    phase VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    resource_count INTEGER DEFAULT 0,
    finding_count INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scan_history_started ON scan_history(started_at DESC);

CREATE TABLE IF NOT EXISTS compliance_rules (
    id SERIAL PRIMARY KEY,
    rule_id VARCHAR(128) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL,
    compliance_mappings JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_rules_type ON compliance_rules(resource_type);

CREATE TABLE IF NOT EXISTS findings (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    rule_id INTEGER NOT NULL REFERENCES compliance_rules(id) ON DELETE CASCADE,
    severity VARCHAR(32) NOT NULL,
    status VARCHAR(32) DEFAULT 'open',
    message TEXT,
    remediation TEXT,
    raw_context JSONB,
    scan_id INTEGER REFERENCES scan_history(id) ON DELETE SET NULL,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(resource_id, rule_id)
);

CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_scan ON findings(scan_id);
