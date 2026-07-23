# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Campulse is an Angular 21 frontend for a trading journal / portfolio tracker. It talks to a FastAPI backend (sibling repo `campulse-backend`) hosted at `https://campulse-backend.fastapicloud.dev` — the base URL is hardcoded in `src/app/app.constants.ts` (there is no environments file).

The matcher consumes the **cheapest open buy lots first** (best-profit: maximise realised P/L per sale) — it is **not** LIFO. The old misleading "LIFO" naming has been purged from code and copy (backend: `services/best_profit_matcher.BestProfitMatcherService.match_sell` / `simulate_sell`); don't reintroduce it.

## Commands

```bash
npm install          # install dependencies
npm start            # dev server at http://localhost:4200 (ng serve)
npm run build        # production build (default configuration) to dist/
npm test             # unit tests via Vitest (ng test, @angular/build:unit-test builder)
ng test --include src/app/app.spec.ts   # run a single spec file
```

Formatting is Prettier (`.prettierrc`): 100 char width, single quotes, Angular parser for HTML.

Gotchas:
- `npm run build` (production) **inlines the Google Fonts stylesheet at build time** by fetching `fonts.googleapis.com` — it fails offline or behind a self-signed-cert proxy. `npm start` (dev config) does not inline fonts, so prefer it for local verification.
- The only spec is `src/app/app.spec.ts`. Its TestBed must provide `provideHttpClient()` + `provideHttpClientTesting()` + `provideRouter([...])` (include `dashboard`/`login`/`settings` stub routes so post-logout navigation resolves) + `provideTranslateService({ fallbackLang: 'en' })` — a component using `TranslatePipe` throws `NG0201: No provider for TranslateService` otherwise. jsdom has no layout/hit-testing, so CSS stacking/z-index/click bugs will NOT surface in specs; verify interactive fixes in a real browser.

## Architecture

Standalone components only (no NgModules); app bootstraps via `src/main.ts` → `app.config.ts` (`provideRouter`, `provideHttpClient(withInterceptors(...))`). All API response shapes are typed in `src/app/models.ts` (they mirror the backend serializers — keep them in sync with campulse-backend). Shared constants (backend URL, Google client ID, localStorage key) live in `src/app/app.constants.ts`.

File naming follows the modern Angular style without the `.component` suffix: `pages/dashboard/dashboard.ts` + `dashboard.html` exporting `DashboardComponent`.

### Service layer (`src/app/services/`)

- **`SessionService`** — auth/session store. `googleProfile` (signal, null = guest) is the single source of truth, now including the backend-issued JWT and role; `activeUserId` and `isGuest` are `computed` from it. Session persists in localStorage (`google_profile`) and is restored on construction.
- **`ApiService`** — pure typed HTTP client for the backend endpoints. It does NOT attach auth headers.
- **`GoogleAuthService`** — owner of two login paths: real Google Identity Services (GSI) integration (script-readiness retries, `initialize`, button rendering, credential → `/api/auth/google` → `SessionService.setProfile`) and `demoLogin()` (→ `/api/auth/demo`, same response shape, used by the login page's demo backdoor). Both mint a real JWT — there is no local-only fake session anymore.
- **`TelegramAuthService`** — third login path via the Telegram Login Widget (injected script that renders its own button and calls a global `onTelegramAuth` callback → `/api/auth/telegram` → same profile shape). Bot username lives in `app.constants.ts` (`TELEGRAM_BOT_USERNAME`); the widget only renders on the domain registered with @BotFather (`/setdomain`), so the button is invisible on localhost. Telegram logins are keyed `str(telegram user id)` — the same convention as the Telegram bot, so bot-created accounts and web logins share one portfolio. When the site runs inside the Telegram **Mini App** (telegram-web-app.js in `index.html` populates `window.Telegram.WebApp.initData`), the root `App` constructor calls `autoLoginFromWebApp()` → `/api/auth/telegram-webapp` for a silent sign-in.
- **`authInterceptor`** (`src/app/interceptors/auth.interceptor.ts`) — attaches `Authorization: Bearer <token>` from `SessionService.googleProfile()?.token` to every backend request; guests (no profile) send no header. The backend verifies this JWT on every request (see `campulse-backend`'s `get_current_user`/`require_admin` deps) — it is no longer trust-on-header.

### Account identity & linking

Google is the **canonical account** (`userId = google_sub`, carried in the JWT `sub`). A Telegram id (bot + Login Widget + Mini App) is an **alias** that resolves to a Google account once linked — the backend's `resolve_primary()` maps an alias to its primary at every login and at bot-write time, so a linked Telegram user reads/writes the same portfolio as their web login. Unlinked ids resolve to themselves. The `pages/settings/settings.ts` **"Connected accounts"** page (route `/settings`, `authGuard`, reachable from the profile dropdown) is where a signed-in user links Telegram: it calls `POST /api/auth/link/code` → opens `t.me/CamboPulseBot?start=<code>` → the bot's `/start <code>` redeems the one-time code and links `telegram_id → google_sub` (migrating any pre-link bot trades). `GET/DELETE /api/auth/links` list and disconnect. Related `ApiService` methods: `createLinkCode`, `getLinks`, `removeLink`; models `LinkCodeResponse`, `LinkedAccount`.

`SessionService.isAdmin` (computed from `googleProfile()?.role === 'admin'`) gates the `/admin` route and its nav link. `adminGuard` (`src/app/guards/admin.guard.ts`) mirrors `authGuard` but checks `isAdmin()` and redirects non-admins to `/dashboard` instead of `/login`. `pages/admin/admin.ts` lets an admin view all users (with a promote/demote button per row, disabled for their own row), all trades across users, and aggregate stats — backed by `campulse-backend`'s `/api/admin/*` endpoints. It also hosts the **gold price board** and the **corporate-actions card** (`getCorporateActions`/`createCorporateAction`/`deleteCorporateAction`; model `CorporateAction`): register a bonus issue or forward split (symbol, market, type, new:held ratio, ex-date) and a backend daemon adjusts every holder's open lots on the ex-date — shares up, average cost down, portfolio value unchanged — and rescales their price alerts. Pending actions can be deleted; applied ones are immutable (409). Bonus/split rows carry `Trade.corpActionId`, shown as a 🎁 BONUS badge in History.

### Multi-market (markets & currency)

Trades and holdings carry a `market` (`CSX` | `US` | `GOLD_KH`) and `currency` (`KHR` | `USD`) — see `models.ts` and the backend `markets.py`. **Never hardcode "riel" for money** — use the `MoneyPipe` (`src/app/utils/money.ts`, `{{ value | money:currency }}`, or `:currency:true` for a signed +/−): KHR renders whole with `៛`, USD with a leading `$` and cents. `pages/record-trade` has a market picker — CSX uses the live-ticker dropdown, US does a Finnhub symbol search (`ApiService.searchSymbols` → `getMarketQuote`), gold is the fixed `XAU-KH` instrument priced per *chi*; the payload includes `market`/`currency`. `pages/portfolio` groups totals **per currency** (`currencySummaries`, no FX blending) and formats every amount via `MoneyPipe`. Gold has no live feed: an admin sets the daily board on `pages/admin` (`ApiService.setManualPrice` → `PUT /api/admin/manual-price`). **Known gaps (not yet currency-aware):** the portfolio equity/allocation charts and the yearly-P/L report still aggregate in a KHR-centric way; US quotes need `FINNHUB_API_KEY` set in the backend env.

### Analytics, Watchlist & News

Three real features (they replaced the `Analytics 👑` / `Watchlist 👑` sidebar teasers — `AI Coach` + `Journal` stay premium). `pages/analytics` (`GET /api/analytics`) shows descriptive stats — win rate, avg hold time, best/worst closed trade, and a **per-currency** roll-up (never blended). `pages/watchlist` (`GET/POST/DELETE /api/watchlist`) tracks unowned symbols with live quotes routed per market (add via a CSX/US/gold picker), and expands **Finnhub company news** (`GET /api/market/news/{symbol}`) for US rows — news is US-only and needs `FINNHUB_API_KEY` on the backend. Both routes are `authGuard`-protected and reachable from the desktop sidebar and the mobile account sheet. Related `ApiService`: `getAnalytics`, `getWatchlist`/`addWatchlist`/`removeWatchlist`, `getSymbolNews`; models `Analytics`, `WatchlistItem`, `NewsItem`.

`pages/alerts` (`GET/POST/DELETE /api/alerts`) sets one-shot **price alerts** delivered via the user's **linked Telegram** — a backend daemon polls quotes and messages the chat when a symbol crosses the target. The page warns (`deliverable` flag) when no Telegram is linked, linking to `/settings`. Direction (above/below) is inferred from the current price server-side. `ApiService`: `getAlerts`/`createAlert`/`removeAlert`; model `PriceAlert`. `pages/journal` (`PATCH /api/trades/{id}/journal`) is the reflection layer — a free-text note + comma-separated tags per trade, editable inline on any trade (metadata, so allowed on SELL/matched trades). Reuses `getTrades` (paginated) with a client-side tag filter; `Trade` gained `note`/`tags`; `ApiService.updateJournal`. Analytics/Watchlist/Alerts/Journal/AI Coach all sit under a **Tools** sidebar group — there are no premium teaser links left (the premium modal survives only behind the mobile sheet's "Upgrade" entry).

`pages/ai-coach` (route `/ai-coach`, `authGuard`) is the **Coach**: `GET /api/ai/insights` returns a free rule-based readout of the user's own patterns (computed server-side from analytics, no API key or billing involved — see campulse-backend `rule_coach.py`), plus an optional cached AI pass. The AI regenerate is `POST /api/ai/insights` behind an explicit button — **it must never fire on page load** (it costs real money server-side; 429 = daily rate limit with a retry time in `detail`, 503 = no `ANTHROPIC_API_KEY` configured, and the page hides the whole AI panel when `aiEnabled` is false). Both readouts are descriptive-only — never render them as buy/sell advice, and always show the server-sent `disclaimer`. `ApiService`: `getCoachInsight`/`refreshCoachInsight`; models `CoachInsight`, `CoachAiInsight`, `CoachRefreshResponse`.

`pages/loans` (route `/loans`, `authGuard`, Tools group) is the **personal loan ledger** — money `lent`/`borrowed` with a named person, **entirely separate from trading** (never P/L or holdings). Two sections (*Owed to me* / *I owe*) with **per-currency** outstanding subtotals (never blended), a create form, and a repayment drawer; `outstanding`/`status` (open/partial/settled → coloured badge) come from the backend. Recording a repayment surfaces a notice noting whether a **forwardable Telegram receipt** was sent (`receiptSent`), and the page warns via the `deliverable` flag when no Telegram is linked. `ApiService`: `getLoans`/`getLoanSummary`/`createLoan`/`deleteLoan`/`getRepayments`/`addRepayment`/`deleteRepayment`; models `Loan`, `LoanRepayment`, `LoanSummaryRow`, `RepaymentResult`. Note the pre-existing public `/loan-calculator` is an unrelated client-side tool.

### Reactive data loading — no page reloads

Pages declare their data with `rxResource` keyed on `session.activeUserId()` (e.g. `dashboard.ts`, `portfolio.ts`, `history.ts`), so login/logout/user-switch refetches everything automatically — do NOT reintroduce `window.location.reload()` or one-shot `ngOnInit` loading for user-scoped data. `rxResource` is still marked `@experimental` in Angular 21; its `params`/`stream` option names have changed between majors, so check the signature when upgrading Angular. `record-trade.ts` is intentionally imperative (event-driven form flow with an init→confirm two-phase submit).

Templates use the modern `@if (x; as y)` / `@for ... @empty` control flow — required because `strictTemplates` won't narrow repeated signal calls like `pos().field`.

### Authentication flow

- GSI script loads in `src/index.html`; the root `App` component re-renders the header sign-in button via an `effect()` whenever `isGuest()` flips (the `#googleBtn` container only exists while signed out). The login page renders its own button into `#googleBtnWall`.
- `authGuard` (`src/app/guards/auth.guard.ts`) protects `portfolio`, `record-trade`, and `history` routes; guests are redirected to `/login` with a `returnUrl` query param. `dashboard` and `login` are public; unknown routes redirect to `dashboard`.

### Internationalization (i18n)

All UI strings go through `@ngx-translate`. `app.config.ts` wires `provideTranslateService` with an HTTP loader reading `public/assets/i18n/{en,km}.json` (English + Khmer), `fallbackLang: 'en'`. Templates use the `TranslatePipe` (`{{ 'SOME.KEY' | translate }}`); imperative strings (e.g. `confirm()` dialogs) use `TranslateService.instant('KEY')`. `App.switchLanguage()` sets the language and persists it under localStorage `lang` (restored in the `App` constructor). When you add UI text, add the key to **both** json files, and ensure the component `imports: [TranslatePipe]`.

### Styling, theming & mobile layout

Styling is essentially one global stylesheet, `src/styles.css` (~3600 lines) — per-component `.css` files are mostly empty, and several templates (notably `portfolio`, `record-trade`) use heavy inline `style=`. There is no thorough CSS-variable design system; colors are largely literal hex.

- **Theme**: `ThemeService` toggles a `light` class on `<body>` (dark is the default, persisted under localStorage `theme`). Light mode is implemented as `body.light .foo { ... }` overrides — when you add a new surface, add its light-mode override too. Inline dark backgrounds in templates can't be beaten by a plain stylesheet rule; use `!important` overrides (see the existing `body.light ... !important` cases) or move the style to a class.
- **Mobile** (`≤768px`): the desktop `.sidebar` is hidden entirely and replaced by a purpose-built `.mobile-bottom-nav` (in `app.html`) — five flat slots: Dashboard, Portfolio, an elevated center **`.mbn-fab`** for Record Trade (the primary action), History, and **Account**. Account (`toggleMobileAccount()`) opens the `.mobile-account-sheet` bottom sheet (Settings, a single Upgrade-to-Premium entry, Admin if `isAdmin()`, Sign out) — it absorbs what used to be the desktop "Trades" submenu + "More" popup + the topbar profile dropdown, so the topbar `.mobile-profile` avatar is also hidden on phones. Desktop nav (collapsible Trades group, `.secondary-nav-group` with Premium/Settings/Admin, sidebar footer) is unchanged. Breakpoints in use: 768 (primary), 860, 1024, 480. Zoom is disabled (`user-scalable=0` in `index.html` + `touch-action: manipulation`), and `body { overflow-x: hidden }` guards against stray sideways scroll — so an over-wide element gets **clipped, not scrollable**; wrap wide tables in `.table-container` (has `overflow-x: auto`).

### Notable page behaviors

- **Charts** (`chart.js` dependency): `dashboard.ts` (performance/equity line) and `portfolio.ts` (allocation donut) build `Chart` instances against `<canvas #ref>`. Destroy/recreate on data change and keep canvases inside a sized `.chart-container`.
- **History** (`history.ts`) is server-paginated: `api.getTrades(ticker, limit, offset)` returns `Paginated<Trade>` driving `components/pager`; CSV export walks all pages client-side (200/page). It also has an inline edit drawer (`updateTrade`) and `deleteTrade`.
- **Avatars**: the session profile carries an optional `picture` — Google's is decoded client-side from the ID-token JWT `picture` claim (display-only; the token is still verified server-side), Telegram's is `photo_url`. Templates render `<img class="avatar-img" (error)="onAvatarError()">` with an initials fallback.

### TypeScript strictness

`tsconfig.json` enables full strict mode plus `strictTemplates`, `noImplicitReturns`, and `noPropertyAccessFromIndexSignature` — template type errors fail the build.

## Response style
- Keep chat replies short (1–3 lines) to save tokens. Do the work; skip long recaps/option surveys.
