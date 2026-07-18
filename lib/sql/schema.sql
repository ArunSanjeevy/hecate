-- Fresh-install schema for the Hecate experimentation backend.
-- This file defines the current database shape; it does not contain upgrade-only ALTER statements.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Dashboard users own experiments and SDK keys.
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- API keys are SDK credentials, not dashboard credentials. The key_type field also
-- supports the server-only compatibility/service key used by local development.
CREATE TABLE IF NOT EXISTS user_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    key_type TEXT NOT NULL DEFAULT 'sdk' CHECK (key_type IN ('sdk', 'service')),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);

-- Experiment keys remain globally unique because SDK event routes identify an
-- experiment by key. Ownership is enforced by the control-plane queries.
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    salt TEXT NOT NULL,
    variants JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_experiments_user_created_at ON experiments(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS exposure_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_key TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    UNIQUE(experiment_key, visitor_id, variant_key)
);

CREATE INDEX IF NOT EXISTS idx_exposure_events_visitor_exp
    ON exposure_events(visitor_id, experiment_key);

CREATE TABLE IF NOT EXISTS telemetry_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_key TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- One conversion per experiment, visitor, and conversion name is recorded.
CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_events_conversion_unique
    ON telemetry_events(event_type, event_name, experiment_key, visitor_id)
    WHERE event_type = 'conversion';

CREATE INDEX IF NOT EXISTS idx_telemetry_events_visitor_exp
    ON telemetry_events(visitor_id, experiment_key);
