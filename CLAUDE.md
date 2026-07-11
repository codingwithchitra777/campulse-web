# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Campulse is an Angular 21 frontend for a trading journal / portfolio tracker (LIFO matching). It talks to a FastAPI backend hosted at `https://campulse-backend.fastapicloud.dev` — the base URL is hardcoded in `src/app/services/api.service.ts` (there is no environments file).

## Commands

```bash
npm install          # install dependencies
npm start            # dev server at http://localhost:4200 (ng serve)
npm run build        # production build (default configuration) to dist/
npm test             # unit tests via Vitest (ng test, @angular/build:unit-test builder)
ng test --include src/app/app.spec.ts   # run a single spec file
```

Formatting is Prettier (`.prettierrc`): 100 char width, single quotes, Angular parser for HTML.

## Architecture

Standalone components only (no NgModules); app bootstraps via `src/main.ts` → `app.config.ts` (`provideRouter`, `provideHttpClient(withInterceptors(...))`). All API response shapes are typed in `src/app/models.ts` (they mirror the backend serializers — keep them in sync with campulse-backend). Shared constants (backend URL, Google client ID, localStorage key) live in `src/app/app.constants.ts`.

File naming follows the modern Angular style without the `.component` suffix: `pages/dashboard/dashboard.ts` + `dashboard.html` exporting `DashboardComponent`.

### Service layer (`src/app/services/`)

- **`SessionService`** — auth/session store. `googleProfile` (signal, null = guest) is the single source of truth, now including the backend-issued JWT and role; `activeUserId` and `isGuest` are `computed` from it. Session persists in localStorage (`google_profile`) and is restored on construction.
- **`ApiService`** — pure typed HTTP client for the backend endpoints. It does NOT attach auth headers.
- **`GoogleAuthService`** — owner of two login paths: real Google Identity Services (GSI) integration (script-readiness retries, `initialize`, button rendering, credential → `/api/auth/google` → `SessionService.setProfile`) and `demoLogin()` (→ `/api/auth/demo`, same response shape, used by the login page's demo backdoor). Both mint a real JWT — there is no local-only fake session anymore.
- **`TelegramAuthService`** — third login path via the Telegram Login Widget (injected script that renders its own button and calls a global `onTelegramAuth` callback → `/api/auth/telegram` → same profile shape). Bot username lives in `app.constants.ts` (`TELEGRAM_BOT_USERNAME`); the widget only renders on the domain registered with @BotFather (`/setdomain`), so the button is invisible on localhost. Telegram logins are keyed `str(telegram user id)` — the same convention as the Telegram bot, so bot-created accounts and web logins share one portfolio. When the site runs inside the Telegram **Mini App** (telegram-web-app.js in `index.html` populates `window.Telegram.WebApp.initData`), the root `App` constructor calls `autoLoginFromWebApp()` → `/api/auth/telegram-webapp` for a silent sign-in.
- **`authInterceptor`** (`src/app/interceptors/auth.interceptor.ts`) — attaches `Authorization: Bearer <token>` from `SessionService.googleProfile()?.token` to every backend request; guests (no profile) send no header. The backend verifies this JWT on every request (see `campulse-backend`'s `get_current_user`/`require_admin` deps) — it is no longer trust-on-header.

`SessionService.isAdmin` (computed from `googleProfile()?.role === 'admin'`) gates the `/admin` route and its nav link. `adminGuard` (`src/app/guards/admin.guard.ts`) mirrors `authGuard` but checks `isAdmin()` and redirects non-admins to `/dashboard` instead of `/login`. `pages/admin/admin.ts` lets an admin view all users (with a promote/demote button per row, disabled for their own row), all trades across users, and aggregate stats — backed by `campulse-backend`'s `/api/admin/*` endpoints.

### Reactive data loading — no page reloads

Pages declare their data with `rxResource` keyed on `session.activeUserId()` (e.g. `dashboard.ts`, `portfolio.ts`, `history.ts`), so login/logout/user-switch refetches everything automatically — do NOT reintroduce `window.location.reload()` or one-shot `ngOnInit` loading for user-scoped data. `rxResource` is still marked `@experimental` in Angular 21; its `params`/`stream` option names have changed between majors, so check the signature when upgrading Angular. `record-trade.ts` is intentionally imperative (event-driven form flow with an init→confirm two-phase submit).

Templates use the modern `@if (x; as y)` / `@for ... @empty` control flow — required because `strictTemplates` won't narrow repeated signal calls like `pos().field`.

### Authentication flow

- GSI script loads in `src/index.html`; the root `App` component re-renders the header sign-in button via an `effect()` whenever `isGuest()` flips (the `#googleBtn` container only exists while signed out). The login page renders its own button into `#googleBtnWall`.
- `authGuard` (`src/app/guards/auth.guard.ts`) protects `portfolio`, `record-trade`, and `history` routes; guests are redirected to `/login` with a `returnUrl` query param. `dashboard` and `login` are public; unknown routes redirect to `dashboard`.

### TypeScript strictness

`tsconfig.json` enables full strict mode plus `strictTemplates`, `noImplicitReturns`, and `noPropertyAccessFromIndexSignature` — template type errors fail the build.
