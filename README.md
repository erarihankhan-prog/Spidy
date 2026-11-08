# EIGHTX PANEL — Secure Vercel package

This package contains only the EIGHTX Panel and its server-side Supabase API. The Firebase Live Checker and all checker files have been excluded.

## Vercel Environment Variables

Add these in Vercel for the required deployment environments:

- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY` — optional compatibility variable; it is not exposed to the browser
- `SUPABASE_SECRET_KEY` — required server-side Supabase secret key

Do not use a `NEXT_PUBLIC_` prefix for the secret. After saving the variables, redeploy the project.

The frontend calls `/api/submissions`; only `api/submissions.js` accesses Supabase. The secret is not placed in HTML, frontend JavaScript, API responses, or public files.
