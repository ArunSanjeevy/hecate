-- Fresh-install schema for the Hecate experimentation backend.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Dashboard users own experiments and SDK keys.
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- API keys are SDK credentials, not dashboard credentials. The key_type field also
-- supports the server-only compatibility/service key used by local development.
CREATE TABLE IF NOT EXISTS user_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_key_prefix TEXT NOT NULL,
    api_key_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    key_type TEXT NOT NULL DEFAULT 'sdk' CHECK (key_type IN ('sdk', 'service')),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_api_keys_hash ON user_api_keys(api_key_hash);

-- Experiment keys are unique within a tenant/user. SDK event routes identify
-- an experiment by key plus the authenticated API key's owner.
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    status TEXT NOT NULL,
    variants JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_experiments_user_created_at ON experiments(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS exposure_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    experiment_key TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id, experiment_key) REFERENCES experiments(user_id, key) ON DELETE CASCADE,
    UNIQUE(user_id, experiment_key, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_exposure_events_visitor_exp
    ON exposure_events(user_id, visitor_id, experiment_key);

CREATE TABLE IF NOT EXISTS telemetry_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    experiment_key TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id, experiment_key) REFERENCES experiments(user_id, key) ON DELETE CASCADE
);

-- One conversion per experiment, visitor, and conversion name is recorded.
CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_events_conversion_unique
    ON telemetry_events(user_id, event_type, event_name, experiment_key, visitor_id)
    WHERE event_type = 'conversion';

CREATE INDEX IF NOT EXISTS idx_telemetry_events_visitor_exp
    ON telemetry_events(user_id, visitor_id, experiment_key);

-- The local application connects as the admin role. Keep runtime privileges in
-- the schema so tables created by a separate migration/owner role remain usable
-- by the API. Default privileges cover objects that role creates later.
GRANT USAGE ON SCHEMA public TO admin;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON ALL TABLES IN SCHEMA public
    TO admin;

GRANT USAGE, SELECT, UPDATE
    ON ALL SEQUENCES IN SCHEMA public
    TO admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO admin;
