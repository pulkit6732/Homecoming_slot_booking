# GITAM Interview Portal

React, TypeScript, and Vite foundation for the student interview booking and
administration portal. The student and admin routes are placeholders at this
stage; booking, authentication, and backend operations are not implemented yet.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite. The application shell redirects `/` to
`/student`; `/admin` is the separate administrator placeholder.

## Checks and production build

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

Vite writes the production site to `dist`. Netlify uses `npm run build`, publishes
`dist`, routes SPA paths to `index.html`, and reserves `/api/*` for functions in
`netlify/functions`.

## Configuration

Copy `.env.example` to `.env` only when local integration work begins. Keep `.env`
out of Git. Supabase service-role credentials, the Apps Script signing secret,
and spreadsheet credentials must remain server-side and must never be added to
Vite-prefixed variables.

The Apps Script source workspace is `apps-script/src`; no script is deployed by
this project setup.
