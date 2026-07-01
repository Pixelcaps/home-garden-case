# ItpHomeGarden

This repository uses an [Nx Monorepo](https://nx.dev/) setup, feel free to add you frontend inside this repository or create a separate repository.

## Prerequisites

You have Node.js installed on your machine and ran:

```sh
npm install
```

## Run backend

To run the backend, you can use this command

```sh
npx nx dev api
```

Once it's running, you can check out the api specs at http://localhost:3000/docs

## How to add your frontend

You can use the [Nx Docs](https://nx.dev/docs/technologies) to add your frontend to this repository.
For example, to add Remix, run this:

```sh
npx nx add @nx/remix
npx nx g @nx/remix:app apps/web
```

After installation, you can run the web application using:
```sh
npx nx dev web
```

---

# 🌱 Home Garden — solution

A small full-stack app for managing home gardens and the plants in them, built on top of the provided Fastify API. The backend is **intentionally slow and flaky** (≈10% of requests fail, 200–2000 ms latency); the headline of this project is a frontend that stays fast and error-free anyway.

> The frontend lives in `apps/web` (a new React Router app), the given backend in `apps/api` (lightly extended), with shared domain logic in `libs/shared`.

## Quick start

```bash
npm install
cp .env.example .env   # local config — Nx auto-loads it for its tasks
```

Then start the two apps in separate terminals:

```bash
npx nx dev api   # terminal 1 — wait for "[ ready ] http://localhost:3000"
npx nx dev web   # terminal 2
```

- App → **http://localhost:4200** (redirects to `/gardens`)
- API docs (Swagger) → **http://localhost:3000/docs**

`.env` provides `API_BASE_URL`, `API_BEARER_TOKEN`, and `DEFAULT_USER_ID` (documented in `.env.example`). The same bearer token gates the API and is attached server-side by the web BFF, so set both to the same value — or clear it in both to run the API ungated. (You can also pass the vars inline instead: `API_BEARER_TOKEN=… npx nx dev api`.)

**Tests:** `npx nx run-many -t test -p web shared` · **Build:** `npx nx run-many -t build -p web api`

## Tech stack

| Area | Choice | Why |
|---|---|---|
| Monorepo | **Nx** | Already the project's setup; one place for api + web + shared |
| Frontend | **React Router v7** (framework mode, SSR) | The brief asked for Remix/Next; **React Router v7 is Remix's successor** (Remix 2 merged into it). Server loaders/actions give us a natural backend-for-frontend. |
| Styling | **Tailwind v4** + hand-rolled primitives | The brief sets a low UI bar; keeps deps minimal and fits the server-action form model |
| Shared logic | **`libs/shared`** (framework-free TS) | One source of truth for DTO types + the capacity rules, used by both API-facing validation and the UI |
| Tests | **Vitest + Testing Library + MSW** | Unit + route tests; MSW lets us test the resilient client against a simulated flaky API |
| Backend (given) | Fastify 5, Kysely, better-sqlite3, Zod 4 | Extended, not replaced — see [Backend changes](#backend-changes) |

## Architecture

```
Browser ──▶ apps/web  (React Router v7, SSR)
              │  loaders (reads) / actions (writes) run server-side = BFF
              │  └─ resilient API client: retry · cache (+ stale-while-revalidate) · de-dup · bearer token
              ▼
           apps/api  (Fastify)  ──▶  SQLite (Kysely)
              ▲
        libs/shared  ── DTO types + capacity rules (surface area + humidity) ── imported by web & tests
```

The browser only ever talks to **our** React Router server; that server talks to Fastify. This single decision is what makes everything else work:

- the **bearer token stays server-side** (never shipped to the browser),
- the **cache is shared** across all users/sessions, and
- the slow/flaky API is **absorbed server-side**, so the browser sees one fast response.

### Why a server-side data layer (and not TanStack Query)

The obvious way to add caching/retry on the client is TanStack Query or SWR — both client-side. We deliberately kept the data layer **server-side** (React Router loaders/actions) so the bearer token stays off the client and the cache is shared rather than per-browser. The cost is that we hand-rolled a small resilient client instead of importing one; see [Performance](#resilience--performance) for the production alternative.

## The three gaps (assignment vs. provided backend)

The brief asks for things the given backend didn't support. Each was a deliberate decision:

1. **Garden "target humidity" (0–100)** — didn't exist (only plants had `idealHumidityLevel`). **Resolved by extending the backend**: added a `targetHumidity` column + schema, surfaced in the UI. It also powers a new domain rule (below).

2. **"All gardens linked to the user account"** — there was no link between users and gardens, and no auth. **Resolved by wiring the real relationship** (`garden.userId` FK → `user`) while operating as a **single seeded "implicit user"** (id 1). A new endpoint `GET /gardens/user/:userId` backs the overview. This makes the schema honest without building auth; the implicit-user id is the one line a real session would replace.

3. **"Use the given token to authenticate"** — the backend shipped no auth and no token. **Resolved with a real-but-coarse BFF token gate** (see [Authentication](#authentication)) plus a documented design for full per-user auth.

## Domain rules

A garden imposes **two capacity constraints** on its plants, enforced on the server (source of truth) and mirrored live in the UI for instant feedback:

- **Surface area** — the sum of a garden's plants' `surfaceAreaRequired` may not exceed its `totalSurfaceArea` (inclusive). Already in the backend; the UI shows a live meter and disables **Add plant** when a garden is full.
- **Humidity band** *(added)* — a plant fits only if `|garden.targetHumidity − plant.idealHumidityLevel| ≤ 15`. After researching plant care, a ±15% tolerance models real compatibility. Enforced on plant create/update, mirroring the surface-area check.

**Editing a garden's target humidity warns rather than blocks** if it would strand existing plants (consistent with how the backend already treats surface area on garden edits). The warning is surfaced in three places, all derived from the same `checkHumidity` rule in `libs/shared`, so they can't drift:

- a **summary banner** on the garden detail page (*"N plants are outside the 35–65% humidity band…"*),
- the **ideal-humidity value shown in red** on each off-band plant's row, and
- an **"N off-band" badge** on the garden's overview card — so an incompatibility is visible without even opening the garden.

Both rules live in `libs/shared` and are the most heavily unit-tested code in the project. (The garden and plant forms capture every backend field, including the optional `latitude`/`longitude` coordinates, validated "both or neither" on the client to match the server.)

## Resilience & performance

This is the core of the project. The backend fails ~10% of requests and is slow on purpose; the app handles each problem with a distinct mechanism, all in `apps/web/app/lib/api/resilient-fetch.ts`:

| Problem | Mechanism |
|---|---|
| **500 / network errors** | **Retry with exponential backoff** (up to 3). 5xx + network errors retry; 4xx are surfaced immediately (an overcrowding message shouldn't be retried). `0.10⁴ ≈ 1-in-10,000` chance all attempts fail. |
| **Slowness (repeat reads)** | **Short-TTL in-memory cache** — most reads never touch the API. |
| **Slowness (cache expiry)** | **Stale-while-revalidate** — an expired entry is served *instantly* while a deduped background refresh updates it. |
| **Slowness (bursts)** | **In-flight de-duplication** — concurrent identical reads share one call. |
| **Slowness (fan-out)** | Loaders fetch in **parallel** (`Promise.all`), so latency is the slowest call, not the sum. |
| **Perceived wait** | Loading states (`useNavigation`) on the rare slow navigation. |

### Measured: two 10-minute stress tests

Continuous load against the live (chaotic) stack. The backend behaved identically in both runs (~10% errors, ~1.1 s average); the difference is purely the app's handling:

| Metric (overview page, full stack) | Before SWR | After SWR |
|---|---|---|
| User-facing errors | **0** | **0** |
| Average latency | 0.227 s | **0.014 s** |
| p99 latency | 3.192 s | **0.021 s** |
| Max latency | 3.412 s | **0.028 s** |
| Slow loads (cache miss) | 23 | **0** |

**A 10% backend failure rate produced 0 user-facing errors, and stale-while-revalidate collapsed the p99 from ~3.2 s to ~0.02 s** — the app responds like a static file while a broken backend churns underneath. The one residual is the unavoidable **cold start**: the first load of an endpoint (empty cache) still pays the API cost once (~1.9 s observed), after which every read is instant.

### What I'd reach for in production

The retry/cache/de-dup/SWR logic is hand-rolled (~100 tested, dependency-free lines) — good for showing the mechanics, but in production I'd compose two mature libraries instead: **`lru-cache`** (its `fetch`/`fetchMethod` gives TTL + de-dup + stale-while-revalidate as configuration, with a memory bound) wrapped by **`cockatiel`** (retry + circuit-breaker + timeout policies). The client-side batteries (TanStack Query) weren't a fit because of the server-side/token-hiding design; an HTTP-header cache (CDN / undici cache interceptor) wasn't a fit because the given API sends no `Cache-Control`.

## Authentication

The assignment says *"use the given token to authenticate and authorize the API,"* but the backend ships no auth and no token. What's honest here:

- **A token held by the browser would be security theater** — visible in DevTools to anyone using the app.
- **Our token is real-but-coarse because of the BFF.** Since loaders/actions run server-side, the bearer token (`@fastify/bearer-auth`) lives as a server env var, attached server-to-server, and **never reaches the browser**. That's a legitimate service-token boundary: the API only accepts calls from our backend-for-frontend. `/docs` stays open.
- **Per-user auth is the real goal, and it's theoretical here** (with a single implicit user it's moot). The production design: `@fastify/jwt` + a session cookie for login, password hashing for registration, `@fastify/auth` to compose authentication + per-garden ownership checks — at which point the hardcoded implicit-user id becomes the authenticated session user (a one-line swap, which is exactly why we wired the `userId` relationship properly).

## Backend changes

The API was extended, not rewritten — all additive:

- **Migration:** `garden.targetHumidity` (0–100) and `garden.userId` (FK → `user`, indexed); a seeded default user (id 1).
- **Endpoint:** `GET /gardens/user/:userId` (mirrors the existing `GET /plants/garden/:gardenId` path convention).
- **Validation:** plant↔garden humidity-band rule on create/update.
- **Auth:** `@fastify/bearer-auth` gate on the API routes (token from env; `/docs` open).

## Testing

Scope is *"useful coverage of critical business logic"* (per the brief) rather than 100%:

- **`libs/shared` capacity rules** — exhaustive boundary tests (inclusive edges, exclude-self-on-edit).
- **Resilient client** — retry, no-retry-on-4xx, cache, de-dup, 204, network-error retry, **and the SWR paths** (serve-stale, single-refresh dedup, keep-stale-on-failure) — against an MSW-simulated flaky API.
- **API module + loaders + actions** — correct endpoint wiring, loader aggregation, the off-band count, and that the server's overcrowding/humidity rejections surface as friendly inline messages.

**47 frontend/shared tests** in total (37 web + 10 shared). Backend changes were verified manually (build + Swagger/curl) since the repo had no test harness and the brief scoped tests to the frontend. The diff was also run through a simplification review before merge (deduplicating the humidity check, sharing the dialog fetcher hook) with no behaviour change.

## Project structure

```
apps/api        Fastify backend (given, extended) — routes, services, repositories, migrations
apps/web        React Router v7 app
  app/routes      gardens overview + garden detail (loaders/actions = the BFF)
  app/components  fetcher-driven dialogs + Tailwind UI primitives
  app/lib/api     resilient client, typed API module, server config
libs/shared     DTO types + capacity rules (surface area + humidity)
```

## Known limitations & future work

- **Cold start** still pays the API cost once per endpoint (the SWR caveat).
- **Forced light theme** — a deliberate scope decision over a full `dark:` pass.
- **Single implicit user** — the schema supports multi-user; real auth is the documented next step.
- **In-memory cache** is per-server-process; multi-instance deployments would move it to Redis (the SWR semantics carry over).
- **Production resilience** would swap the hand-rolled client for `lru-cache` + `cockatiel`.
