# Hecate Experimentation Platform - Admin Dashboard MVP

A React-based administration dashboard for the Hecate Experimentation Platform, built with React, Vite, TanStack Query, React Router, React Hook Form, and Recharts.

---

## ⚠️ Security Notice: API Key Limitation

> [!WARNING]
> **API Key Visibility**: Vite environment variables starting with `VITE_` are injected into the client-side JavaScript bundle during the build process. This means `VITE_HECATE_API_KEY` is **visible to anyone who loads the site in their browser** and must not be considered a backend secret.
>
> This setup is acceptable **only for local development or controlled internal MVP demonstrations**.

### Production Recommendations
To secure the Hecate Admin API in a production environment:
1. **BFF (Backend-For-Frontend)**: Deploy a lightweight server-side BFF that authenticates user sessions (e.g., cookie-based sessions) and stores the real `API_KEY` in environment variables on the server. The client dashboard calls the BFF, which forwards requests to the Hecate backend.
2. **Authentication / Role-Based Access Control**: Implement identity provider authentication (OAuth2 / OIDC / Auth0) before allowing access to the dashboard.
3. **Network Restrictions**: Place the Express API and the dashboard server behind a VPN or whitelist admin IPs using security groups/reverse proxies.

---

## Requirements
- **Node.js**: latest LTS (version 22.x or 24.x recommended)
- **Hecate Backend**: Node.js backend must be running on `http://localhost:4000` (or the URL specified in environment variables).

---

## Installation & Setup

1. **Navigate to the Dashboard Directory**:
   ```bash
   cd admin-dashboard
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the `admin-dashboard` root directory (a `.env.example` has been provided):
   ```ini
   VITE_HECATE_API_URL=http://localhost:4000
   VITE_HECATE_API_KEY=dev-api-key
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Start Development Server**:
   Starts the dashboard on `http://localhost:3000`:
   ```bash
   npm run dev
   ```

---

## Available Routes

- `/` — **Overview Dashboard**: Summarizes total, active, paused, draft, and archived experiments, count of total configured variants, and status distributions.
- `/experiments` — **Experiment List**: Tabular view of all experiments with client-side key-search and status-filtering controls.
- `/experiments/new` — **Create Experiment**: Form to define experiment key, status, and dynamic variant allocations (adds/removes variants, validates allocation sums to exactly 100%).
- `/experiments/:key` — **Edit Experiment**: Inspects salt, key (read-only), and allows editing status and allocations. Warns if traffic allocation shifts.
- `/experiments/:key/results` — **Analytics Results**: Summarizes exposures, conversions, conversion rates (formatted as percentages), zero-exposure safety checks, and a comparison bar chart.

---

## Commands

### Start local dev server
Runs the application on port `3000`:
```bash
npm run dev
```

### Run Vitest test suite
Executes unit and component integration tests:
```bash
npm test
```

### Compile production build
Builds the static application files to `./dist`:
```bash
npm run build
```

### Locally preview production build
```bash
npm run preview
```
