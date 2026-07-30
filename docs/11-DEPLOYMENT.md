# Deployment

**Version:** 1.0
**Status:** Draft — first production deployment not yet performed
**Last Updated:** 2026-07-21

> Manual release checklist for the first controlled production deployment of Architect OLNOO. No step here has been executed automatically — every remote/hosting/DNS action requires explicit human approval and manual execution.

---

## Target

Next.js 16 app (`next build` / `next start`), inferred from existing docs/specs references ("не проходят через Next.js/Vercel") — Vercel via its GitHub integration against `RomanVaskin/architect-olnoo`. No `.vercel` project link exists yet in this working copy.

Every API route that touches `sharp` (`concepts/generate`, `concepts/correct`, cloud generate/correct, image-crop-dependent paths) already declares `export const runtime = "nodejs"`, required since `sharp` needs native bindings and cannot run on the Edge runtime — verified consistent across all 12 route handlers.

## 1. Environment variables to configure in hosting

Set these in the hosting platform's project settings (never commit real values — `.env.example` documents names and safe placeholders only):

| Variable | Scope | Notes |
|---|---|---|
| `AI_ROUTER_URL` | Server-only | Internal base URL of OLNOO AI Router, for example `http://127.0.0.1:8080`. |
| `AI_ROUTER_API_KEY` | Server-only | Architect service credential accepted by Router `API_KEYS`; never expose to the browser. |
| `AI_IMAGE_MODEL` | Server-only, optional | Falls back to `gemini-3.1-flash-image`; the model must be enabled in Router. |
| `AI_REVIEW_MODEL` | Server-only, optional | Falls back to `gemini-2.5-flash`; the model must be enabled in Router. |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Safe to expose — scoped by RLS. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | The publishable key, never a service-role key. |
| `NEXT_PUBLIC_SITE_URL` | Public | Set to the real production origin, no trailing slash — used as the Supabase email-confirmation redirect base. |

No `SUPABASE_SERVICE_ROLE_KEY` or equivalent exists anywhere in application code — confirmed by repo-wide grep. Every server route uses the caller's own RLS session client only.

`GEMINI_API_KEY` must not be configured in Architect. It belongs only to OLNOO
AI Router. Verify the dependency before starting Architect:

```bash
curl --fail "$AI_ROUTER_URL/health"
```

Troubleshooting:

- Router `401`: `AI_ROUTER_API_KEY` does not match Router `API_KEYS`.
- Router `404 MODEL_NOT_FOUND`: selected model is absent from Router
  `GEMINI_MODELS`.
- Router `504`: provider exceeded Router timeout; Architect keeps the paid
  attempt recoverable and requires acknowledgement when outcome is ambiguous.
- Router `429`: wait for a transient limit or correct provider quota/billing.
- Connection failure: inspect Router health/logs before retrying a paid attempt.

## 2. Supabase production settings (manual — not changed by this task)

In the Supabase dashboard for project `architect-olnoo` (ref `iaomlfkcbjeqpgnbpwxs`), under Authentication → URL Configuration:

- **Site URL**: currently `http://localhost:3000` — must be updated to the real production origin before go-live, or password-reset/email-confirmation links will point at localhost.
- **Redirect URLs allow list**: currently empty — must include `https://<production-domain>/auth/callback` (and the preview-deployment domain pattern if using Vercel preview URLs) before those flows will work in production.

Do not change these until the production domain is finalized and approved.

## 3. Build

```
npm run build
```

Expected output: a successful Turbopack production build listing all routes (`○` static, `ƒ` dynamic per-request) with no type or lint errors. `npm run start` serves the build locally for a final smoke check before deploying.

## 4. Pre-release manual QA

- [ ] **Release gate** — Responsive QA at 390px, 768px, and 1440px on a real device or browser DevTools (this session's sandboxed browser could not resize its viewport, so breakpoints above mobile were only verified via code review of the Tailwind `sm:`/`md:`/`lg:` classes, not visually).
- [ ] **Release gate** — Authenticated two-account cross-user isolation test: create a second real account, confirm it cannot view, select, or feedback on the first account's projects/concepts, and that attempting a foreign project id returns the same generic not-found response as a nonexistent id (never a distinguishable "exists but forbidden").
- [ ] Authentication test: sign-up, email confirmation, sign-in, sign-out, and protected-route redirect (including that a deep link's `next=` target is honored after login).
- [ ] One controlled paid Gemini generation smoke test after deployment — a single real request, Fast mode, Reviewer disabled, with explicit approval immediately before dispatch (see the workflow already used for this project's E2E verification).
- [ ] Persistence after hard refresh: reload a cloud project and a local draft; confirm source materials, concepts, and state survive.
- [ ] Selection and feedback persistence: select a concept and submit feedback, hard refresh, confirm both survive.

## 5. Rollback

Standard Vercel instant rollback: from the Vercel dashboard's Deployments list, promote the last known-good deployment back to production (or `vercel rollback` via CLI once linked). No database migration is tied to this release, so no schema rollback is needed. If a deploy is found broken after promotion, do not delete the bad deployment — keep it for postmortem, just stop routing production traffic to it.

## 6. Test-data cleanup

After the post-deploy smoke test is approved by a human, delete the smoke-test project (and any earlier retained E2E artifacts, e.g. the existing `E2E Cloud Test` project and local `Draft Save Test`/`Тестовый дом`/`Dev Source View Check` drafts) manually through the app UI or Supabase dashboard. Nothing is deleted automatically by this checklist or by any automated task.
