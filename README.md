# Hecate Experimentation Backend MVP

Hecate is a lightweight experimentation and A/B testing backend service. It supports experiment CRUD operations, deterministic traffic-based variant assignments, exposure tracking, telemetry event/conversion tracking, and results aggregation.

## Tech Stack
- **Runtime**: Node.js v22.x (LTS)
- **Framework**: Express.js
- **Database**: PostgreSQL (via `pg-promise`)
- **Cache**: Redis
- **Test Framework**: Jest & Supertest

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
API_KEY=dev-api-key
DATABASE_URL=postgres://admin:hecate@localhost:5432/hecate_development
POSTGRES_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres
DB_APP_USER=admin
DB_APP_PASSWORD=hecate
DB_SSL_ENABLED=false
DB_SSL_REJECT_UNAUTHORIZED=true
# DB_CA_CERT_PATH=/absolute/path/to/ca.pem
# DB_CA_CERT="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
REDIS_URL=redis://localhost:6379
```

For production PostgreSQL providers like Aiven, set `NODE_ENV=prod`, provide `DATABASE_URL`, set `DB_SSL_ENABLED=true`, and provide either `DB_CA_CERT` or `DB_CA_CERT_PATH`. Prefer `sslmode=verify-full` in the database URL.

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
```

Default database names:
- Development: `hecate_development`
- Test: `hecate_test`
- Production: `hecate`

Local database user:
- Username: `admin`
- Password: `hecate`

### 4. Run Schema Migrations
Migrations run automatically on application startup. You can also run the server directly which triggers migrations:
```bash
npm start
```

### 5. Start the Application
- Production mode:
  ```bash
  npm start
  ```

---

## Running Tests

Tests are executed using Jest. Ensure PostgreSQL and Redis are running locally or inside Docker before running tests.

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

All protected API endpoints require the `x-api-key` header to match the configured `API_KEY` (default: `dev-api-key`).

### 1. Health Check (Public)
`GET /health`
```bash
curl http://localhost:4000/health
```

### 2. Create Experiment
`POST /api/v1/experiments`
```bash
curl -X POST http://localhost:4000/api/v1/experiments \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key" \
  -d '{
    "key": "checkout_button_text",
    "status": "active",
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
  -H "x-api-key: dev-api-key"
```

### 4. List Experiments
`GET /api/v1/experiments`
```bash
curl http://localhost:4000/api/v1/experiments \
  -H "x-api-key: dev-api-key"
```

### 5. Update Experiment
`PUT /api/v1/experiments/:key`
```bash
curl -X PUT http://localhost:4000/api/v1/experiments/checkout_button_text \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key" \
  -d '{
    "status": "active",
    "variants": [
      { "key": "control", "allocation": 90 },
      { "key": "treatment", "allocation": 10 }
    ]
  }'
```

### 6. Activate Experiment
`POST /api/v1/experiments/:key/activate`
```bash
curl -X POST http://localhost:4000/api/v1/experiments/checkout_button_text/activate \
  -H "x-api-key: dev-api-key"
```

### 7. Deactivate Experiment
`POST /api/v1/experiments/:key/deactivate`
```bash
curl -X POST http://localhost:4000/api/v1/experiments/checkout_button_text/deactivate \
  -H "x-api-key: dev-api-key"
```

### 8. Delete Experiment
`DELETE /api/v1/experiments/:key`
```bash
curl -X DELETE http://localhost:4000/api/v1/experiments/checkout_button_text \
  -H "x-api-key: dev-api-key"
```

### 9. Get Assignment (Deterministic & Sticky)
`POST /api/v1/assignments`
```bash
curl -X POST http://localhost:4000/api/v1/assignments \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key" \
  -d '{
    "visitorId": "visitor_123",
    "experimentKeys": ["checkout_button_text"]
  }'
```

### 10. Record Exposure Event
`POST /api/v1/events/exposure`
```bash
curl -X POST http://localhost:4000/api/v1/events/exposure \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key" \
  -d '{
    "visitorId": "visitor_123",
    "experimentKey": "checkout_button_text",
    "variantKey": "control",
    "metadata": {
      "page": "checkout"
    }
  }'
```

### 11. Record Telemetry (Conversion) Event
`POST /api/v1/events/telemetry`
```bash
curl -X POST http://localhost:4000/api/v1/events/telemetry \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key" \
  -d '{
    "visitorId": "visitor_123",
    "experimentKey": "checkout_button_text",
    "variantKey": "control",
    "eventType": "conversion",
    "eventName": "order_placed",
    "metadata": {
      "orderValue": 129.99
    }
  }'
```

### 12. Get Aggregated Experiment Results
`GET /api/v1/results/:experimentKey`
```bash
curl http://localhost:4000/api/v1/results/checkout_button_text \
  -H "x-api-key: dev-api-key"
```
