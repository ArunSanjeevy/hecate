# Hecate Browser JavaScript SDK

A framework-independent, ultra-lightweight, and resilient browser JavaScript SDK for the Hecate experimentation backend.

- **Zero dependencies**
- **Resilient**: Never throws errors that break the host website
- **Smart Visitor Identity**: Auto-generates, persists, and falls back gracefully
- **Highly Configurable**: Custom timeouts, error callbacks, and headers
- **Multi-format**: Bundled in ESM, CommonJS, and browser script-tag formats

---

## Installation

### NPM / Yarn
Install the package locally (once published or linked):
```bash
npm install hecate-js-sdk
# or
yarn add hecate-js-sdk
```

---

## Integration Guides

### 1. Browser Script-Tag Usage
Perfect for legacy websites or quick marketing experiments. Include the bundle directly:

```html
<!-- Load Hecate SDK globally -->
<script src="path/to/hecate-sdk.js"></script>

<script>
  // Exposes Hecate global object
  const client = Hecate.createHecateClient({
    baseUrl: 'https://hecate.example.com',
    requestTimeoutMs: 3000,
    onError: (err, context) => {
      console.warn('Hecate Experimentation Warning:', err.message, context);
    }
  });

  // Load and apply variant
  client.getAssignments(['homepage_hero']).then(() => {
    const variant = client.getVariant('homepage_hero', 'control');
    
    if (variant === 'treatment') {
      document.getElementById('hero-headline').innerText = 'Welcome to Hecate Treatment!';
    }
    
    // Explicitly track exposure once rendered
    client.trackExposure('homepage_hero');
  });
</script>
```

### 2. Plain JavaScript (ESM / Bundled)
Use ES module imports in modern front-end applications (Vite, Webpack, etc.):

```javascript
import { createHecateClient } from 'hecate-js-sdk';

const client = createHecateClient({
  baseUrl: 'https://hecate.example.com',
  requestTimeoutMs: 2500,
  onError: (err, context) => {
    console.error('Hecate SDK Error:', err, context);
  }
});

async function runExperiment() {
  // Fetch assignments for required experiments
  await client.getAssignments(['checkout_button_color']);

  // Retrieve assigned variant (falls back to 'control' on error or timeout)
  const variant = client.getVariant('checkout_button_color', 'control');

  // Apply variant change
  const button = document.getElementById('checkout-btn');
  if (variant === 'treatment') {
    button.classList.add('bg-purple');
  }

  // Record exposure when user sees the button
  client.trackExposure('checkout_button_color');
}

runExperiment();
```

### Returning static variant content

When an experiment is configured with static text content, read the selected
variant's content after loading assignments:

```javascript
await client.getAssignments(['homepage_tagline']);
const content = client.getContent('homepage_tagline');
if (content?.type === 'static_text') {
  document.getElementById('hero-headline').innerText = content.text;
}
client.trackExposure('homepage_tagline');
```

### 3. React Integration Lifecycle
To integrate Hecate in React, follow this recommended lifecycle pattern:

```jsx
import React, { useEffect, useState } from 'react';
import { createHecateClient } from 'hecate-js-sdk';

// Initialize a single instance of the client
const hecate = createHecateClient({
  baseUrl: 'https://hecate.example.com',
  requestTimeoutMs: 2000,
});

export function CheckoutButton() {
  const [variant, setVariant] = useState('control');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Request assignments for the experiment key
    hecate.getAssignments(['checkout_cta'])
      .then(() => {
        // 2. Read assigned variant (synchronous)
        const assigned = hecate.getVariant('checkout_cta', 'control');
        setVariant(assigned);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!loading) {
      // 3. Record exposure *only after* React renders the variant to the DOM
      hecate.trackExposure('checkout_cta', { page: 'checkout' });
    }
  }, [loading, variant]);

  const handleCheckoutClick = () => {
    // 4. Record conversion when the user takes the business action
    hecate.trackTelemetry({
      experimentKey: 'checkout_cta',
      eventType: 'conversion',
      eventName: 'checkout_completed',
      metadata: { cartValue: 149.99 }
    });
  };

  if (loading) return <button>Loading...</button>;

  return (
    <button
      onClick={handleCheckoutClick}
      className={variant === 'treatment' ? 'btn-modern' : 'btn-classic'}
    >
      {variant === 'treatment' ? 'Proceed to Secure Checkout' : 'Checkout Now'}
    </button>
  );
}
```

---

## Core Behaviors

### Visitor Identity
Hecate uses a robust, cascading storage mechanism to ensure visitor sticky assignments:
1. **Explicitly Supplied ID**: Uses the `visitorId` passed to `createHecateClient` if provided.
2. **First-Party Cookie**: Loads/stores `hecate_visitor_id` with:
   - Expiry: 1 year
   - SameSite: `Lax`
   - Security: `Secure` automatically appended when running on HTTPS.
3. **Local Storage Fallback**: If cookies are blocked or unavailable, stores `hecate_visitor_id` under `localStorage` key.
4. **In-Memory Fallback**: If both cookies and local storage are disabled, generates a new ID via `crypto.randomUUID()` and holds it in the client instance memory for the page session lifecycle.

### Assignment, Render, and Exposure Lifecycle
To maintain data accuracy, assignments and exposures are strictly decoupled:
- **`getAssignments`**: Calls the backend `POST /api/v1/assignments` to fetch bucket assignments for specific experiments. Assignments are cached in memory.
- **`trackExposure`**: Tells the backend that the visitor actually saw the variant.
  - **Local Duplicate Suppression**: The SDK tracks exposures during the current page lifecycle. Repeated calls to `trackExposure` for the same experiment and variant are suppressed, preventing inflated denominators in results.
  - **Unassigned Rejection**: Calling `trackExposure` for an experiment key that has not been fetched is ignored locally and triggers the `onError` callback.

### Telemetry & Conversion Tracking
- Telemetry events (conversions or custom product events) are sent via `POST /api/v1/events/telemetry`.
- Telemetry requests require a cached assignment. Calls for unassigned experiment keys are rejected locally.
- Retries:
  - **Conversion telemetry** (`eventType === 'conversion'`) and **Exposure requests** are retried **exactly once** if they fail due to network errors or HTTP 5xx errors.
  - **General telemetry events** (`eventType !== 'conversion'`) and HTTP 4xx responses are **never retried** (preventing conversion inflation or server hammering).

### Failure & Graceful Fallbacks
- If assignments fail, time out, or the network is offline, the SDK falls back to the configured default (e.g. `'control'`).
- The SDK wraps all API operations. It will **never** throw unhandled errors that could break the host web application.

---

## 🔒 Security Note: Browser API Keys

> [!CAUTION]
> **Use an SDK key only.** The backend restricts SDK keys to assignment and event-ingestion routes. They cannot manage experiments, retrieve results, or manage keys. A service key or dashboard JWT must never be embedded in browser code.
>
> SDK keys are still bearer credentials: rotate them, set expirations, rate-limit the ingestion endpoints, and use allowed-origin checks as a defense-in-depth measure. Origin checks do not replace authorization.
