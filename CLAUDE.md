# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Laravel 13 (PHP 8.3) + Inertia.js v3 + Vue 3 (`<script setup>` + TypeScript) SPA. UI is Tailwind CSS v4 with shadcn-vue components (reka-ui primitives). Web auth is handled by **Laravel Fortify** (session + cookie) with passkey (`@laravel/passkeys`) and two-factor support; the mobile-facing JSON API under `/api/v1` is stateless and authenticated by **Laravel Sanctum** tokens. Default DB is SQLite (`database/database.sqlite`). Built with Vite; PHP-side routes are mirrored to typed TS via **Laravel Wayfinder**.

This is a Laravel starter kit — most of the codebase is scaffolding. Application-specific features are added on top.

## Commands

Run from repo root. On this machine the app is served by OpenServer (Windows); `php`/`composer`/`npm` must be on PATH.

- `composer dev` — run server + queue listener + Vite dev server concurrently (the normal way to develop)
- `npm run dev` — Vite only
- `npm run build` — production build; `npm run build:ssr` for SSR bundle
- `composer setup` — first-time setup (install deps, generate key, migrate, build)

### Checks (match CI — `composer ci:check` runs all of these)
- `composer lint` / `composer lint:check` — Pint (PHP formatting, Laravel preset)
- `npm run lint` / `npm run lint:check` — ESLint
- `npm run format` / `npm run format:check` — Prettier over `resources/`
- `composer types:check` — PHPStan/Larastan (level in `phpstan.neon`)
- `npm run types:check` — `vue-tsc --noEmit`

### Tests (PHPUnit, not Pest) — minimal coverage, see Conventions
- `php artisan test` — full suite
- `php artisan test --filter=ProfileUpdateTest` — single test class/method
- `php artisan test tests/Feature/Auth/AuthenticationTest.php` — single file
- `composer test` — clears config, runs lint:check + types:check + the test suite

Tests use an in-memory SQLite DB (see `phpunit.xml`). Tests live in `tests/Feature` and `tests/Unit`; `Tests\TestCase` exposes `skipUnlessFortifyHas()` for feature-gated Fortify tests.

## Architecture

### Request flow
Backend renders no Blade views for pages — controllers return `Inertia::render('PageName', $props)`, which maps to a Vue component under `resources/js/pages/`. The single Blade view is `resources/views/app.blade.php` (root template, set in `HandleInertiaRequests`).

- **Routes**: `routes/web.php` (public + dashboard), `routes/settings.php` (profile/security), `routes/api.php` (JSON API, see below), `routes/console.php`. Web auth routes (login, register, password reset, 2FA, passkeys) are **not in these files** — Fortify registers them; the corresponding Inertia views are wired up in `app/Providers/FortifyServiceProvider.php::configureViews()`. Rate limiters (`login`, `two-factor`, `passkeys`) are also defined there.
- **Shared Inertia props** (available on every page): defined in `app/Http/Middleware/HandleInertiaRequests.php::share()` — `name`, `auth.user`.
- **Middleware**: registered in `bootstrap/app.php` (no `Kernel.php` — Laravel 11+ style). `HandleInertiaRequests` is appended to the web group. There is no theme middleware or cookie: the light theme is the only one.
- **Flash toasts**: controllers call `Inertia::flash('toast', ['type' => 'success', 'message' => ...])`; the client picks it up in `resources/js/lib/flashToast.ts` (wired in `app.ts`) and shows it via `vue-sonner`.

### JSON API (`/api/v1`)
`routes/api.php` is mounted with `apiPrefix: 'api/v1'` in `bootstrap/app.php` — never repeat the prefix inside the file. Controllers live in `App\Http\Controllers\Api\V1\`, requests in `App\Http\Requests\Api\V1\`, resources in `App\Http\Resources\Api\V1\`; a new major version gets its own `V2` namespace rather than breaking `v1`. Exceptions render as JSON for `api/*` (`bootstrap/app.php`).

- **Auth endpoints** (public): `register`, `login`, `token/refresh`, `password/forgot`, `password/reset` — `Api\V1\AuthController`. Everything else (`logout`, `seizures/*`) sits behind `auth:sanctum`; there is **no** `web`/session middleware on API routes, so never call `Auth::attempt()` there — use `Auth::validate()`.
- **Tokens**: access tokens are Sanctum personal access tokens, refresh tokens are ours (`refresh_tokens` table, SHA-256 hashes, `revoked_at`). Issue, rotate and revoke them **only** through `App\Services\TokenService` — controllers never touch Sanctum or `RefreshToken` directly. Both lifetimes come from `config/sanctum.php` (`expiration`, plus our own `refresh_expiration`); never read them via `env()` at runtime.
- **Fortify reuse**: API registration and password reset go through the same `app/Actions/Fortify/` actions as the web. Those actions re-validate their input with a `confirmed` rule, so pass `password_confirmation` explicitly — `$request->validated()` drops it.
- **Summary**: `GET /api/v1/seizures/summary` returns `timezone`, `today`, `days` (30 entries `{date, count}`) and `period` (`from`, `to`, `total`, `days_with_seizures`). It is built by `App\Services\SeizureSummaryBuilder` (DTO `App\Support\SeizureSummary`), the same calculation the web journal receives as the `summary` prop.
- **Medications**: `GET|POST /api/v1/medications`, `PATCH|DELETE /api/v1/medications/{id}` (`Api\V1\MedicationController`). Filters: `q`, `from`, `to`, `status`; pagination `per_page` (1–100, default 20); `timezone` decides what «today» is. `dosage` is a string with 2 decimals (`"750.00"`). `status` (`planned|active|finished`) is computed from «today» via `MedicationQuery::todayFor()`. On `GET`, «today» is the `timezone` parameter (the device) or, without it, the owner's profile timezone. `POST`/`PATCH` have no `timezone` parameter and always use the profile timezone, so their badges match the profile day. The status rule lives in `App\Enums\MedicationStatus` (`forDates` for PHP, `constrain`/`rankSql` for SQL). The sort keys inside the groups in `MedicationQuery` (`PLANNED_ORDER`, `ACTIVE_ORDER`, `FINISHED_ORDER`) repeat the same conditions in SQL: when the rule changes, change both `MedicationStatus` and those keys. PHP/SQL agreement is covered by `tests/Unit/Enums/MedicationStatusTest.php`, the order by `tests/Unit/Services/MedicationQueryTest.php`. Name search runs on the `name_search` column (lowercase copy of `name`, filled by the `saving` hook of `Medication`); LIKE is escaped with `ESCAPE '!'` (works on SQLite and MySQL). Writes go through `App\Services\MedicationWriter`, reads through `App\Services\MedicationQuery`; validation rules live in the `App\Concerns\MedicationValidationRules` trait. Medications are online-only and have no `client_id`.
- **Period report** (`App\Support\SeizurePeriodReport`): covers every day of the period up to today (the effective period never runs past today). Blocks are built by `App\Support\ReportTimeline` (items are `App\Support\ReportBlock`): a day with seizures is its own block, consecutive days without seizures and with the same set of medications merge into one «Без приступов» interval (the rules are in `ReportTimeline`). Dosage is formatted by `App\Support\MedicationDosage::format` (`750мг`, `2,5мл`). `totalEntries` still counts seizures only.
- **Idempotent create**: `POST /api/v1/seizures` accepts an optional `client_id` (UUID, unique per user); a repeat with the same `client_id` returns the owner's existing record (even soft-deleted) instead of creating a second row. `SeizureResource` exposes `client_id`.
- **Owner scoping**: user-owned records are always resolved through the authenticated user (`$request->user()->seizures()`), never from a route parameter.

### Wayfinder (typed routes/actions — generated, do not hand-edit)
`resources/js/routes/`, `resources/js/actions/`, and `resources/js/wayfinder/` are **generated by Laravel Wayfinder** from PHP routes/controllers and are gitignored. Import route/action helpers from `@/routes/...` and `@/actions/...` for type-safe URLs and form bindings instead of hardcoding paths. They regenerate on build and via the Vite plugin (`vite.config.ts`) — never edit them by hand; change the PHP route/controller instead.

### Frontend layout resolution

`resources/js/app.ts` picks the layout by page name: `auth/*` → `AuthLayout`, `settings/*` → `[AppLayout, SettingsLayout]` (nested), everything else (including `Journal`, `Feedback`, `Medications`) → `AppLayout`. `@/*` resolves to `resources/js/*` (see `tsconfig.json`).

- `pages/` — one Vue component per Inertia page (`Journal`, `Feedback`, `Medications`, `auth/*`, `settings/*`)
- `layouts/` — `AppLayout.vue` wraps `layouts/app/AppHeaderLayout.vue`: a top header bar (`components/AppHeader.vue`, content max width 1240px). There is no sidebar. Plus `AuthLayout` and the settings layout. The header nav is `mainNavItems` in `components/AppHeader.vue` («Журнал», «Медикаменты», «Обратная связь»).
- `components/ui/` — shadcn-vue primitives (managed via `components.json`; add with the shadcn-vue CLI); `components/` — app-specific components (`components/journal/` for the journal: left panel `JournalPanel`, `WeekStrip`, `MonthStrip`, `SeizureRow`, `SeizureRowMenu`; `components/medications/` for the medications page: `MedicationFilters`, `MedicationFormDialog`, `DeleteMedicationDialog`, `MedicationRowMenu`, `MedicationStatusBadge`)
- `composables/` — `useAppDownload`, `useCurrentUrl`, `useInitials`
- Styling: design tokens live in `resources/css/app.css` (shadcn variables on the «Спокойный день+» palette, plus `--sun`, `--primary-soft`, `--success`, `--strip-0..3`). Font is Manrope, loaded via the Bunny fonts plugin in `vite.config.ts`.

### Mobile app (`mobile/`)

Expo (React Native, Android-only) client with its own [`mobile/README.md`](mobile/README.md). Colors, radius, spacing and type scale live only in `mobile/src/theme/tokens.ts` — no hex colors anywhere else (screens and components use the tokens and the primitives in `mobile/src/components/ui/`). Bottom tabs are `mobile/app/(tabs)/` (Журнал `index` at route `/`, Медикаменты `medications`, Отчёт `report`, Профиль `profile`); the other screens live in `mobile/app/(journal)/` and open above the tabs. «Медикаменты» are online-only, like Отчёт and Профиль — the offline layer does not touch them. The medication form screen is `(journal)/medication` (create, edit, delete).

Offline mode lives in `mobile/src/offline/`: `journalStore` (30-day `journal-cache.json` + `outbox.json`, bound to the owner's email, cleared on logout), `sync` (`recordSeizure` writes to the outbox first, single-flight `flush`) and `ConnectivityContext` (`online`, unsent counts, sync triggers). Every new seizure goes through `recordSeizure`, never `createSeizure` directly.

### Auth model
`app/Models/User.php` uses PHP-attribute config (`#[Fillable]`, `#[Hidden]`) rather than `$fillable`/`$hidden` properties, and implements `PasskeyUser` with `HasApiTokens` + `TwoFactorAuthenticatable` + `PasskeyAuthenticatable` traits; it owns `seizures()` and `refreshTokens()`. Fortify actions (`CreateNewUser`, `ResetUserPassword`) live in `app/Actions/Fortify/`; validation rules are shared via traits in `app/Concerns/`.

## Conventions

- **Minimal test coverage.** Tests are written, but deliberately few. Per feature:
  - **Feature (`tests/Feature/`)** — at most **one happy-path smoke test per endpoint or page**, plus one authorization smoke per protected route group (guest → 401/redirect). Nothing else: no validation matrices, no error-code tables, no repeated permutations.
  - **Unit (`tests/Unit/`)** — only for logic that can genuinely break in a non-obvious way: time/timezone normalization, period boundaries, token rotation and expiry, and similar branchy rules. One test per branch that matters.
  - **Do not test**: framework behavior (casts, relations, fillable, routing), thin controllers that only delegate, getters/DTOs, third-party packages (Fortify, Sanctum), or anything already covered by a sibling test.
  - When in doubt, leave the test out and say so in the report — a missing test is cheaper than a suite nobody trusts.
- PHP formatting is enforced by Pint (Laravel preset) — run `composer lint` before committing.
- Prefer typed Wayfinder route/action imports over string URLs in Vue components.
- Keep controllers thin and returning `Inertia::render(...)` or redirects; put page props there.
- When adding a page: create the controller/route → the `resources/js/pages/*.vue` component → rely on Wayfinder for the URL. If the new page needs a layout other than the default, account for it in `app.ts`'s layout switch.
- Two-factor / passkey behavior is Fortify-driven; wire new **web** auth views through `FortifyServiceProvider`, not `routes/`. API auth endpoints are ours and live in `routes/api.php`.
- New API endpoints go under `/api/v1` with an `Api\V1` controller, a FormRequest and a Resource — no raw arrays or models in responses.
