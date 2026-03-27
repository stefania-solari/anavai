# Supabase Integration Guide (Anavai)

This project is already wired for Supabase through the Cloudflare Worker:
- Endpoint: `POST /api/enquiry`
- Storage table: `public.enquiries`

## 1) Create Supabase Project (Free)
- Create a new project in Supabase.
- Open SQL Editor and run:
  - `backend/supabase/schema.sql`
- In Auth settings, enable Email provider (magic link).
- Create at least one admin user (Auth > Users) with your email.

## 2) Worker Local Secrets
From `backend/worker`:
```bash
cp .dev.vars.example .dev.vars
```
Then edit `.dev.vars` with real values:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`)
- `SUPABASE_TABLE` (default `enquiries`)
- optional: `RESEND_API_KEY`, `RESEND_FROM`, `NOTIFY_TO`
- optional: `ALLOWED_ORIGINS`

## 3) Run Worker Locally
```bash
npm install
npm run worker:dev
```

Health check:
```bash
curl http://127.0.0.1:8787/api/health
```

Test enquiry:
```bash
curl -X POST http://127.0.0.1:8787/api/enquiry \
  -H "content-type: application/json" \
  -d '{
    "source":"contact_page",
    "fields":{
      "email":"test@example.com",
      "first_name":"Test",
      "last_name":"User",
      "your_message":"Hello from local test"
    }
  }'
```

## 4) Connect Frontend
Edit `assets/js/anavai-config.js`:
```js
const DEFAULT_CONFIG = {
  currency: "EUR",
  demoMode: false,
  enquiryEndpoint: "http://127.0.0.1:8787/api/enquiry",
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_PUBLISHABLE_KEY"
};
```

For production, use Worker URL:
```js
enquiryEndpoint: "https://<your-worker>.workers.dev/api/enquiry"
```

## 5) Deploy Worker
```bash
cd backend/worker
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_FROM
npx wrangler secret put NOTIFY_TO
npx wrangler secret put ALLOWED_ORIGINS
npx wrangler deploy
```

## 6) Validate in Supabase
In Table Editor (`public.enquiries`), confirm rows are created after:
- contact form submit
- checkout enquiry submit

## 7) Admin Dashboard
- Open `pages/admin.html`
- Sign in with magic link
- View/filter enquiries and update status (`new`, `qualified`, `quoted`, `won`, `lost`)

## Notes
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in Worker secrets.
- Do not expose service role keys in frontend.
