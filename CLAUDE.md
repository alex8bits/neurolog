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

- **Routes**: `routes/web.php` (public + dashboard), `routes/settings.php` (profile/security/appearance), `routes/api.php` (JSON API, see below), `routes/console.php`. Web auth routes (login, register, password reset, 2FA, passkeys) are **not in these files** — Fortify registers them; the corresponding Inertia views are wired up in `app/Providers/FortifyServiceProvider.php::configureViews()`. Rate limiters (`login`, `two-factor`, `passkeys`) are also defined there.
- **Shared Inertia props** (available on every page): defined in `app/Http/Middleware/HandleInertiaRequests.php::share()` — `name`, `auth.user`, `sidebarOpen`.
- **Middleware**: registered in `bootstrap/app.php` (no `Kernel.php` — Laravel 11+ style). `HandleAppearance` and `HandleInertiaRequests` are appended to the web group; `appearance` and `sidebar_state` cookies are excluded from encryption.
- **Flash toasts**: controllers call `Inertia::flash('toast', ['type' => 'success', 'message' => ...])`; the client picks it up in `resources/js/lib/flashToast.ts` (wired in `app.ts`) and shows it via `vue-sonner`.

### JSON API (`/api/v1`)
`routes/api.php` is mounted with `apiPrefix: 'api/v1'` in `bootstrap/app.php` — never repeat the prefix inside the file. Controllers live in `App\Http\Controllers\Api\V1\`, requests in `App\Http\Requests\Api\V1\`, resources in `App\Http\Resources\Api\V1\`; a new major version gets its own `V2` namespace rather than breaking `v1`. Exceptions render as JSON for `api/*` (`bootstrap/app.php`).

- **Auth endpoints** (public): `register`, `login`, `token/refresh`, `password/forgot`, `password/reset` — `Api\V1\AuthController`. Everything else (`logout`, `seizures/*`) sits behind `auth:sanctum`; there is **no** `web`/session middleware on API routes, so never call `Auth::attempt()` there — use `Auth::validate()`.
- **Tokens**: access tokens are Sanctum personal access tokens, refresh tokens are ours (`refresh_tokens` table, SHA-256 hashes, `revoked_at`). Issue, rotate and revoke them **only** through `App\Services\TokenService` — controllers never touch Sanctum or `RefreshToken` directly. Both lifetimes come from `config/sanctum.php` (`expiration`, plus our own `refresh_expiration`); never read them via `env()` at runtime.
- **Fortify reuse**: API registration and password reset go through the same `app/Actions/Fortify/` actions as the web. Those actions re-validate their input with a `confirmed` rule, so pass `password_confirmation` explicitly — `$request->validated()` drops it.
- **Owner scoping**: user-owned records are always resolved through the authenticated user (`$request->user()->seizures()`), never from a route parameter.

### Wayfinder (typed routes/actions — generated, do not hand-edit)
`resources/js/routes/`, `resources/js/actions/`, and `resources/js/wayfinder/` are **generated by Laravel Wayfinder** from PHP routes/controllers and are gitignored. Import route/action helpers from `@/routes/...` and `@/actions/...` for type-safe URLs and form bindings instead of hardcoding paths. They regenerate on build and via the Vite plugin (`vite.config.ts`) — never edit them by hand; change the PHP route/controller instead.

### Frontend layout resolution
`resources/js/app.ts` picks the layout by page name: `Welcome` → none, `auth/*` → `AuthLayout`, `settings/*` → `[AppLayout, SettingsLayout]` (nested), everything else → `AppLayout`. `@/*` resolves to `resources/js/*` (see `tsconfig.json`).

- `pages/` — one Vue component per Inertia page
- `layouts/` — app/auth/settings layout variants
- `components/ui/` — shadcn-vue primitives (managed via `components.json`; add with the shadcn-vue CLI); `components/` — app-specific components
- `composables/` — `useAppearance` (light/dark theme, persisted to cookie + localStorage), `useTwoFactorAuth`, etc.

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
