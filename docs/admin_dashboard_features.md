# Hecate Admin Dashboard Feature Document

This document outlines the core capabilities, page modules, user experience patterns, styling configurations, and verification layers implemented in the Hecate Experimentation Platform Admin Dashboard MVP.

---

## 1. Executive Summary
The Hecate Admin Dashboard is a single-page application (SPA) built using **React** and **Vite**. It provides a premium management interface for experimentation workflows. Developers and product managers can use it to monitor system connectivity, audit existing configurations, construct new experiments with validation rules, transition status states, delete configurations, and review real-time conversion rates.

- **Frontend Core**: React 18, Vite 8, React Router 6, TanStack Query v5, React Hook Form v7, Recharts v2.
- **Styling Architecture**: Vanilla CSS with custom properties (`src/index.css`, `src/App.css`), fully responsive, supporting desktop-first layouts down to mobile sizes.
- **TDD Test Suite**: 47 component, routing, and client integration tests running on Vitest and React Testing Library under the `jsdom` environment.
- **Location**: Isolated within `D:\resultflowai\hecate\admin-dashboard`.

---

## 2. Global Layout & Styling

### Theme Engine (Dark & Light Mode Toggle)
The application includes a global theme toggle stored in `localStorage` and managed at the document element level. Both themes use custom fonts (**Outfit** for headings, **Inter** for body text) and Postman-style styling details.
- **Light Theme (Default)**: Optimized for daylight readability, featuring warm white/pastel backgrounds (`#f8f9fa`), crisp white card panels (`#ffffff`), soft grey borders (`#e9ecef`), and deep charcoal typography (`#212529`).
- **Dark Theme**: Optimized for developer environments, featuring dark slate backgrounds (`#181818`, `#212121`), subtle borders (`#383838`), and off-white typography (`#f5f5f5`).
- **Accent Branding**: Both themes utilize the **Postman Orange** brand color (`#ff6c37` / `#ff8552`) for primary actions, buttons, and visual focus points.

### Navigation Sidebar & Mobile Header
- **Sidebar (Desktop)**: Vertical navigation pane featuring brand headers, active routing highlights, and links to the **Overview** dashboard and the **Experiments** catalog.
- **Mobile Header**: Collapses the sidebar into a mobile drawer activated by a responsive hamburger toggle icon (`Menu` / `X`).
- **Active Navigation Highlights**: Automatically style links using high-contrast active classes depending on the browser route.

### Backend Connectivity Monitoring
- A status polling controller monitors backend server status.
- Triggers a check to the backend `/health` endpoint every 10 seconds.
- Displays a visual indicator in the top-right header: **API: Online** (green dot) or **API: Offline** (red dot), updating in real time.

### Reusable UI State Handlers
- `LoadingState`: Rendered when fetching remote state, showing an animated spinner and text description.
- `ErrorState`: Rendered on network failures or API exceptions, presenting the error message alongside a functional **Retry** call action.
- `EmptyState`: Rendered when lists or charts contain no items, guiding the user to appropriate actions (e.g. creating their first experiment).

---

## 3. Page Modules & Features

### A. Dashboard Overview (`/`)
Provides a high-level summary of the experimentation platform's current scale.
- **Key Performance Indicators (KPIs)**: Displays summary counts for:
  - **Total Experiments**: Sum of all configurations.
  - **Active**: Currently running experiments serving traffic.
  - **Paused**: Temporarily paused configurations.
  - **Drafts**: Newly created configurations that have not yet been activated.
  - **Archived**: Decommissioned experiments.
  - **Total Variants**: Total number of uniquely mapped experiment variations.
- **Visual Charting**: Displays a vertical bar chart (**Status Distribution**) using Recharts, where each status is color-coded to match the visual badge system.
- **Quick Action Call-to-Action (CTA)**: Includes a direct navigation link to the creation wizard to quickly bootstrap new experiments.

### B. Experiment List Page (`/experiments`)
Main view for auditing the experiment registry.
- **Full Catalog Table**: Renders details including:
  - Unique **Experiment Key** (`eid`).
  - Active **Status** (Draft, Active, Paused, Archived).
  - Experiment **Salt** seed value.
  - Total **Variant count**.
  - **Allocation Summary**: Clean visual tags presenting keys and traffic weight allocations (e.g., `control: 50% | treatment: 50%`).
- **Live Search Filtering**: An interactive input field that filters table rows on the fly by matching search queries against Experiment Keys.
- **Status Filter Tabs**: Dropdown tab options to filter the list view by status type (e.g., viewing only active or draft experiments).
- **Aligned Action Controls**: Renders two actions side-by-side on each row:
  - **View**: Navigates to `/experiments/:key` to examine configuration details.
  - **Results**: Navigates to `/experiments/:key/results` to view performance analytics.

### C. Create Experiment Wizard (`/experiments/new`)
A guided wizard utilizing React Hook Form to add new experiments.
- **Validation Rules**:
  - **Key & Salt**: Key must be unique, lowercase, and cannot contain spaces.
  - **Dynamic Variant Array**: Form supports adding/removing variant entries dynamically.
  - **Minimum Variants Constraint**: Require at least 2 variants.
  - **Variant Key Uniqueness**: All variant keys within an experiment must be unique.
  - **Variant Allocation Weights**: Allocations must be positive integers and must **total exactly 100%**.
- **Real-Time Visual Validation Indicators**: Shows error states directly under the corresponding form controls.
- **Server Conflict Integration**: Intercepts HTTP 409 conflict errors (e.g. duplicate experiment key) and renders a top-level validation banner.

### D. Experiment Detail & View/Edit Mode (`/experiments/:key`)
To prevent accidental changes to active traffic, the experiment details page implements a strict **View vs. Edit Mode** state toggle.
- **Default View Mode**:
  - Form controls (Status select, Salt, Variant Keys, and Allocation weights) are disabled (`readonly`/`disabled`).
  - Variant adding (`Add Variant`) and removing (`trash` icon) controls are hidden.
  - The bottom "Save Changes" panel is hidden.
  - Header actions bar presents three controls:
    - **Edit Configuration**: Toggles the page into Edit Mode.
    - **View Analytics**: Direct link to the performance dashboard.
    - **More Actions Dropdown**: Collapsible menu containing:
      - **Activate / Deactivate**: State mutations that trigger queries to activate or pause the experiment.
      - **Delete**: Renders a prompt to delete the experiment, and on confirmation, purges it from the database and redirects to the List view.
- **Interactive Edit Mode**:
  - Unlocks status, variant key inputs, and allocations.
  - Reveals the "Add Variant" button and variant "Remove" controls.
  - Hides the default header actions to lock focus on editing.
  - Renders a bottom save panel containing:
    - **Save Configuration**: Submits modifications. Returns to View Mode upon success.
    - **Cancel**: Reverts changes to match original database records and returns to View Mode.
  - **Safety Warning Alert**: Displays a warning alert if modified allocations differ from the original values: *"Changing allocation may cause some visitors to receive a different variant."*

### E. Analytics Results Page (`/experiments/:key/results`)
Presents experiment analytics by calling the backend results endpoint.
- **Summary Metrics Grid**: Displays:
  - **Total Exposures**: The denominator of the experiment (total times variants have been rendered).
  - **Total Conversions**: Total conversion telemetry events recorded.
  - **Exposures & Conversions Table**: Breakdown of exposures, conversions, and conversion rates by variant.
- **Conversion Rate Visualization**: Renders a Recharts bar chart comparing conversion rates.
- **Safety Calculations**: Handles division-by-zero checks cleanly (e.g., if an experiment has zero exposures, conversion rates render as `0.00%` rather than `NaN%`).
- **Live Data Refresh**: Includes a manual refresh CTA to fetch the latest analytics.

---

## 4. API Client Integration & Error Handling

All network integrations are centralized within a single API Client (`src/api/client.js`).
- **Automatic Headers Injection**: Automatically forwards `Content-Type: application/json` and `x-api-key` headers.
- **API Error Wrapping**: Standardizes response errors:
  - **400 (Bad Request)**: Validation payloads.
  - **401 (Unauthorized)**: Missing or invalid API key.
  - **404 (Not Found)**: Requesting non-existent experiments.
  - **409 (Conflict)**: Attempting to create duplicate keys.
  - **500 (Internal Server Error)**: General server failure.
  - **Network / Abort**: Server offline or client timeouts.
- **TanStack Query Caching & Mutations**:
  - Leverages TanStack Query (`@tanstack/react-query`) to cache listings and metrics.
  - Automatically invalidates cache tags (`['experiments']`, `['experiment', key]`) on state transitions, deletes, or saves, triggering layout updates.

---

## 5. Quality Assurance & Testing Suite

Testing is built on **Vitest** and **React Testing Library** under a `jsdom` testing environment.
- **Coverage Summary**:
  - API Client header composition and custom error mapping.
  - Dark/Light mode toggles, local storage state persistence, and DOM updates.
  - Overview cards and status charts layout.
  - Experiment listing filtering, search key controls, and row rendering.
  - Create experiment validators (empty fields, variant limits, allocations sum).
  - Detail page View/Edit Mode toggling, enabled fields, and cancel value reversion.
  - State control mutations (Activate, Deactivate, Delete with confirmation popups).
  - Analytics calculations and division-by-zero safety.
