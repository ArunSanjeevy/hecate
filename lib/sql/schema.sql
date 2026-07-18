-- DDL Schema for Hecate Experimentation Backend MVP

-- Enable pgcrypto if needed for UUID generation in older PG versions, though gen_random_uuid() is standard in PG 13+
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Experiments Table
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    salt TEXT NOT NULL,
    variants JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_experiments_key ON experiments(key);

-- Exposure Events Table
CREATE TABLE IF NOT EXISTS exposure_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_key TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    UNIQUE(experiment_key, visitor_id, variant_key)
);

CREATE INDEX IF NOT EXISTS idx_exposure_events_visitor_exp ON exposure_events(visitor_id, experiment_key);

-- Telemetry Events Table
CREATE TABLE IF NOT EXISTS telemetry_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_key TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Unique index to prevent duplicate conversion events for a given experiment & visitor & event name
CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_events_conversion_unique 
ON telemetry_events(event_type, event_name, experiment_key, visitor_id) 
WHERE event_type = 'conversion';

CREATE INDEX IF NOT EXISTS idx_telemetry_events_visitor_exp ON telemetry_events(visitor_id, experiment_key);
