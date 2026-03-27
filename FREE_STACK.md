# Free Stack (No Shopify)

## Goal
Run Anavai as an enquiry-first ecommerce site using only free tiers:
- Static frontend
- Lead capture API
- Database
- Email notifications

## Architecture
- Frontend: static site (Vite build output)
- API: Cloudflare Worker (`/api/enquiry`, `/api/health`)
- DB: Supabase Postgres (table `enquiries`)
- Emails: Resend API (optional, free tier)
- Tracking: `dataLayer` events from `assets/js/ecommerce.js` and cart/contact flows
- Admin dashboard: `pages/admin.html` + Supabase Auth magic link

## Why this stack
- No monthly platform fee
- Fast global edge API (Cloudflare)
- Free managed Postgres (Supabase)
- Minimal operational complexity

## Files Added
- Worker API:
  - `backend/worker/src/index.js`
  - `backend/worker/wrangler.toml`
- DB schema:
  - `backend/supabase/schema.sql`
- Frontend transport layer:
  - `assets/js/ecommerce.js`
- Runtime config example:
  - `assets/js/anavai-config.example.js`
- Admin UI:
  - `pages/admin.html`
  - `assets/js/admin.js`

## Setup Steps
1. Create Supabase project (free).
2. Run SQL from `backend/supabase/schema.sql`.
3. Create Cloudflare Worker and deploy from `backend/worker`.
4. Set Worker secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY` (optional)
   - `RESEND_FROM` (optional)
   - `NOTIFY_TO` (optional)
5. Configure frontend endpoint:
   - edit `assets/js/anavai-config.js`:
     - `demoMode: false`
     - `enquiryEndpoint: "https://<your-worker>.workers.dev/api/enquiry"`

## Recommended Cloudflare Commands
```bash
cd backend/worker
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_FROM
npx wrangler secret put NOTIFY_TO
npx wrangler deploy
```

## Local Test
```bash
# frontend
npm run dev

# worker (separate terminal)
cd backend/worker
npx wrangler dev
```

Test endpoint:
```bash
curl -X POST http://127.0.0.1:8787/api/enquiry \
  -H "content-type: application/json" \
  -d '{"source":"contact_page","fields":{"email":"test@example.com","your_message":"Hello"}}'
```

Then in frontend config set:
```js
// assets/js/anavai-config.js
const DEFAULT_CONFIG = {
  currency: "EUR",
  demoMode: false,
  enquiryEndpoint: "http://127.0.0.1:8787/api/enquiry"
};
```

## Security Notes
- Worker validates minimal payload and email
- Honeypot supported via `hp` field
- RLS is enabled in Supabase
- Use service role key only in Worker secrets, never in frontend

## Future (still free-friendly)
- Add Cloudflare Turnstile for bot protection
- Add basic rate limiting per IP in Worker (KV or Durable Object)
- Add analytics sink endpoint for funnel events
