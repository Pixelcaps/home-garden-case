# Home Garden — Frontend Write Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add create / edit / delete for gardens and plants through fetcher-driven dialogs, with live surface-area + humidity validation and friendly surfacing of the server's rejection messages.

**Architecture:** React Router route `action`s (server-side) parse form data, call the typed API module, and translate `ApiError` into inline messages. Dialogs are client components using `useFetcher` — the page underneath stays mounted (and cached) while a mutation runs, and RR auto-revalidates the loaders on success. Live validation reuses `checkArea`/`checkHumidity` from `@itp-home-garden/shared`; the server stays the source of truth.

**Tech Stack:** React Router v7 (framework mode, `useFetcher`/`action`), `@itp-home-garden/shared`, Tailwind primitives, Vitest.

## Global Constraints

- Run everything through Nx (`npx nx <target> web`).
- Actions run **server-side only**; they call the API module (which holds the bearer token server-side). Never call the API from the browser.
- Mutations submit via `useFetcher`; on success the dialog closes and RR revalidation refreshes the screen. The page under the dialog stays mounted.
- Action error policy: a `4xx` `ApiError` (validation/conflict) is returned as `{ error: <friendly message extracted from the body> }` and shown inline in the dialog (dialog stays open). A `5xx`/network failure (after the resilient client's retries) is returned as `{ error: 'The garden service is busy right now. Please try again.' }` — also inline, never thrown to an `ErrorBoundary` (a mutation failure must not blow away the page).
- `delete-garden` returns `redirect('/gardens')` (the garden no longer exists).
- Live validation in the PLANT dialog must match the backend exactly: area fits when `usedArea(excluding the edited plant) + requested <= totalSurfaceArea`; humidity ok when `|targetHumidity - ideal| <= 15`. Submit is disabled when either fails. The garden dialog has only basic field validation (a new/edited garden has no capacity constraint of its own).
- Forms are native `<fetcher.Form>` with a hidden `intent` field; one `action` per route branches on `intent`.
- README is OUT OF SCOPE — it is written as a separate final step after manual validation.

## Known structure

- Overview route `apps/web/app/routes/gardens.tsx` (loader returns `{ gardens: GardenCard[] }`); detail route `apps/web/app/routes/garden-detail.tsx` (loader returns `{ garden, plants }`).
- API module `apps/web/app/lib/api/garden-api.ts` exports `createGarden/updateGarden/deleteGarden/createPlant/updatePlant/deletePlant` and the `GardenInput`/`GardenUpdateInput`/`PlantInput` types; `apiConfig.defaultUserId` from `config.ts`; `ApiError` from `resilient-fetch.ts`.
- Primitives in `apps/web/app/components/ui` (`Button`, `Card`, `Badge`, `Field`, `Meter`, `Dialog`, `Skeleton`, `ToastProvider`, `useToast`).
- `checkArea`, `checkHumidity`, `usedArea`, `MAX_HUMIDITY_DELTA`, `Garden`, `Plant`, `PlantType` from `@itp-home-garden/shared`.

---

### Task 1: Form helpers + route actions + action tests (TDD)

**Files:**
- Create: `apps/web/app/lib/forms.ts`
- Test: `apps/web/app/lib/forms.spec.ts`
- Modify: `apps/web/app/routes/gardens.tsx` (add `action`)
- Modify: `apps/web/app/routes/garden-detail.tsx` (add `action`)
- Test: `apps/web/app/routes/actions.spec.tsx`

**Interfaces:**
- Produces:
  - `gardenInputFromForm(form: FormData, userId: number): GardenInput`
  - `gardenUpdateFromForm(form: FormData): GardenUpdateInput`
  - `plantInputFromForm(form: FormData, gardenId: number): PlantInput`
  - `actionError(err: unknown): { error: string }`
  - `action` on `/gardens` (intent `create-garden`) and `/gardens/:gardenId` (intents `update-garden`, `delete-garden`, `create-plant`, `update-plant`, `delete-plant`), each returning `{ ok: true } | { error: string }` (or a redirect for delete-garden).

- [ ] **Step 1: Write the failing helper tests**

Create `apps/web/app/lib/forms.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ApiError } from './api/resilient-fetch';
import {
  gardenInputFromForm,
  plantInputFromForm,
  actionError,
} from './forms';

function fd(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}

describe('gardenInputFromForm', () => {
  it('parses numbers and coerces empty optionals to null, attaching userId', () => {
    const input = gardenInputFromForm(
      fd({ gardenName: 'Patch', totalSurfaceArea: '20', targetHumidity: '65', locationDescription: '', latitude: '', longitude: '' }),
      1,
    );
    expect(input).toEqual({
      gardenName: 'Patch',
      totalSurfaceArea: 20,
      targetHumidity: 65,
      locationDescription: null,
      latitude: null,
      longitude: null,
      userId: 1,
    });
  });
});

describe('plantInputFromForm', () => {
  it('parses a plant and converts the date to ISO, attaching gardenId', () => {
    const input = plantInputFromForm(
      fd({ plantName: 'Basil', species: 'Ocimum basilicum', plantType: 'vegetable', plantationDate: '2026-06-26', surfaceAreaRequired: '1.5', idealHumidityLevel: '60' }),
      7,
    );
    expect(input.plantName).toBe('Basil');
    expect(input.plantType).toBe('vegetable');
    expect(input.surfaceAreaRequired).toBe(1.5);
    expect(input.idealHumidityLevel).toBe(60);
    expect(input.gardenId).toBe(7);
    expect(input.plantationDate).toBe('2026-06-26T00:00:00.000Z');
  });
});

describe('actionError', () => {
  it('extracts the details message from a 4xx ApiError body', () => {
    const err = new ApiError(400, JSON.stringify({ error: 'Validation error', details: ['Cannot add plant: too humid'] }));
    expect(actionError(err)).toEqual({ error: 'Cannot add plant: too humid' });
  });

  it('returns a busy message for a 5xx ApiError', () => {
    expect(actionError(new ApiError(500, 'Server error 500'))).toEqual({
      error: 'The garden service is busy right now. Please try again.',
    });
  });

  it('returns a generic message for a non-ApiError', () => {
    expect(actionError(new Error('boom'))).toEqual({ error: 'Something went wrong. Please try again.' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx nx test web -- forms`
Expected: FAIL (module `./forms` not found).

- [ ] **Step 3: Implement the helpers**

Create `apps/web/app/lib/forms.ts`:

```typescript
import type { PlantType } from '@itp-home-garden/shared';
import type { GardenInput, GardenUpdateInput, PlantInput } from './api/garden-api';
import { ApiError } from './api/resilient-fetch';

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}
function num(form: FormData, key: string): number {
  return Number(form.get(key));
}
function optStr(form: FormData, key: string): string | null {
  const value = str(form, key);
  return value === '' ? null : value;
}
function optNum(form: FormData, key: string): number | null {
  const value = str(form, key);
  return value === '' ? null : Number(value);
}

function gardenFields(form: FormData) {
  return {
    gardenName: str(form, 'gardenName'),
    totalSurfaceArea: num(form, 'totalSurfaceArea'),
    targetHumidity: num(form, 'targetHumidity'),
    locationDescription: optStr(form, 'locationDescription'),
    latitude: optNum(form, 'latitude'),
    longitude: optNum(form, 'longitude'),
  };
}

export function gardenInputFromForm(form: FormData, userId: number): GardenInput {
  return { ...gardenFields(form), userId };
}

export function gardenUpdateFromForm(form: FormData): GardenUpdateInput {
  return gardenFields(form);
}

export function plantInputFromForm(form: FormData, gardenId: number): PlantInput {
  return {
    plantName: str(form, 'plantName'),
    species: str(form, 'species'),
    plantType: str(form, 'plantType') as PlantType,
    plantationDate: new Date(str(form, 'plantationDate')).toISOString(),
    surfaceAreaRequired: num(form, 'surfaceAreaRequired'),
    idealHumidityLevel: num(form, 'idealHumidityLevel'),
    gardenId,
  };
}

export function actionError(err: unknown): { error: string } {
  if (err instanceof ApiError) {
    if (err.status < 500) {
      try {
        const body = JSON.parse(err.message);
        const message = Array.isArray(body.details) ? body.details.join(' ') : body.error;
        return { error: message || err.message };
      } catch {
        return { error: err.message };
      }
    }
    return { error: 'The garden service is busy right now. Please try again.' };
  }
  return { error: 'Something went wrong. Please try again.' };
}
```

- [ ] **Step 4: Run to verify the helpers pass**

Run: `npx nx test web -- forms`
Expected: PASS.

- [ ] **Step 5: Add the `/gardens` action**

In `apps/web/app/routes/gardens.tsx`, add these imports (alongside the existing ones):

```tsx
import { apiConfig } from '../lib/api/config';
import { createGarden } from '../lib/api/garden-api';
import { actionError, gardenInputFromForm } from '../lib/forms';
```

(`apiConfig` is already imported for the loader; do not duplicate it.) Then add the action export:

```tsx
export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const intent = form.get('intent');
  if (intent === 'create-garden') {
    try {
      await createGarden(gardenInputFromForm(form, apiConfig.defaultUserId));
      return { ok: true };
    } catch (err) {
      return actionError(err);
    }
  }
  return { error: 'Unknown action' };
}
```

- [ ] **Step 6: Add the `/gardens/:gardenId` action**

In `apps/web/app/routes/garden-detail.tsx`, add imports:

```tsx
import { redirect, type ActionFunctionArgs } from 'react-router';
import {
  createPlant,
  deleteGarden,
  deletePlant,
  updateGarden,
  updatePlant,
} from '../lib/api/garden-api';
import { actionError, gardenUpdateFromForm, plantInputFromForm } from '../lib/forms';
```

(Adjust the existing `react-router` import to include `redirect` and `ActionFunctionArgs` rather than adding a duplicate import line.) Then add:

```tsx
export async function action({ request, params }: ActionFunctionArgs) {
  const gardenId = Number(params.gardenId);
  const form = await request.formData();
  const intent = form.get('intent');
  try {
    switch (intent) {
      case 'update-garden':
        await updateGarden(gardenId, gardenUpdateFromForm(form));
        return { ok: true };
      case 'delete-garden':
        await deleteGarden(gardenId);
        return redirect('/gardens');
      case 'create-plant':
        await createPlant(plantInputFromForm(form, gardenId));
        return { ok: true };
      case 'update-plant':
        await updatePlant(Number(form.get('plantId')), plantInputFromForm(form, gardenId));
        return { ok: true };
      case 'delete-plant':
        await deletePlant(Number(form.get('plantId')));
        return { ok: true };
      default:
        return { error: 'Unknown action' };
    }
  } catch (err) {
    return actionError(err);
  }
}
```

- [ ] **Step 7: Write the action tests**

Create `apps/web/app/routes/actions.spec.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '../lib/api/resilient-fetch';

vi.mock('../lib/api/config', () => ({ apiConfig: { defaultUserId: 1 } }));
vi.mock('../lib/api/garden-api', () => ({
  createGarden: vi.fn(),
  updateGarden: vi.fn(),
  deleteGarden: vi.fn(),
  createPlant: vi.fn(),
  updatePlant: vi.fn(),
  deletePlant: vi.fn(),
}));

import * as api from '../lib/api/garden-api';
import { action as gardensAction } from './gardens';
import { action as detailAction } from './garden-detail';

function request(fields: Record<string, string>): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return { formData: async () => form } as unknown as Request;
}

beforeEach(() => vi.clearAllMocks());

describe('gardens action', () => {
  it('creates a garden for the default user', async () => {
    vi.mocked(api.createGarden).mockResolvedValue({} as never);
    const result = await gardensAction({
      request: request({ intent: 'create-garden', gardenName: 'P', totalSurfaceArea: '20', targetHumidity: '65' }),
    });
    expect(api.createGarden).toHaveBeenCalledWith(expect.objectContaining({ gardenName: 'P', userId: 1 }));
    expect(result).toEqual({ ok: true });
  });
});

describe('garden-detail action', () => {
  it('surfaces a server overcrowding/humidity 4xx as an inline error', async () => {
    vi.mocked(api.createPlant).mockRejectedValue(
      new ApiError(400, JSON.stringify({ error: 'Validation error', details: ['Cannot add plant: would exceed area'] })),
    );
    const result = await detailAction({
      request: request({ intent: 'create-plant', plantName: 'X', species: 'Y', plantType: 'vegetable', plantationDate: '2026-06-26', surfaceAreaRequired: '99', idealHumidityLevel: '60' }),
      params: { gardenId: '7' },
    } as never);
    expect(result).toEqual({ error: 'Cannot add plant: would exceed area' });
  });

  it('redirects after deleting a garden', async () => {
    vi.mocked(api.deleteGarden).mockResolvedValue(undefined);
    const result = await detailAction({
      request: request({ intent: 'delete-garden' }),
      params: { gardenId: '7' },
    } as never);
    expect(api.deleteGarden).toHaveBeenCalledWith(7);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
  });

  it('deletes a plant by id', async () => {
    vi.mocked(api.deletePlant).mockResolvedValue(undefined);
    const result = await detailAction({
      request: request({ intent: 'delete-plant', plantId: '3' }),
      params: { gardenId: '7' },
    } as never);
    expect(api.deletePlant).toHaveBeenCalledWith(3);
    expect(result).toEqual({ ok: true });
  });
});
```

- [ ] **Step 8: Run the action + helper tests**

Run: `npx nx test web -- forms actions`
Expected: PASS (helpers + actions). Then `npx nx test web` — full suite green.

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/lib/forms.ts apps/web/app/lib/forms.spec.ts apps/web/app/routes/gardens.tsx apps/web/app/routes/garden-detail.tsx apps/web/app/routes/actions.spec.tsx
git commit -m "feat(web): garden/plant mutation actions with error surfacing"
```

---

### Task 2: Garden create/edit dialog

**Files:**
- Create: `apps/web/app/components/GardenFormDialog.tsx`
- Modify: `apps/web/app/routes/gardens.tsx` (New garden button + dialog)
- Modify: `apps/web/app/routes/garden-detail.tsx` (Edit garden button + dialog)

**Interfaces:**
- Consumes: `Dialog`, `Field`, `Button` primitives; `useFetcher`; `Garden` type.
- Produces: `GardenFormDialog({ open, onClose, mode, garden? })` — renders a `fetcher.Form` posting `intent=create-garden` (mode `create`) or `intent=update-garden` (mode `edit`) to the current route's action; closes on success; shows `fetcher.data.error` inline.

- [ ] **Step 1: Build the dialog**

Create `apps/web/app/components/GardenFormDialog.tsx`:

```tsx
import { useEffect } from 'react';
import { useFetcher } from 'react-router';
import type { Garden } from '@itp-home-garden/shared';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Field } from './ui/Field';

interface Props {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  garden?: Garden;
}

export function GardenFormDialog({ open, onClose, mode, garden }: Props) {
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const busy = fetcher.state !== 'idle';

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok) onClose();
  }, [fetcher.state, fetcher.data, onClose]);

  return (
    <Dialog open={open} onClose={onClose} title={mode === 'create' ? 'New garden' : 'Edit garden'}>
      <fetcher.Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="intent" value={mode === 'create' ? 'create-garden' : 'update-garden'} />
        <Field label="Garden name" htmlFor="gardenName">
          <input id="gardenName" name="gardenName" required defaultValue={garden?.gardenName ?? ''} autoFocus className="rounded-md border border-gray-300 px-3 py-2" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total surface area (m²)" htmlFor="totalSurfaceArea">
            <input id="totalSurfaceArea" name="totalSurfaceArea" type="number" step="0.1" min="0" required defaultValue={garden?.totalSurfaceArea ?? ''} className="rounded-md border border-gray-300 px-3 py-2" />
          </Field>
          <Field label="Target humidity (%)" htmlFor="targetHumidity">
            <input id="targetHumidity" name="targetHumidity" type="number" min="0" max="100" required defaultValue={garden?.targetHumidity ?? ''} className="rounded-md border border-gray-300 px-3 py-2" />
          </Field>
        </div>
        <Field label="Location (optional)" htmlFor="locationDescription">
          <input id="locationDescription" name="locationDescription" defaultValue={garden?.locationDescription ?? ''} className="rounded-md border border-gray-300 px-3 py-2" />
        </Field>
        {fetcher.data?.error ? <p role="alert" className="text-sm text-red-600">{fetcher.data.error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="accent" disabled={busy}>{busy ? 'Saving…' : 'Save garden'}</Button>
        </div>
      </fetcher.Form>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire "New garden" into the overview**

In `apps/web/app/routes/gardens.tsx`, import `useState`, the `Button` primitive, and `GardenFormDialog`. Add `const [creating, setCreating] = useState(false);` in the component, place a header action button next to the `<h1>`:

```tsx
<div className="mb-6 flex items-center justify-between">
  <h1 className="text-xl font-medium">Your gardens</h1>
  <Button variant="accent" onClick={() => setCreating(true)}>+ New garden</Button>
</div>
```

(Replace the existing `<h1>` block with this.) Then render the dialog at the end of the `<main>`:

```tsx
<GardenFormDialog open={creating} onClose={() => setCreating(false)} mode="create" />
```

- [ ] **Step 3: Wire "Edit garden" into the detail page**

In `apps/web/app/routes/garden-detail.tsx`, import `useState`, `Button`, and `GardenFormDialog`. Add `const [editing, setEditing] = useState(false);`. Add an Edit button in the header next to the garden name, and render `<GardenFormDialog open={editing} onClose={() => setEditing(false)} mode="edit" garden={garden} />` at the end of `<main>`.

```tsx
<div className="mt-3 flex items-start justify-between">
  <div>
    <h1 className="text-xl font-medium">{garden.gardenName}</h1>
    {garden.locationDescription ? <p className="text-sm text-gray-600">{garden.locationDescription}</p> : null}
  </div>
  <Button onClick={() => setEditing(true)}>Edit</Button>
</div>
```

(Replace the existing name/location block with this.)

- [ ] **Step 4: Build + commit**

Run: `npx nx build web` (expected: success).

```bash
git add apps/web/app/components/GardenFormDialog.tsx apps/web/app/routes/gardens.tsx apps/web/app/routes/garden-detail.tsx
git commit -m "feat(web): garden create/edit dialog"
```

---

### Task 3: Plant add/edit dialog with live dual validation

**Files:**
- Create: `apps/web/app/components/PlantFormDialog.tsx`
- Modify: `apps/web/app/routes/garden-detail.tsx` (Add plant button, per-plant edit, dialog)

**Interfaces:**
- Consumes: `Dialog`, `Field`, `Button`, `Meter`, `Badge` primitives; `useFetcher`; `checkArea`, `checkHumidity`, `humidityBand`, `Garden`, `Plant`, `PlantType` from `@itp-home-garden/shared`.
- Produces: `PlantFormDialog({ open, onClose, mode, garden, plants, plant? })` — live area + humidity validation; submit disabled when either fails; posts `intent=create-plant|update-plant` (+ `plantId` for edit) to the detail route action; closes on success; shows server error inline.

- [ ] **Step 1: Build the dialog**

Create `apps/web/app/components/PlantFormDialog.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router';
import { checkArea, checkHumidity, type Garden, type Plant, type PlantType } from '@itp-home-garden/shared';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Field } from './ui/Field';
import { Meter } from './ui/Meter';

interface Props {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  garden: Garden;
  plants: Plant[];
  plant?: Plant;
}

const PLANT_TYPES: PlantType[] = ['vegetable', 'fruit', 'flower'];

export function PlantFormDialog({ open, onClose, mode, garden, plants, plant }: Props) {
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const busy = fetcher.state !== 'idle';

  const [area, setArea] = useState(plant?.surfaceAreaRequired ?? 0);
  const [humidity, setHumidity] = useState(plant?.idealHumidityLevel ?? garden.targetHumidity);

  const areaCheck = checkArea(garden.totalSurfaceArea, plants, area, plant?.plantId);
  const humidityCheck = checkHumidity(garden.targetHumidity, humidity);
  const valid = areaCheck.fits && humidityCheck.ok;

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok) onClose();
  }, [fetcher.state, fetcher.data, onClose]);

  return (
    <Dialog open={open} onClose={onClose} title={mode === 'create' ? 'Add plant' : 'Edit plant'}>
      <fetcher.Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="intent" value={mode === 'create' ? 'create-plant' : 'update-plant'} />
        {plant ? <input type="hidden" name="plantId" value={plant.plantId} /> : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Plant name" htmlFor="plantName">
            <input id="plantName" name="plantName" required defaultValue={plant?.plantName ?? ''} autoFocus className="rounded-md border border-gray-300 px-3 py-2" />
          </Field>
          <Field label="Species" htmlFor="species">
            <input id="species" name="species" required defaultValue={plant?.species ?? ''} className="rounded-md border border-gray-300 px-3 py-2" />
          </Field>
          <Field label="Type" htmlFor="plantType">
            <select id="plantType" name="plantType" defaultValue={plant?.plantType ?? 'vegetable'} className="rounded-md border border-gray-300 px-3 py-2">
              {PLANT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Plantation date" htmlFor="plantationDate">
            <input id="plantationDate" name="plantationDate" type="date" required defaultValue={(plant?.plantationDate ?? '').slice(0, 10)} className="rounded-md border border-gray-300 px-3 py-2" />
          </Field>
          <Field label="Surface area (m²)" htmlFor="surfaceAreaRequired">
            <input id="surfaceAreaRequired" name="surfaceAreaRequired" type="number" step="0.1" min="0" required value={area} onChange={(e) => setArea(Number(e.target.value))} className="rounded-md border border-gray-300 px-3 py-2" />
          </Field>
          <Field label="Ideal humidity (%)" htmlFor="idealHumidityLevel">
            <input id="idealHumidityLevel" name="idealHumidityLevel" type="number" min="0" max="100" required value={humidity} onChange={(e) => setHumidity(Number(e.target.value))} className="rounded-md border border-gray-300 px-3 py-2" />
          </Field>
        </div>

        <div className="rounded-md bg-gray-50 p-3">
          <Meter used={Math.round(areaCheck.projected * 100) / 100} total={garden.totalSurfaceArea} label="After adding this plant" />
          {!areaCheck.fits ? (
            <p role="alert" className="mt-2 text-sm text-red-600">
              Over by {Math.round(areaCheck.overBy * 100) / 100} m² — this garden has {Math.round(areaCheck.remaining * 100) / 100} m² free.
            </p>
          ) : null}
          {!humidityCheck.ok ? (
            <p role="alert" className="mt-1 text-sm text-red-600">
              Humidity {humidity}% is outside this garden's band ({humidityCheck.min}–{humidityCheck.max}%).
            </p>
          ) : null}
        </div>

        {fetcher.data?.error ? <p role="alert" className="text-sm text-red-600">{fetcher.data.error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="accent" disabled={busy || !valid}>{busy ? 'Saving…' : 'Save plant'}</Button>
        </div>
      </fetcher.Form>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire into the detail page**

In `apps/web/app/routes/garden-detail.tsx`, import `PlantFormDialog`. Add state for the plant dialog: `const [plantDialog, setPlantDialog] = useState<{ mode: 'create' | 'edit'; plant?: Plant } | null>(null);` (import `Plant` type). Add an "Add plant" button in the Plants section header:

```tsx
<div className="mt-8 mb-3 flex items-center justify-between">
  <h2 className="text-base font-medium">Plants</h2>
  <Button variant="accent" onClick={() => setPlantDialog({ mode: 'create' })}>+ Add plant</Button>
</div>
```

(Replace the existing `<h2>Plants</h2>` line with this.) Add an Edit button to each plant row (after the humidity cell) — change the row grid to `grid-cols-[1fr_auto_70px_64px_auto]` and add:

```tsx
<Button onClick={() => setPlantDialog({ mode: 'edit', plant })}>Edit</Button>
```

Render the dialog at the end of `<main>`:

```tsx
{plantDialog ? (
  <PlantFormDialog
    open
    onClose={() => setPlantDialog(null)}
    mode={plantDialog.mode}
    garden={garden}
    plants={plants}
    plant={plantDialog.plant}
  />
) : null}
```

- [ ] **Step 3: Build + commit**

Run: `npx nx build web` (expected: success).

```bash
git add apps/web/app/components/PlantFormDialog.tsx apps/web/app/routes/garden-detail.tsx
git commit -m "feat(web): plant add/edit dialog with live area + humidity validation"
```

---

### Task 4: Delete confirms, toasts, and loading polish

**Files:**
- Create: `apps/web/app/components/ConfirmDeleteDialog.tsx`
- Modify: `apps/web/app/root.tsx` (wrap in `ToastProvider`)
- Modify: `apps/web/app/routes/garden-detail.tsx` (delete garden + delete plant confirms; error toast)
- Modify: `apps/web/app/routes/gardens.tsx` (navigation loading indicator)

**Interfaces:**
- Consumes: `useFetcher`, `useNavigation`, `ToastProvider`/`useToast`, `Dialog`, `Button`.
- Produces: `ConfirmDeleteDialog({ open, onClose, title, message, intent, hiddenFields? })` — a small `fetcher.Form` that submits a delete intent and closes on success.

- [ ] **Step 1: Build the confirm dialog**

Create `apps/web/app/components/ConfirmDeleteDialog.tsx`:

```tsx
import { useEffect } from 'react';
import { useFetcher } from 'react-router';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  intent: string;
  hiddenFields?: Record<string, string>;
}

export function ConfirmDeleteDialog({ open, onClose, title, message, intent, hiddenFields }: Props) {
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const busy = fetcher.state !== 'idle';

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok) onClose();
  }, [fetcher.state, fetcher.data, onClose]);

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <fetcher.Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="intent" value={intent} />
        {Object.entries(hiddenFields ?? {}).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <p className="text-sm text-gray-700">{message}</p>
        {fetcher.data?.error ? <p role="alert" className="text-sm text-red-600">{fetcher.data.error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Button>
        </div>
      </fetcher.Form>
    </Dialog>
  );
}
```

- [ ] **Step 2: Mount the ToastProvider**

In `apps/web/app/root.tsx`, import `ToastProvider` from `./components/ui/Toast` and wrap the body content:

```tsx
import { ToastProvider } from './components/ui/Toast';
```

In `Layout`, wrap `<AppNav /> {children} ...` region so the provider is available app-wide:

```tsx
<body>
  <ToastProvider>
    <AppNav />
    {children}
  </ToastProvider>
  <ScrollRestoration />
  <Scripts />
</body>
```

- [ ] **Step 3: Wire delete confirms + error toast in the detail page**

In `apps/web/app/routes/garden-detail.tsx`:
- Import `ConfirmDeleteDialog` and `useToast`.
- Add `const toast = useToast();` and state `const [deleteGarden, setDeleteGarden] = useState(false);` and `const [deletePlant, setDeletePlant] = useState<Plant | null>(null);`.
- Add a Delete button next to the garden's Edit button: `<Button variant="danger" onClick={() => setDeleteGarden(true)}>Delete</Button>`.
- Add a Delete button to each plant row (next to its Edit): `<Button variant="danger" onClick={() => setDeletePlant(plant)}>Delete</Button>` (widen the row grid's trailing `auto` track to fit two buttons, or wrap them in a flex container in one cell).
- Render the dialogs at the end of `<main>`:

```tsx
<ConfirmDeleteDialog
  open={deleteGarden}
  onClose={() => setDeleteGarden(false)}
  title="Delete garden"
  message={`Delete "${garden.gardenName}" and all its plants? This cannot be undone.`}
  intent="delete-garden"
/>
{deletePlant ? (
  <ConfirmDeleteDialog
    open
    onClose={() => setDeletePlant(null)}
    title="Delete plant"
    message={`Remove "${deletePlant.plantName}" from this garden?`}
    intent="delete-plant"
    hiddenFields={{ plantId: String(deletePlant.plantId) }}
  />
) : null}
```

- [ ] **Step 4: Add a navigation loading indicator to the overview**

In `apps/web/app/routes/gardens.tsx`, import `useNavigation`. Add `const navigation = useNavigation();` and apply a subtle pending style to the grid while navigating:

```tsx
<div className={navigation.state === 'loading' ? 'opacity-60 transition-opacity' : ''}>
  {/* existing grid / empty-state block */}
</div>
```

(Wrap the existing grid/empty-state block in this div.)

- [ ] **Step 5: Build, full test suite, commit**

Run: `npx nx build web` (success) and `npx nx test web` (all green).

```bash
git add apps/web/app/components/ConfirmDeleteDialog.tsx apps/web/app/root.tsx apps/web/app/routes/garden-detail.tsx apps/web/app/routes/gardens.tsx
git commit -m "feat(web): delete confirms, toasts, and navigation loading state"
```

---

## Self-Review

**Spec coverage (write-path portion of the design spec):**
- Garden create/edit via fetcher dialog → Task 2.
- Plant add/edit via fetcher dialog with **live dual validation** (area + humidity from `@itp-home-garden/shared`) → Task 3.
- Overcrowding/humidity server rejection surfaced as friendly inline messages → Task 1 (`actionError`) + Tasks 2–3 (inline display).
- Delete confirms (garden + plant) → Task 4.
- Loading states + error treatment → Task 4 (submit `Saving…`/`Deleting…`, navigation opacity, ToastProvider available; inline errors keep dialogs open).
- Action tests (overcrowding/humidity surfaced, delete behavior) → Task 1.
- README → explicitly out of scope (final step after manual validation).

**Placeholder scan:** none — complete code for helpers, actions, tests, and all four dialog/wiring tasks. Wiring steps quote the exact JSX to insert and which existing block it replaces.

**Type consistency:** `gardenInputFromForm`/`gardenUpdateFromForm`/`plantInputFromForm`/`actionError` signatures match between `forms.ts`, `forms.spec.ts`, and the route actions. Action return shape `{ ok: true } | { error: string }` (or `Response` redirect) is consumed identically by every dialog's `fetcher.data` handling. `checkArea(total, plants, requested, excludePlantId?)` and `checkHumidity(target, ideal)` are used per their Plan 2 signatures. Intent strings (`create-garden`, `update-garden`, `delete-garden`, `create-plant`, `update-plant`, `delete-plant`) match between the dialogs' hidden `intent` inputs and the actions' branches.

**Note on the toast usage:** Task 4 mounts `ToastProvider` so `useToast` is available; the primary error channel is inline dialog messages (errors keep the dialog open and retryable), with the toast provider in place for any non-dialog transient notice. This satisfies the "error/retry" intent without forcing every error through a toast.
