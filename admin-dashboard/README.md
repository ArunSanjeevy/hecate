# Hecate Admin Dashboard

React and Vite dashboard for the Hecate experimentation platform.

## Security and authentication

The dashboard signs users in using `/api/v1/auth/login` and sends the returned user JWT as `Authorization: Bearer <token>` to all control-plane and API-key routes. SDK keys are never used as dashboard credentials.

The JWT is held in memory and `sessionStorage` to retain the current browser session through a page refresh. `sessionStorage` clears with the browser session and is intentionally used instead of `localStorage`. For a stronger production posture, use a BFF with HttpOnly cookie sessions.

> [!WARNING]
> Vite variables are bundled into browser code. Never configure an SDK key or service key in this dashboard.

## Setup

```ini
# .env
VITE_HECATE_API_URL=http://localhost:4000
```

No API or service key belongs in `.env`. Start the backend, then install and run the dashboard:

```bash
npm install
npm run dev
```

## Routes

- `/login` and `/signup` authenticate dashboard users. Generate SDK keys from the authenticated API Keys page.
- `/` provides the experiment overview.
- `/experiments` manages experiments and results.
- `/keys` lists, creates, copies once, and revokes SDK/API keys. These keys are for SDK clients, not dashboard access.

## Static variant content

When creating or editing a draft experiment, select **Return plain-text content
with each assignment** to add a text value for every variant. Active, paused,
and archived experiment configurations are immutable; create a new experiment
version to change content after activation.

## Commands

```bash
npm test
npm run build
npm run preview
```
