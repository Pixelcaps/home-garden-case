# Home Garden — Frontend Read Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the React Router app to the backend through a typed, server-side data layer and ship the two read screens — the gardens overview and the garden detail — with loading, error, and empty states.

**Architecture:** Server-side loaders call a typed API module that wraps the resilient client (`apps/web/app/lib/api/resilient-fetch.ts`) with base URL + bearer token from server-only config. Components render with the Tailwind primitives from `apps/web/app/components/ui`. Surface-area usage shown on cards/panels is computed from `libs/shared` (`@itp-home-garden/shared`). No mutations yet — create/edit/delete and the README are the next plan.

**Tech Stack:** React Router v7 (framework mode), Vitest + Testing Library (`createRoutesStub`), Tailwind v4, `@itp-home-garden/shared`.

## Global Constraints

- Run everything through Nx (`npx nx <target> web`).
- Loaders/actions and the API config run **server-side only**; never expose `API_BEARER_TOKEN` to the browser. Config: `API_BASE_URL` (default `http://localhost:3000`), `API_BEARER_TOKEN` (optional), `DEFAULT_USER_ID` (default `1`).
- All backend calls go through the resilient client (retry/cache/de-dup) via the typed API module — never call `fetch` directly from a loader.
- The overview is a **card grid** (not a table); each garden card shows name, location, a surface-area `Meter` (used/total computed from its plants), target humidity, and plant count.
- Surface-area "used" is the sum of a garden's plants' `surfaceAreaRequired` (`usedArea` from `@itp-home-garden/shared`). Meter color: green `<0.75`, amber `0.75–<1`, red `≥1` (already in the `Meter` primitive).
- Route DTOs come from `@itp-home-garden/shared` (`Garden`, `Plant`, `PlantType`).
- Use `useLoaderData<typeof loader>()` + `LoaderFunctionArgs` from `react-router` (do not depend on `+types` typegen).
- Mutations (create/edit/delete dialogs), action tests, and the README are **the next plan** — do not build them here. The API module may define the mutation functions (so the module is complete), but no UI calls them yet.

## Known structure (from the scaffold)

- Route registry: `apps/web/app/routes.tsx` (`index()` / `route()` from `@react-router/dev/routes`).
- Root layout: `apps/web/app/root.tsx` renders `<AppNav />` then `<Outlet />`.
- Nav: `apps/web/app/app-nav.tsx`. Index route component today: `apps/web/app/app.tsx` (Nx welcome — to be replaced). Example route `apps/web/app/routes/about.tsx` and `apps/web/app/nx-welcome.tsx` / `apps/web/app/app.module.css` are scaffolding to remove.
- Primitives: `apps/web/app/components/ui/{Button,Card,Badge,Field,Meter,Dialog,Toast,Skeleton}` (barrel `index.ts`).
- Resilient client: `apps/web/app/lib/api/resilient-fetch.ts` exports `resilientFetch<T>(path, options)`, `ApiError`, `invalidateCache`.
- Tests run under Vitest (jsdom, globals) and discover `app/**` and `tests/**` specs.

---

### Task 1: Typed API module + server config

**Files:**
- Create: `apps/web/app/lib/api/config.ts`
- Create: `apps/web/app/lib/api/garden-api.ts`
- Test: `apps/web/app/lib/api/garden-api.spec.ts`

**Interfaces:**
- Produces (consumed by all loaders/actions and later the dialogs):
  - `apiConfig: { baseUrl: string; bearerToken: string | undefined; defaultUserId: number }`
  - `interface GardenInput { gardenName; totalSurfaceArea; targetHumidity; locationDescription?; latitude?; longitude?; userId }`
  - `type GardenUpdateInput = Omit<GardenInput, 'userId'>`
  - `interface PlantInput { plantName; species; plantType: PlantType; plantationDate; surfaceAreaRequired; idealHumidityLevel; gardenId }`
  - `getGardensByUser(userId): Promise<Garden[]>`, `getGarden(gardenId): Promise<Garden>`, `getPlantsByGarden(gardenId): Promise<Plant[]>`
  - `createGarden(input: GardenInput): Promise<Garden>`, `updateGarden(gardenId, input: GardenUpdateInput): Promise<Garden>`, `deleteGarden(gardenId): Promise<void>`
  - `createPlant(input: PlantInput): Promise<Plant>`, `updatePlant(plantId, input: PlantInput): Promise<Plant>`, `deletePlant(plantId): Promise<void>`

- [ ] **Step 1: Write the server config**

Create `apps/web/app/lib/api/config.ts`:

```typescript
/**
 * Server-only configuration for talking to the backend API.
 * These values are read in loaders/actions (Node), never shipped to the browser.
 */
export const apiConfig = {
  baseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
  bearerToken: process.env.API_BEARER_TOKEN,
  defaultUserId: Number(process.env.DEFAULT_USER_ID ?? '1'),
};
```

- [ ] **Step 2: Write the failing API-module tests**

Create `apps/web/app/lib/api/garden-api.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./resilient-fetch', () => ({
  resilientFetch: vi.fn().mockResolvedValue({ ok: true }),
  invalidateCache: vi.fn(),
}));
vi.mock('./config', () => ({
  apiConfig: { baseUrl: 'http://api.test', bearerToken: 'tok', defaultUserId: 1 },
}));

import { resilientFetch, invalidateCache } from './resilient-fetch';
import {
  getGardensByUser,
  getGarden,
  getPlantsByGarden,
  createGarden,
  deletePlant,
} from './garden-api';

const mockFetch = vi.mocked(resilientFetch);
const mockInvalidate = vi.mocked(invalidateCache);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('garden-api', () => {
  it('getGardensByUser GETs the nested user path with base url and token', async () => {
    await getGardensByUser(1);
    expect(mockFetch).toHaveBeenCalledWith('/gardens/user/1', {
      baseUrl: 'http://api.test',
      token: 'tok',
    });
  });

  it('getGarden GETs the garden by id', async () => {
    await getGarden(7);
    expect(mockFetch).toHaveBeenCalledWith('/gardens/7', expect.objectContaining({ baseUrl: 'http://api.test' }));
  });

  it('getPlantsByGarden GETs the plants-by-garden path', async () => {
    await getPlantsByGarden(7);
    expect(mockFetch).toHaveBeenCalledWith('/plants/garden/7', expect.objectContaining({ token: 'tok' }));
  });

  it('createGarden POSTs the body and invalidates the cache', async () => {
    const input = {
      gardenName: 'G',
      totalSurfaceArea: 10,
      targetHumidity: 50,
      userId: 1,
    };
    await createGarden(input);
    expect(mockFetch).toHaveBeenCalledWith('/gardens', {
      baseUrl: 'http://api.test',
      token: 'tok',
      method: 'POST',
      body: input,
    });
    expect(mockInvalidate).toHaveBeenCalledOnce();
  });

  it('deletePlant DELETEs by id and invalidates the cache', async () => {
    await deletePlant(3);
    expect(mockFetch).toHaveBeenCalledWith('/plants/3', {
      baseUrl: 'http://api.test',
      token: 'tok',
      method: 'DELETE',
      body: undefined,
    });
    expect(mockInvalidate).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx nx test web -- garden-api`
Expected: FAIL (module `./garden-api` not found).

- [ ] **Step 4: Implement the API module**

Create `apps/web/app/lib/api/garden-api.ts`:

```typescript
import type { Garden, Plant, PlantType } from '@itp-home-garden/shared';
import { apiConfig } from './config';
import { invalidateCache, resilientFetch } from './resilient-fetch';

export interface GardenInput {
  gardenName: string;
  totalSurfaceArea: number;
  targetHumidity: number;
  locationDescription?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  userId: number;
}

export type GardenUpdateInput = Omit<GardenInput, 'userId'>;

export interface PlantInput {
  plantName: string;
  species: string;
  plantType: PlantType;
  plantationDate: string;
  surfaceAreaRequired: number;
  idealHumidityLevel: number;
  gardenId: number;
}

function readOptions() {
  return { baseUrl: apiConfig.baseUrl, token: apiConfig.bearerToken };
}

async function mutate<T>(path: string, method: string, body?: unknown): Promise<T> {
  const result = await resilientFetch<T>(path, { ...readOptions(), method, body });
  invalidateCache();
  return result;
}

export function getGardensByUser(userId: number): Promise<Garden[]> {
  return resilientFetch<Garden[]>(`/gardens/user/${userId}`, readOptions());
}

export function getGarden(gardenId: number): Promise<Garden> {
  return resilientFetch<Garden>(`/gardens/${gardenId}`, readOptions());
}

export function getPlantsByGarden(gardenId: number): Promise<Plant[]> {
  return resilientFetch<Plant[]>(`/plants/garden/${gardenId}`, readOptions());
}

export function createGarden(input: GardenInput): Promise<Garden> {
  return mutate<Garden>('/gardens', 'POST', input);
}

export function updateGarden(gardenId: number, input: GardenUpdateInput): Promise<Garden> {
  return mutate<Garden>(`/gardens/${gardenId}`, 'PUT', input);
}

export function deleteGarden(gardenId: number): Promise<void> {
  return mutate<void>(`/gardens/${gardenId}`, 'DELETE');
}

export function createPlant(input: PlantInput): Promise<Plant> {
  return mutate<Plant>('/plants', 'POST', input);
}

export function updatePlant(plantId: number, input: PlantInput): Promise<Plant> {
  return mutate<Plant>(`/plants/${plantId}`, 'PUT', input);
}

export function deletePlant(plantId: number): Promise<void> {
  return mutate<void>(`/plants/${plantId}`, 'DELETE');
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx nx test web -- garden-api`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/lib/api/config.ts apps/web/app/lib/api/garden-api.ts apps/web/app/lib/api/garden-api.spec.ts
git commit -m "feat(web): add typed API module and server config"
```

---

### Task 2: App shell — routes, nav, branding, redirect

**Files:**
- Modify: `apps/web/app/routes.tsx`
- Modify: `apps/web/app/app-nav.tsx`
- Create: `apps/web/app/routes/home.tsx` (redirect `/` → `/gardens`)
- Modify: `apps/web/app/root.tsx` (page title)
- Delete: `apps/web/app/routes/about.tsx`, `apps/web/app/nx-welcome.tsx`, `apps/web/app/app.tsx`, `apps/web/app/app.module.css`, `apps/web/tests/routes/_index.spec.tsx`

**Interfaces:**
- Produces: routes `/` (redirects), `/gardens`, `/gardens/:gardenId`. Tasks 3–4 create the `gardens.tsx` and `garden-detail.tsx` route modules these point at.

- [ ] **Step 1: Replace the route registry**

Replace `apps/web/app/routes.tsx`:

```tsx
import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('./routes/home.tsx'),
  route('gardens', './routes/gardens.tsx'),
  route('gardens/:gardenId', './routes/garden-detail.tsx'),
] satisfies RouteConfig;
```

- [ ] **Step 2: Add the index redirect**

Create `apps/web/app/routes/home.tsx`:

```tsx
import { redirect } from 'react-router';

export function loader() {
  return redirect('/gardens');
}
```

- [ ] **Step 3: Rebrand the nav**

Replace `apps/web/app/app-nav.tsx`:

```tsx
import { NavLink } from 'react-router';

export function AppNav() {
  return (
    <header className="border-b border-gray-200">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <NavLink to="/gardens" className="flex items-center gap-2 text-base font-medium">
          <span aria-hidden="true">🌱</span> Home garden
        </NavLink>
        <span className="flex items-center gap-2 text-sm text-gray-600">
          Home gardener
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-medium text-emerald-700">
            HG
          </span>
        </span>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Set the document title**

In `apps/web/app/root.tsx`, change the `meta` export's title from `'New Nx React Router App'` to `'Home garden'`.

- [ ] **Step 5: Remove scaffolding files**

Run:
```bash
git rm apps/web/app/routes/about.tsx apps/web/app/nx-welcome.tsx apps/web/app/app.tsx apps/web/app/app.module.css apps/web/tests/routes/_index.spec.tsx
```

- [ ] **Step 6: Verify build (routes resolve once Tasks 3–4 exist)**

The route registry now references `./routes/gardens.tsx` and `./routes/garden-detail.tsx`, which are created in Tasks 3 and 4. Building before those exist will fail. Therefore: do NOT build at the end of this task. Instead, after completing Tasks 3 and 4, `npx nx build web` must pass. Commit this task's shell changes now; the build gate lives at the end of Task 4.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/routes.tsx apps/web/app/routes/home.tsx apps/web/app/app-nav.tsx apps/web/app/root.tsx
git commit -m "feat(web): app shell — gardens routes, branding, index redirect"
```

---

### Task 3: Gardens overview screen

**Files:**
- Create: `apps/web/app/routes/gardens.tsx`

**Interfaces:**
- Consumes: `getGardensByUser`, `getPlantsByGarden` (Task 1); `apiConfig.defaultUserId`; `usedArea` from `@itp-home-garden/shared`; `Card`, `Meter`, `Badge` primitives.
- Produces: the `/gardens` route module (default component + `loader` + `ErrorBoundary`). The loader returns `{ gardens: GardenCard[] }` where `GardenCard = Garden & { usedArea: number; plantCount: number }`.

- [ ] **Step 1: Write the overview route**

Create `apps/web/app/routes/gardens.tsx`:

```tsx
import { Link, isRouteErrorResponse, useLoaderData, useRouteError } from 'react-router';
import { usedArea, type Garden } from '@itp-home-garden/shared';
import { apiConfig } from '../lib/api/config';
import { getGardensByUser, getPlantsByGarden } from '../lib/api/garden-api';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Meter } from '../components/ui/Meter';

interface GardenCard extends Garden {
  usedArea: number;
  plantCount: number;
}

export async function loader() {
  const gardens = await getGardensByUser(apiConfig.defaultUserId);
  const cards: GardenCard[] = await Promise.all(
    gardens.map(async (garden) => {
      const plants = await getPlantsByGarden(garden.gardenId);
      return { ...garden, usedArea: usedArea(plants), plantCount: plants.length };
    }),
  );
  return { gardens: cards };
}

export default function GardensRoute() {
  const { gardens } = useLoaderData<typeof loader>();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-6 text-xl font-medium">Your gardens</h1>

      {gardens.length === 0 ? (
        <Card className="text-center text-gray-600">
          No gardens yet. Create your first garden to start planting.
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
          {gardens.map((garden) => (
            <Link key={garden.gardenId} to={`/gardens/${garden.gardenId}`} className="block">
              <Card className="flex h-full flex-col gap-3 hover:border-gray-300">
                <div className="text-base font-medium">{garden.gardenName}</div>
                {garden.locationDescription ? (
                  <div className="text-sm text-gray-600">{garden.locationDescription}</div>
                ) : null}
                <Meter used={garden.usedArea} total={garden.totalSurfaceArea} />
                <div className="mt-1 flex items-center gap-2">
                  <Badge>Target {garden.targetHumidity}%</Badge>
                  <Badge>
                    {garden.plantCount} {garden.plantCount === 1 ? 'plant' : 'plants'}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'We could not load your gardens. The garden service may be busy — please try again.';
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Card className="text-center text-red-700">{message}</Card>
    </main>
  );
}
```

- [ ] **Step 2: Commit (build deferred to Task 4)**

```bash
git add apps/web/app/routes/gardens.tsx
git commit -m "feat(web): gardens overview screen with surface-area meters"
```

---

### Task 4: Garden detail screen

**Files:**
- Create: `apps/web/app/routes/garden-detail.tsx`

**Interfaces:**
- Consumes: `getGarden`, `getPlantsByGarden` (Task 1); `usedArea` from `@itp-home-garden/shared`; `Card`, `Meter`, `Badge`, `Button` primitives.
- Produces: the `/gardens/:gardenId` route module (default component + `loader` + `ErrorBoundary`). The loader returns `{ garden: Garden; plants: Plant[] }`.

- [ ] **Step 1: Write the detail route**

Create `apps/web/app/routes/garden-detail.tsx`:

```tsx
import {
  Link,
  type LoaderFunctionArgs,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from 'react-router';
import { usedArea, type PlantType } from '@itp-home-garden/shared';
import { getGarden, getPlantsByGarden } from '../lib/api/garden-api';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Meter } from '../components/ui/Meter';

const typeTone: Record<PlantType, 'vegetable' | 'fruit' | 'flower'> = {
  vegetable: 'vegetable',
  fruit: 'fruit',
  flower: 'flower',
};

export async function loader({ params }: LoaderFunctionArgs) {
  const gardenId = Number(params.gardenId);
  const [garden, plants] = await Promise.all([
    getGarden(gardenId),
    getPlantsByGarden(gardenId),
  ]);
  return { garden, plants };
}

export default function GardenDetailRoute() {
  const { garden, plants } = useLoaderData<typeof loader>();
  const used = usedArea(plants);
  const free = Math.round((garden.totalSurfaceArea - used) * 100) / 100;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link to="/gardens" className="text-sm text-gray-600">
        ← Your gardens
      </Link>

      <h1 className="mt-3 text-xl font-medium">{garden.gardenName}</h1>
      {garden.locationDescription ? (
        <p className="text-sm text-gray-600">{garden.locationDescription}</p>
      ) : null}

      <Card className="mt-4 bg-gray-50">
        <Meter used={used} total={garden.totalSurfaceArea} />
        <div className="mt-3 flex gap-6 text-sm">
          <div>
            <div className="text-gray-600">Free</div>
            <div className="text-lg font-medium">{free} m²</div>
          </div>
          <div>
            <div className="text-gray-600">Target humidity</div>
            <div className="text-lg font-medium">{garden.targetHumidity}%</div>
          </div>
          <div>
            <div className="text-gray-600">Plants</div>
            <div className="text-lg font-medium">{plants.length}</div>
          </div>
        </div>
      </Card>

      <h2 className="mt-8 mb-3 text-base font-medium">Plants</h2>
      {plants.length === 0 ? (
        <Card className="text-center text-gray-600">No plants in this garden yet.</Card>
      ) : (
        <div className="flex flex-col">
          {plants.map((plant) => (
            <div
              key={plant.plantId}
              className="grid grid-cols-[1fr_auto_70px_64px] items-center gap-3 border-b border-gray-200 py-3 text-sm"
            >
              <div>
                <div className="font-medium">{plant.plantName}</div>
                <div className="text-xs text-gray-500">{plant.species}</div>
              </div>
              <Badge tone={typeTone[plant.plantType]}>{plant.plantType}</Badge>
              <div className="text-right tabular-nums">{plant.surfaceAreaRequired} m²</div>
              <div className="text-right tabular-nums">{plant.idealHumidityLevel}%</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'We could not load this garden. The garden service may be busy — please try again.';
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Card className="text-center text-red-700">{message}</Card>
    </main>
  );
}
```

- [ ] **Step 2: Build the whole app (Tasks 2–4 gate)**

Run: `npx nx build web`
Expected: build succeeds — all routes referenced in `routes.tsx` now exist.

- [ ] **Step 3: Manual smoke test against the real backend**

In one terminal start the backend with a token:
`API_BEARER_TOKEN=dev-secret npx nx dev api`
In another, start the web app pointed at it:
`API_BASE_URL=http://localhost:3000 API_BEARER_TOKEN=dev-secret npx nx dev web`
Open `http://localhost:4200` → it redirects to `/gardens`, shows the seeded user's gardens (create a couple via Swagger/Bruno first if empty), each card shows a surface-area meter; clicking a card opens the detail with its plants. Stop both dev servers cleanly (kill the wrapper AND free ports 3000/4200).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/routes/garden-detail.tsx
git commit -m "feat(web): garden detail screen with plant list"
```

---

### Task 5: Loader tests

**Files:**
- Test: `apps/web/app/routes/gardens.spec.tsx`
- Test: `apps/web/app/routes/garden-detail.spec.tsx`

**Interfaces:**
- Consumes: the `loader` exports from Tasks 3–4; the `garden-api` module (mocked).

- [ ] **Step 1: Write the overview loader test**

Create `apps/web/app/routes/gardens.spec.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Garden, Plant } from '@itp-home-garden/shared';

vi.mock('../lib/api/config', () => ({ apiConfig: { defaultUserId: 1 } }));
vi.mock('../lib/api/garden-api', () => ({
  getGardensByUser: vi.fn(),
  getPlantsByGarden: vi.fn(),
}));

import { getGardensByUser, getPlantsByGarden } from '../lib/api/garden-api';
import { loader } from './gardens';

const garden = (gardenId: number, totalSurfaceArea: number): Garden => ({
  gardenId,
  gardenName: `G${gardenId}`,
  totalSurfaceArea,
  targetHumidity: 60,
  locationDescription: null,
  latitude: null,
  longitude: null,
  userId: 1,
  createdAt: '',
  updatedAt: '',
});

const plant = (plantId: number, gardenId: number, area: number): Plant => ({
  plantId,
  plantName: `p${plantId}`,
  species: 's',
  plantType: 'vegetable',
  plantationDate: '',
  surfaceAreaRequired: area,
  idealHumidityLevel: 60,
  gardenId,
  createdAt: '',
  updatedAt: '',
});

beforeEach(() => vi.clearAllMocks());

describe('gardens loader', () => {
  it('aggregates used area and plant count per garden for the default user', async () => {
    vi.mocked(getGardensByUser).mockResolvedValue([garden(1, 20), garden(2, 10)]);
    vi.mocked(getPlantsByGarden).mockImplementation(async (id: number) =>
      id === 1 ? [plant(1, 1, 3), plant(2, 1, 1.5)] : [],
    );

    const result = await loader();

    expect(getGardensByUser).toHaveBeenCalledWith(1);
    expect(result.gardens).toHaveLength(2);
    expect(result.gardens[0]).toMatchObject({ gardenId: 1, usedArea: 4.5, plantCount: 2 });
    expect(result.gardens[1]).toMatchObject({ gardenId: 2, usedArea: 0, plantCount: 0 });
  });

  it('returns an empty list when the user has no gardens', async () => {
    vi.mocked(getGardensByUser).mockResolvedValue([]);
    const result = await loader();
    expect(result.gardens).toEqual([]);
    expect(getPlantsByGarden).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails, then passes**

Run: `npx nx test web -- gardens`
Expected: with Tasks 3 implemented, this PASSES. (If the loader is missing the aggregation, it fails — that is the guard.)

- [ ] **Step 3: Write the detail loader test**

Create `apps/web/app/routes/garden-detail.spec.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Garden, Plant } from '@itp-home-garden/shared';

vi.mock('../lib/api/garden-api', () => ({
  getGarden: vi.fn(),
  getPlantsByGarden: vi.fn(),
}));

import { getGarden, getPlantsByGarden } from '../lib/api/garden-api';
import { loader } from './garden-detail';

const garden: Garden = {
  gardenId: 7,
  gardenName: 'G7',
  totalSurfaceArea: 20,
  targetHumidity: 60,
  locationDescription: 'Backyard',
  latitude: null,
  longitude: null,
  userId: 1,
  createdAt: '',
  updatedAt: '',
};
const plant: Plant = {
  plantId: 1,
  plantName: 'Tomato',
  species: 'Solanum lycopersicum',
  plantType: 'vegetable',
  plantationDate: '',
  surfaceAreaRequired: 3,
  idealHumidityLevel: 60,
  gardenId: 7,
  createdAt: '',
  updatedAt: '',
};

beforeEach(() => vi.clearAllMocks());

describe('garden-detail loader', () => {
  it('loads the garden and its plants by id from the route param', async () => {
    vi.mocked(getGarden).mockResolvedValue(garden);
    vi.mocked(getPlantsByGarden).mockResolvedValue([plant]);

    const result = await loader({ params: { gardenId: '7' } } as never);

    expect(getGarden).toHaveBeenCalledWith(7);
    expect(getPlantsByGarden).toHaveBeenCalledWith(7);
    expect(result.garden.gardenId).toBe(7);
    expect(result.plants).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Run the detail test**

Run: `npx nx test web -- garden-detail`
Expected: PASS.

- [ ] **Step 5: Run the full web suite**

Run: `npx nx test web`
Expected: all web tests pass (resilient client, cache, garden-api, gardens loader, garden-detail loader), pristine.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/routes/gardens.spec.tsx apps/web/app/routes/garden-detail.spec.tsx
git commit -m "test(web): cover gardens and garden-detail loaders"
```

---

## Self-Review

**Spec coverage (read-path portion of the design spec):**
- Server-side data layer via the resilient client → Task 1 (typed API module + config).
- App shell / routing / redirect / branding → Task 2.
- Gardens overview (card grid + per-garden surface-area meter + target humidity + plant count) → Task 3.
- Garden detail (meter panel + plant list with type/area/humidity) → Task 4.
- Loading/error/empty states → Tasks 3–4 (`ErrorBoundary`, empty-state cards; client-nav loading skeletons can be added with the dialogs in the next plan when there is interaction to suspend on).
- Loader tests (critical aggregation + param wiring) → Task 5.
- Mutations, dialogs, action tests, README → explicitly the **next plan**.

**Placeholder scan:** none — every code step has complete code; the deferred build (Task 2) is explained and gated at Task 4 Step 2.

**Type consistency:** `getGardensByUser`/`getGarden`/`getPlantsByGarden` and the mutation function names match between Task 1's interfaces, its tests, the loaders (Tasks 3–4), and the loader tests (Task 5). `GardenCard` (Task 3) extends `Garden` with `usedArea`/`plantCount`, asserted by name in Task 5. `usedArea` and the DTOs come from `@itp-home-garden/shared` (Plan 2, Task 2). `apiConfig.defaultUserId` is defined in Task 1 and consumed in Task 3 and mocked in Task 5.

**Note on the N+1 read:** the overview loader fetches plants per garden (`Promise.all`) to compute each meter. This is acceptable here — calls run in parallel, the resilient client caches and de-dups, and the count of gardens is small — and the README (next plan) will note an aggregate endpoint as the production optimization.
