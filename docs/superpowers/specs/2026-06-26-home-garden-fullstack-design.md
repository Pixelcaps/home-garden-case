# Home Garden — Full-Stack Design Spec

- **Date:** 2026-06-26
- **Branch:** `home-garden-case-assignment-implementation`
- **Status:** Approved (subject to refinement during implementation)

## 1. Context

Take-home case for In The Pocket. A Fastify + SQLite (Kysely) API for managing
gardens and plants already exists; the task is to build a **React meta-framework
frontend** for it. The API is **deliberately slow** (200–2000 ms/response,
`slow-api` plugin) and **deliberately flaky** (~10% of requests 500, `random-errors`
plugin) — the UX must stay smooth regardless.

The assignment also states three things the provided backend does **not** support,
which we resolved as design decisions (Section 3):
1. Each garden should have a configurable **target humidity level (0–100)** — no such field exists.
2. Show **all gardens linked to the user account** — no user↔garden relationship exists.
3. **"Use the given token to authenticate and authorize the API"** — the backend has no auth and ships no token.

## 2. Goals / non-goals

**Goals**
- A working garden + plant management UI over the existing API.
- Smooth UX despite the slow/flaky backend (resilient data layer).
- Enforce both garden capacity constraints with clear, friendly errors.
- Useful tests on critical business logic.
- A README documenting architecture, decisions, and the three gaps.

**Non-goals (out of scope)**
- Full per-user authentication / multi-user UI.
- End-to-end (Playwright) tests.
- Elaborate visual design.

## 3. Resolved decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| Gap 1 | Garden target humidity | **Extend backend**: add `garden.targetHumidity` (0–100, NOT NULL) | It's a "Full-Stack" case; a small clean migration beats client-side bolt-on |
| Gap 2 | User ↔ Garden link | **Wire real `garden.userId` FK**, but operate as a **single seeded implicit user** | Makes "gardens linked to the user account" honest in the schema without building auth |
| Gap 2b | Implicit user | **Seed a default user** in a migration (known id); web app uses it as current user via config | Deterministic, always-valid FK; README notes this is where a session user plugs in |
| Gap 2c | List a user's gardens | **`GET /gardens/user/:userId`** | Mirrors the repo's existing `GET /plants/garden/:gardenId` path-based convention |
| Gap 3 | Auth | **BFF bearer-token gate** (`@fastify/bearer-auth`, token server-side only) + **theoretical** per-user login in README | Token held by the RR server (never shipped to browser) is a real-but-coarse service boundary; full per-user auth stays theoretical as the brief intends |
| Domain | Humidity compatibility | New rule: `|garden.targetHumidity − plant.idealHumidityLevel| ≤ 15` on plant create/update; **garden edits warn, don't block** | Mirrors the existing surface-area constraint; warn-don't-block matches how the backend already treats surface area on garden edit |
| Data | Frontend data layer | **Approach A** — RR-native server-side loaders/actions + resilient typed client (retry/backoff, de-dup, shared TTL cache) | Browser never touches the flaky API; shared server cache earns the perf bonus; one coherent idiomatic story |
| UI | Component foundation | **Tailwind + hand-rolled primitives** (native `<select>`/`<dialog>`) | Small component surface, low UI bar, fits RR's server-action form model better than shadcn's RHF model |
| UI | Forms | **Fetcher-driven dialogs** (modal over the page, submit to an action, revalidate) | App-like, keeps the cached page visible under the slow API |
| UI | Overview layout | **Cards** with a surface-area meter | Showcases the capacity constraint at a glance |
| Test | Scope | **Frontend critical logic** (Vitest + RTL + MSW) | Matches "useful coverage of critical business logic" |

## 4. Architecture

```
Browser ─▶ apps/web (React Router v7, SSR)
              loaders/actions (server) ─ resilient client: retry + de-dup + TTL cache + bearer token
                 │
                 ▼
            apps/api (Fastify) ─▶ SQLite (Kysely)
                 ▲
        libs/shared  ── DTO types + capacity rules (surface area + humidity) + MAX_HUMIDITY_DELTA
                         imported by BOTH api and web (single source of truth, no drift)
```

The browser only talks to the React Router server (backend-for-frontend). The RR
server talks to Fastify. This is what makes (a) the bearer token meaningful — it
lives server-side and is never shipped to the browser — and (b) the cache shared
across all sessions.

## 5. Backend changes (`apps/api`)

- **`migration002` (additive).** SQLite cannot `ADD` a NOT NULL FK column, so the
  migration rebuilds the `garden` table (create new schema with `userId` FK →
  `user.userId` and `targetHumidity` REAL NOT NULL, copy existing rows, drop,
  rename) and seeds a default user with a known id. The local DB is disposable, so
  this is low-risk.
- **Schemas** (`garden.schema.ts`): add `targetHumidity` (0–100) and `userId`
  (positive int) to create/update; include both in the response schema.
- **Endpoint** `GET /gardens/user/:userId`: `GardenRepository.findByUserId` →
  `GardenService.getGardensByUserId` → route, mirroring the plants-by-garden route.
- **Humidity validation** in `PlantService.createPlant` / `updatePlant`: enforce
  `|garden.targetHumidity − plant.idealHumidityLevel| ≤ MAX_HUMIDITY_DELTA (15)`,
  throwing `ValidationError` with a clear message — structured like the existing
  surface-area check. Garden edits do not re-validate existing plants.
- **Auth**: register `@fastify/bearer-auth` gating all non-`/docs` routes against a
  token from env (e.g. `API_BEARER_TOKEN`).

## 6. Frontend (`apps/web`)

- Scaffold: `nx g @nx/react:app apps/web --routing --use-react-router`.
- **Tailwind + primitives**: `Card`, `Button`, `Badge`, `Field/Input`, `Meter`,
  `Dialog` (native `<dialog>`), `Toast`.
- **Routes**: `/gardens` (overview), `/gardens/:gardenId` (detail). Create/edit
  garden and add/edit plant are fetcher-driven dialogs; delete is a confirm dialog.
- **Data layer**: server-side loaders (reads) and actions (writes) calling a typed
  **resilient client**:
  - retry with backoff on 5xx/network (absorbs the 10% errors), capped retries;
  - de-dup concurrent identical GETs;
  - short-TTL in-memory cache for hot GETs (e.g. garden list), invalidated on mutations;
  - injects the bearer token (server-side env).
- **Config**: `API_BASE_URL`, `API_BEARER_TOKEN`, `DEFAULT_USER_ID`.
- **Live validation**: forms import the `libs/shared` capacity rules so the two
  client-side checks (space + humidity band) match the server exactly. Server stays
  the source of truth; a stale client estimate is caught on submit and surfaced with
  the same message.

## 7. Domain rules (`libs/shared`)

Pure, framework-free functions reused by API and web:
- `usedArea(plants)`, `fitsArea(garden, plants, candidateArea)` → surface-area constraint.
- `humidityBand(targetHumidity)` → `[target-15, target+15]`; `humidityInBand(garden, plant)`.
- `MAX_HUMIDITY_DELTA = 15`.

## 8. Resilience & UX

- Loading: skeletons via RR pending/`useNavigation` states.
- Errors: route `ErrorBoundary` + a retry toast for transient 500s.
- Empty states (no gardens / no plants).
- The slow/flaky API is absorbed server-side; the browser sees fast, cached, retried responses.

## 9. Testing (Vitest + RTL + MSW)

- `libs/shared` capacity rules — exhaustive, pure, high value.
- Resilient client — retry/backoff, cache hit/miss/TTL, de-dup, against an
  MSW-simulated slow/flaky API.
- Key loaders/actions — overcrowding rejection, humidity-band rejection, list load.
- A few component states — Meter rendering, dialog submit gating, error/empty states.

## 10. README (graded deliverable)

Architecture + decisions; the three gaps and their resolutions; the performance
story (server cache today → Redis/CDN/stale-while-revalidate in production); and the
auth write-up (client token = theater, BFF token = real-but-coarse, full per-user
design with the named Fastify plugins: `@fastify/bearer-auth`, `@fastify/jwt`,
`@fastify/auth`, session).

## 11. Incremental commit plan (rough)

1. `docs:` this design spec.
2. `feat(api):` garden target humidity + user ownership (migration002 + schemas + seed user).
3. `feat(api):` gardens-by-user endpoint.
4. `feat(api):` humidity compatibility validation (+ shared rule).
5. `feat(api):` bearer-auth BFF token gate.
6. `chore(web):` scaffold React Router app + Tailwind + primitives.
7. `feat(web):` resilient API client + `libs/shared` wiring.
8. `feat(web):` garden overview + detail (loaders, meters).
9. `feat(web):` garden + plant dialogs (actions/fetcher) with live dual validation.
10. `feat(web):` loading / error / empty states + toasts.
11. `test:` capacity rules, resilient client, loaders/actions.
12. `docs:` README — architecture, decisions, gaps, performance, auth.

(Exact commit boundaries finalized in the implementation plan.)

## 12. Open questions / may change

- Exact SQLite migration mechanics (rebuild vs. fold into `migration001`) confirmed at implementation.
- Tailwind v3 vs v4 path depends on what `@nx/react` scaffolds.
- Whether the API service layer imports `libs/shared` directly or duplicates the rule (depends on Nx api↔lib wiring).
