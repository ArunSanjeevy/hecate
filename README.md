# Hecate Experimentation Backend MVP

Hecate is a lightweight experimentation and A/B testing backend service. It supports experiment CRUD operations, deterministic traffic-based variant assignments, exposure tracking, telemetry event/conversion tracking, and results aggregation.

The architecture, determinism, scale, failure handling, and measurement-correctness decisions are documented in [hecate_design_doc.md](./docs/hecate_design_doc.md).

## Tech Stack
- **Runtime**: Node.js v24.x (LTS) (v22.x+ compatible)
- **Framework**: Express.js
- **Database**: PostgreSQL (via `pg-promise`)
- **Cache**: Redis
- **Test Framework**: Jest & Supertest

## Repository Structure
- `.` — Express.js backend API and database migrations.
- `admin-dashboard/` — React SPA Admin Dashboard (Vite + React Router).
- `js-sdk/` — Framework-agnostic Browser JavaScript SDK.
- `docs/` — Technical design documents, API contracts, and architecture specifications.

---

## Setup & Running Locally

### 1. Configure Environment Variables
Copy `.env.example` to `.env` and adjust the connection parameters as needed:
```bash
cp .env.example .env
```
Default parameters in `.env`:
```ini
PORT=4000
NODE_ENV=dev
JWT_SECRET=replace-with-at-least-32-random-characters
JWT_ISSUER=hecate-api
JWT_AUDIENCE=hecate-dashboard
JWT_EXPIRES_IN=24h
API_KEY_HASH_SECRET=replace-with-at-least-32-random-characters
CORS_ORIGINS=http://localhost:5173
RATE_LIMIT_ENABLED=true
RATE_LIMIT_AUTH_WINDOW_MS=900000
RATE_LIMIT_AUTH_MAX=50
RATE_LIMIT_SDK_WINDOW_MS=60000
RATE_LIMIT_SDK_MAX=600
RATE_LIMIT_CONTROL_WINDOW_MS=60000
RATE_LIMIT_CONTROL_MAX=300
API_KEY_AUTH_CACHE_ENABLED=true
API_KEY_AUTH_CACHE_TTL_SECONDS=300
EXPERIMENT_CACHE_TTL_SECONDS=60
GRACEFUL_SHUTDOWN_TIMEOUT_MS=10000
DATABASE_URL=postgres://admin:hecate@localhost:5432/hecate_development
TEST_DATABASE_URL=postgres://admin:hecate@localhost:5432/hecate_test
POSTGRES_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres
DB_APP_USER=admin
DB_APP_PASSWORD=hecate
DB_SSL_ENABLED=false
DB_SSL_REJECT_UNAUTHORIZED=true
# DB_CA_CERT_PATH=/absolute/path/to/ca.pem
# DB_CA_CERT="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
REDIS_URL=redis://localhost:6379
```

For production PostgreSQL providers like Aiven, set `NODE_ENV=prod`, provide
`DATABASE_URL`, `REDIS_URL`, strong `JWT_SECRET` and `API_KEY_HASH_SECRET`
values, set `DB_SSL_ENABLED=true`, set `DB_SSL_REJECT_UNAUTHORIZED=true`,
provide either `DB_CA_CERT` or `DB_CA_CERT_PATH`, and set `CORS_ORIGINS` to the
explicit dashboard origin(s). Prefer `sslmode=verify-full` in the database URL.

### 2. Install Dependencies
```bash
npm install
```

### 3. Create Databases
Create the local development and test databases before starting the app or running tests:
```sql
CREATE DATABASE hecate_development;
CREATE DATABASE hecate_test;
CREATE DATABASE hecate;
```

Or run:
```bash
npm run db:init
npm run db:init:test
```

Default database names:
- Development: `hecate_development`
- Test: `hecate_test`
- Production: `hecate`

Local database user:
- Username: `admin`
- Password: `hecate`

### 4. Run Schema Migrations
Run migrations explicitly after creating the database and before starting the app. Migrations create database tables only; they do not seed users, API keys, experiments, or other data.
```bash
npm run db:migrate
```

*Note:* If `npm run db:migrate` fails (e.g. due to connection or permissions issues), run the SQL statements from [`lib/sql/schema.sql`](./lib/sql/schema.sql) directly against your PostgreSQL database using `psql` or your database GUI:
```bash
psql -d hecate_development -f lib/sql/schema.sql
```

### 5. Start the Application
- Production mode:
  ```bash
  npm start
  ```

---

## Running Tests

Tests are executed using Jest. Ensure PostgreSQL and Redis are running locally or inside Docker before running tests.

Integration tests require `TEST_DATABASE_URL` and refuse to run destructive
cleanup unless the configured database name is clearly test-only, such as
`hecate_test` or `test_hecate`. Do not point `TEST_DATABASE_URL` at a
development, staging, or production database.

- Run all tests:
  ```bash
  npm test
  ```
- Run unit tests:
  ```bash
  npm run test:unit
  ```
- Run integration tests:
  ```bash
  npm run test:integration
  ```

---

## API Usage Reference

## Authentication and API-key scopes

The API has two trust boundaries:

- **SDK keys** are intentionally publishable and may call only assignments and event-ingestion routes. Create them through the authenticated keys API; they are returned in plain text only at creation time.
- **User JWTs** (returned by `POST /api/v1/auth/login`) authorize the dashboard/control plane: experiments, results, and API-key management.
- **Service keys** are server-to-server credentials and may access both areas. Do not place one in browser code.

Register and sign in before calling control-plane APIs:

```bash
curl -X POST http://localhost:4000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","password":"correct-horse-battery-staple"}'

curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","password":"correct-horse-battery-staple"}'
```

Use the returned token as `Authorization: Bearer <token>` for the control-plane examples below. Use an SDK key as `x-api-key` only for assignments and events.

Sign-up does not create an SDK key. After logging in, create one explicitly and
copy the returned value immediately:

```bash
curl -X POST http://localhost:4000/api/v1/keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Website production","expiresAt":"2026-12-31T23:59:59.000Z"}'
```

API keys are returned in full only when created. The database stores a short
lookup prefix and a keyed hash, not the plaintext key.

### 1. Health Checks (Public)
`GET /health` and `GET /health/live` are liveness checks.
```bash
curl http://localhost:4000/health
```

`GET /health/ready` is a readiness check. PostgreSQL is required; Redis is
reported as degraded if unavailable because Redis is a cache optimization, not
the source of truth.

```bash
curl http://localhost:4000/health/ready
```

### 2. Create Experiment
`POST /api/v1/experiments`
```bash
curl -X POST http://localhost:4000/api/v1/experiments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "key": "checkout_button_text",
    "status": "draft",
    "variants": [
      { "key": "control", "allocation": 50 },
      { "key": "treatment", "allocation": 50 }
    ]
  }'
```

### 3. Get Experiment
`GET /api/v1/experiments/:key`
```bash
curl http://localhost:4000/api/v1/experiments/checkout_button_text \
  -H "Authorization: Bearer <token>"
```

### Static text content

An experiment can either return only the selected variant key or return static
plain-text content with the selected variant. To enable content delivery, add a
`content` object to **every** variant when creating or updating a draft
experiment:

```json
{
  "key": "homepage_tagline",
  "status": "draft",
  "variants": [
    {
      "key": "control",
      "allocation": 50,
      "content": { "type": "static_text", "text": "Shop smarter today." }
    },
    {
      "key": "treatment",
      "allocation": 50,
      "content": { "type": "static_text", "text": "Find your next favorite." }
    }
  ]
}
```

`static_text` is currently the only supported content type. Existing
variant-only experiments remain supported. Content cannot be configured for
only a subset of variants.

### 4. List Experiments
`GET /api/v1/experiments?limit=20&offset=0`
```bash
curl "http://localhost:4000/api/v1/experiments?limit=20&offset=0" \
  -H "Authorization: Bearer <token>"
```

List endpoints support basic pagination with `limit` and `offset`. The default
limit is `20`, the maximum limit is `100`, and responses include:

```json
{
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 42,
    "hasMore": true
  }
}
```

### 5. Update Experiment
`PUT /api/v1/experiments/:key`
```bash
curl -X PUT http://localhost:4000/api/v1/experiments/checkout_button_text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "status": "draft",
    "variants": [
      { "key": "control", "allocation": 90 },
      { "key": "treatment", "allocation": 10 }
    ]
  }'
```

Only draft experiments can change variants, allocations, or content. Active, paused, and
archived configurations return `409 experiment_configuration_immutable`; create
a new experiment key/version instead.

### 6. Activate Experiment
`POST /api/v1/experiments/:key/activate`
```bash
curl -X POST http://localhost:4000/api/v1/experiments/checkout_button_text/activate \
  -H "Authorization: Bearer <token>"
```

### 7. Deactivate Experiment
`POST /api/v1/experiments/:key/deactivate`
```bash
curl -X POST http://localhost:4000/api/v1/experiments/checkout_button_text/deactivate \
  -H "Authorization: Bearer <token>"
```

### 8. Delete Experiment
`DELETE /api/v1/experiments/:key`
```bash
curl -X DELETE http://localhost:4000/api/v1/experiments/checkout_button_text \
  -H "Authorization: Bearer <token>"
```

Deleting an experiment archives it instead of removing the row. Archived
experiment keys remain reserved forever and cannot be reactivated.

### 9. Get Assignment (Deterministic & Sticky)
`POST /api/v1/assignments`
```bash
curl -X POST http://localhost:4000/api/v1/assignments \
  -H "Content-Type: application/json" \
  -H "x-api-key: <sdk-api-key>" \
  -d '{
    "visitorId": "visitor_123",
    "experimentKeys": ["checkout_button_text"]
  }'
```

For a content-enabled experiment, the selected assignment additionally includes
the configured content:

```json
{
  "assignments": [
    {
      "experimentKey": "homepage_tagline",
      "variantKey": "treatment",
      "content": {
        "type": "static_text",
        "text": "Find your next favorite."
      }
    }
  ]
}
```

The `content` property is omitted for variants without configured content.

### 10. Record Exposure Event
`POST /api/v1/events/exposure`
```bash
curl -X POST http://localhost:4000/api/v1/events/exposure \
  -H "Content-Type: application/json" \
  -H "x-api-key: <sdk-api-key>" \
  -d '{
    "visitorId": "visitor_123",
    "experimentKey": "checkout_button_text",
    "variantKey": "control",
    "metadata": {
      "page": "checkout"
    }
  }'
```

Exposure tracking is fire-and-forget after rendering. The backend verifies that
the supplied variant matches deterministic assignment; a mismatched exposure is
rejected with `409 assignment_mismatch` and is never counted.

### 11. Record Telemetry (Conversion) Event
`POST /api/v1/events/telemetry`
```bash
curl -X POST http://localhost:4000/api/v1/events/telemetry \
  -H "Content-Type: application/json" \
  -H "x-api-key: <sdk-api-key>" \
  -d '{
    "visitorId": "visitor_123",
    "experimentKey": "checkout_button_text",
    "eventType": "conversion",
    "eventName": "order_placed",
    "metadata": {
      "orderValue": 129.99
    }
  }'
```

Conversions are attributed to the visitor's verified exposure. If that exposure
has not been recorded yet, the API returns `409 exposure_not_found`; report it
through the SDK error callback without affecting page behavior. The SDK does
not automatically retry this attribution error.

### 12. Get Aggregated Experiment Results
`GET /api/v1/results/:experimentKey`
```bash
curl http://localhost:4000/api/v1/results/checkout_button_text \
  -H "Authorization: Bearer <token>"
```

---

## Deployment

Hecate is configured for deployment on [Render](https://render.com) using [`render.yaml`](./render.yaml).

- **Backend Service**: `https://hecate-backend.onrender.com`
- **Admin Dashboard**: `https://hecate-admin.onrender.com/`

When deploying, configure the following environment variables on Render:
- `DATABASE_URL`: Managed PostgreSQL connection string (e.g. Aiven / Supabase)
- `REDIS_URL`: Managed Redis connection string (e.g. Upstash)
- `JWT_SECRET` & `API_KEY_HASH_SECRET`: Strong secret strings
- `DB_SSL_ENABLED`: `true`
- `DB_SSL_REJECT_UNAUTHORIZED`: `true`
- `DB_CA_CERT`: CA certificate content for SSL connection
