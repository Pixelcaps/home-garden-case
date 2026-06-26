# Home Garden — Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Fastify API with garden→user ownership, a per-garden target humidity, a gardens-by-user endpoint, a plant↔garden humidity-compatibility rule, and a BFF bearer-token gate.

**Architecture:** Surgical additive changes to `apps/api`. The data model gains `garden.userId` (FK → `user.userId`) and `garden.targetHumidity`, with a default user seeded in the initial migration. Business rules live in the service layer, mirroring the existing surface-area validation. A bearer-token gate is registered in an encapsulated route scope so Swagger `/docs` stays open.

**Tech Stack:** Fastify 5, Kysely + better-sqlite3, Zod v4, `@fastify/awilix`, `@fastify/bearer-auth`, Nx 22.

## Global Constraints

- Run all tasks through Nx (`npx nx <target> api`), never the underlying tooling directly.
- `MAX_HUMIDITY_DELTA = 15` (percentage points, inclusive) — the allowed gap between a garden's `targetHumidity` and a plant's `idealHumidityLevel`.
- `DEFAULT_USER_ID = 1` — the seeded implicit user; referenced later by the web app.
- Humidity validation runs on **plant create/update only**; garden edits do **not** re-validate existing plants (warn-don't-block, handled in the frontend).
- Endpoint convention is path-based child filtering (e.g. `GET /plants/garden/:gardenId`); the new endpoint follows it: `GET /gardens/user/:userId`.
- The bearer token is read from `process.env.API_BEARER_TOKEN` and is intended to live **server-side only** (the React Router BFF attaches it). If unset, the gate is disabled (keeps local dev/tests open).
- **Automated tests are deferred to the frontend plan** (agreed scope: "frontend critical logic"). Backend tasks are verified manually via build + Swagger/curl. `libs/shared` will provide the unit-tested mirror of these rules in Plan 2.
- Zod schemas register OpenAPI ids via `z.globalRegistry.add(...)`; preserve this for every schema.

---

### Task 1: Data model — ownership, target humidity, seeded user

**Files:**
- Modify: `apps/api/src/app/database/types.ts` (GardenTable)
- Modify: `apps/api/src/app/database/migrations/migration001.ts` (garden table + user seed)

**Interfaces:**
- Produces: `GardenTable.userId: number`, `GardenTable.targetHumidity: number`; a seeded user row with `userId = 1`. Later tasks rely on `garden.targetHumidity` and `garden.userId` existing.

- [ ] **Step 1: Install dependencies and clear any stale local DB**

The repo has never had `npm install` run. The SQLite file is regenerated from migrations on boot.

Run:
```bash
npm install
rm -f db.sqlite
```
Expected: `node_modules/` populated; no error from `rm` (file may not exist).

- [ ] **Step 2: Add the new columns to `GardenTable`**

In `apps/api/src/app/database/types.ts`, replace the `GardenTable` interface:

```typescript
export interface GardenTable {
  gardenId: Generated<number>;
  gardenName: string;
  totalSurfaceArea: number; // in square meters
  targetHumidity: number; // 0–100, the garden's target relative humidity
  locationDescription: string | null; // e.g., "Backyard", "Patio"
  latitude: number | null; // optional geographic coordinate
  longitude: number | null; // optional geographic coordinate
  userId: number; // foreign key to User (owner)
  createdAt: ColumnType<Date, string | undefined, never>;
  updatedAt: ColumnType<Date, string | undefined, never>;
}
```

- [ ] **Step 3: Seed the default user and extend the garden table in `migration001`**

In `apps/api/src/app/database/migrations/migration001.ts`, the `up` function creates `user`, then `garden`, then `plant`. (a) After the `user` table is created, seed the default user. (b) Add `targetHumidity` and `userId` columns to the `garden` table.

Insert immediately after the `createTable('user')...execute();` block:

```typescript
  await db
    .insertInto('user')
    .values({
      userId: 1,
      emailAddress: 'home.gardener@example.com',
      firstName: 'Home',
      lastName: 'Gardener',
    })
    .execute();
```

Then replace the `garden` table definition with:

```typescript
  await db.schema
    .createTable('garden')
    .addColumn('gardenId', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('gardenName', 'text', (col) => col.notNull())
    .addColumn('totalSurfaceArea', 'real', (col) => col.notNull())
    .addColumn('targetHumidity', 'real', (col) => col.notNull())
    .addColumn('locationDescription', 'text')
    .addColumn('latitude', 'real')
    .addColumn('longitude', 'real')
    .addColumn('userId', 'integer', (col) =>
      col.references('user.userId').onDelete('cascade').notNull(),
    )
    .addColumn('createdAt', 'text', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('updatedAt', 'text', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  await db.schema.createIndex('garden_user_id_index').on('garden').column('userId').execute();
```

- [ ] **Step 4: Build the API to typecheck the schema changes**

Run: `npx nx build api`
Expected: build succeeds (no TypeScript errors).

- [ ] **Step 5: Boot the API and confirm the migration + seed applied**

Run (in a background terminal): `npx nx dev api`
Expected logs include: `migration "migration001" was executed successfully` and `[ ready ] http://localhost:3000`.

Then in another terminal, inspect the generated DB:
```bash
node -e "const d=require('better-sqlite3')('db.sqlite'); console.log(d.prepare('PRAGMA table_info(garden)').all().map(c=>c.name)); console.log(d.prepare('SELECT userId,emailAddress FROM user').all());"
```
Expected: the garden column list includes `targetHumidity` and `userId`; the user query prints `[ { userId: 1, emailAddress: 'home.gardener@example.com' } ]`.

Stop the dev server after verifying.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/app/database/types.ts apps/api/src/app/database/migrations/migration001.ts
git commit -m "feat(api): add garden ownership and target humidity to data model"
```

---

### Task 2: Garden schemas — `targetHumidity` and `userId`

**Files:**
- Modify: `apps/api/src/app/schemas/garden.schema.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `createGardenSchema` now requires `userId` (positive int) and `targetHumidity` (0–100); `updateGardenSchema` requires `targetHumidity` but **not** `userId` (owner is immutable via update); `gardenResponseSchema` includes both plus `gardenId`, `createdAt`, `updatedAt`.

- [ ] **Step 1: Rewrite `garden.schema.ts`**

Replace the whole file with:

```typescript
import { z } from 'zod/v4';

export const gardenIdParamsSchema = z.object({
  gardenId: z.coerce.number().int().positive('Garden ID must be a positive integer'),
});

z.globalRegistry.add(gardenIdParamsSchema, { id: 'GardenId' });

const gardenObjectSchema = z.object({
  gardenName: z.string().min(1, 'Garden name is required').trim(),
  totalSurfaceArea: z.number().nonnegative('Total surface area must be a non-negative number'),
  targetHumidity: z
    .number()
    .min(0, 'Target humidity must be between 0 and 100')
    .max(100, 'Target humidity must be between 0 and 100'),
  locationDescription: z.string().nullable().optional(),
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .nullable()
    .optional(),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .nullable()
    .optional(),
});

const latitudeLongitudePaired = (data: {
  latitude?: number | null;
  longitude?: number | null;
}) => {
  const hasLat = data.latitude !== null && data.latitude !== undefined;
  const hasLng = data.longitude !== null && data.longitude !== undefined;
  return hasLat === hasLng;
};

const latitudeLongitudeMessage = {
  message: 'Both latitude and longitude must be provided together',
};

export const createGardenSchema = gardenObjectSchema
  .extend({ userId: z.number().int().positive('User ID must be a positive integer') })
  .refine(latitudeLongitudePaired, latitudeLongitudeMessage);

z.globalRegistry.add(createGardenSchema, { id: 'CreateGarden' });

export const updateGardenSchema = gardenObjectSchema.refine(
  latitudeLongitudePaired,
  latitudeLongitudeMessage,
);

z.globalRegistry.add(updateGardenSchema, { id: 'UpdateGarden' });

export const gardenResponseSchema = gardenObjectSchema.extend({
  gardenId: z.number(),
  userId: z.number(),
  createdAt: z.coerce.string(),
  updatedAt: z.coerce.string(),
});

z.globalRegistry.add(gardenResponseSchema, { id: 'Garden' });

export const gardensResponseSchema = z.array(gardenResponseSchema);

z.globalRegistry.add(gardensResponseSchema, { id: 'Gardens' });
```

- [ ] **Step 2: Build the API**

Run: `npx nx build api`
Expected: build succeeds.

- [ ] **Step 3: Verify create + read round-trip via curl**

Start the API (`npx nx dev api`), then:
```bash
curl -s -X POST http://localhost:3000/gardens -H 'Content-Type: application/json' \
  -d '{"gardenName":"Test patch","totalSurfaceArea":20,"targetHumidity":65,"locationDescription":"Backyard","userId":1}'
```
Expected: a `201`-status JSON garden echoing `targetHumidity: 65` and `userId: 1` with a `gardenId`. (If it returns a 500, that is the random-errors plugin — retry.)

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/app/schemas/garden.schema.ts
git commit -m "feat(api): add targetHumidity and userId to garden schemas"
```

---

### Task 3: Gardens-by-user endpoint

**Files:**
- Modify: `apps/api/src/app/database/repositories/garden.repository.ts` (add `findByUserId`)
- Modify: `apps/api/src/app/services/garden.service.ts` (add `getGardensByUserId`)
- Modify: `apps/api/src/app/routes/gardens.ts` (add route)

**Interfaces:**
- Consumes: `gardensResponseSchema` (Task 2), `userIdParamsSchema` from `../schemas/user.schema`.
- Produces: `GardenRepository.findByUserId(userId: number): Promise<Garden[]>`, `GardenService.getGardensByUserId(userId: number): Promise<Garden[]>`, route `GET /gardens/user/:userId`.

- [ ] **Step 1: Add `findByUserId` to the repository**

In `apps/api/src/app/database/repositories/garden.repository.ts`, add this method after `findById`:

```typescript
  /**
   * Find all gardens owned by a user
   */
  async findByUserId(userId: number): Promise<Garden[]> {
    return await this.db
      .selectFrom('garden')
      .where('userId', '=', userId)
      .selectAll()
      .execute();
  }
```

- [ ] **Step 2: Add `getGardensByUserId` to the service**

In `apps/api/src/app/services/garden.service.ts`, add after `getAllGardens`:

```typescript
  /**
   * Get all gardens owned by a user
   */
  async getGardensByUserId(userId: number): Promise<Garden[]> {
    return await this.gardenRepository.findByUserId(userId);
  }
```

- [ ] **Step 3: Add the route**

In `apps/api/src/app/routes/gardens.ts`, add the import for the user-id params schema near the other schema imports:

```typescript
import { userIdParamsSchema } from '../schemas/user.schema';
```

Then add this route inside the exported plugin function, immediately after the `GET /gardens/:gardenId` handler:

```typescript
  /**
   * GET /gardens/user/:userId
   * Get all gardens owned by a user
   * (Fastify prioritises the static `user` segment over `:gardenId`, so order is safe.)
   */
  fastify.withTypeProvider<ZodTypeProvider>().get<{ Params: z.infer<typeof userIdParamsSchema> }>(
    '/gardens/user/:userId',
    {
      schema: {
        description: 'Get all gardens owned by a user',
        tags: ['gardens'],
        params: userIdParamsSchema,
        response: {
          200: gardensResponseSchema,
          400: validationErrorResponseSchema,
          500: internalServerErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const gardens = await gardenService.getGardensByUserId(request.params.userId);
      return reply.send(gardens);
    },
  );
```

- [ ] **Step 4: Build the API**

Run: `npx nx build api`
Expected: build succeeds.

- [ ] **Step 5: Verify the endpoint**

Start the API, then (assuming the Task 2 garden was created for `userId: 1`):
```bash
curl -s http://localhost:3000/gardens/user/1
```
Expected: a JSON array containing the garden(s) owned by user 1. `curl http://localhost:3000/gardens/user/999` returns `[]`. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/app/database/repositories/garden.repository.ts apps/api/src/app/services/garden.service.ts apps/api/src/app/routes/gardens.ts
git commit -m "feat(api): add gardens-by-user endpoint"
```

---

### Task 4: Plant↔garden humidity compatibility rule

**Files:**
- Create: `apps/api/src/app/shared/constants.ts`
- Modify: `apps/api/src/app/services/plant.service.ts` (create + update)

**Interfaces:**
- Consumes: `garden.targetHumidity` (Task 1), `ValidationError` (existing, `../shared/errors`).
- Produces: `MAX_HUMIDITY_DELTA` constant; humidity enforcement on plant create/update.

- [ ] **Step 1: Add the constant**

Create `apps/api/src/app/shared/constants.ts`:

```typescript
/**
 * Maximum allowed gap (in percentage points) between a garden's target humidity
 * and a plant's ideal humidity level. A plant fits a garden when
 * |garden.targetHumidity - plant.idealHumidityLevel| <= MAX_HUMIDITY_DELTA.
 */
export const MAX_HUMIDITY_DELTA = 15;
```

- [ ] **Step 2: Import the constant in the plant service**

In `apps/api/src/app/services/plant.service.ts`, add to the imports:

```typescript
import { MAX_HUMIDITY_DELTA } from '../shared/constants';
```

- [ ] **Step 3: Enforce humidity on create**

In `createPlant`, the garden is already loaded and null-checked. Insert the humidity check immediately after the `if (!garden) { throw new NotFoundError(...) }` block and before the surface-area comment:

```typescript
    // Check humidity compatibility (garden target vs plant ideal)
    const humidityDelta = Math.abs(garden.targetHumidity - validatedData.idealHumidityLevel);
    if (humidityDelta > MAX_HUMIDITY_DELTA) {
      throw new ValidationError(
        `Cannot add plant: ideal humidity (${validatedData.idealHumidityLevel}%) must be within ` +
          `${MAX_HUMIDITY_DELTA}% of the garden's target humidity (${garden.targetHumidity}%). ` +
          `Allowed range is ${garden.targetHumidity - MAX_HUMIDITY_DELTA}–${garden.targetHumidity + MAX_HUMIDITY_DELTA}%.`,
      );
    }
```

- [ ] **Step 4: Enforce humidity on update**

In `updatePlant`, after the existing "If garden is being changed, verify new garden exists" block (the one computing `targetGardenId` and checking `newGarden`), insert a humidity check:

```typescript
    // Check humidity compatibility if humidity or garden is being updated
    if (validatedData.idealHumidityLevel !== undefined || validatedData.gardenId !== undefined) {
      const humidityGarden = await this.gardenRepository.findById(targetGardenId);
      if (!humidityGarden) {
        throw new ValidationError(`Garden with ID ${targetGardenId} not found`);
      }
      const finalHumidity = validatedData.idealHumidityLevel ?? existingPlant.idealHumidityLevel;
      const humidityDelta = Math.abs(humidityGarden.targetHumidity - finalHumidity);
      if (humidityDelta > MAX_HUMIDITY_DELTA) {
        throw new ValidationError(
          `Cannot update plant: ideal humidity (${finalHumidity}%) must be within ` +
            `${MAX_HUMIDITY_DELTA}% of the garden's target humidity (${humidityGarden.targetHumidity}%). ` +
            `Allowed range is ${humidityGarden.targetHumidity - MAX_HUMIDITY_DELTA}–${humidityGarden.targetHumidity + MAX_HUMIDITY_DELTA}%.`,
        );
      }
    }
```

- [ ] **Step 5: Build the API**

Run: `npx nx build api`
Expected: build succeeds.

- [ ] **Step 6: Verify the rule (reject + accept)**

Start the API. Using the user-1 garden with `targetHumidity: 65` (allowed band 50–80), create its `gardenId` if needed and substitute it below.

Reject (ideal 85, out of band):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/plants -H 'Content-Type: application/json' \
  -d '{"plantName":"Watercress","species":"Nasturtium officinale","plantType":"vegetable","plantationDate":"2026-06-26T00:00:00.000Z","surfaceAreaRequired":2,"idealHumidityLevel":85,"gardenId":1}'
```
Expected: `400`.

Accept (ideal 60, in band):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/plants -H 'Content-Type: application/json' \
  -d '{"plantName":"Basil","species":"Ocimum basilicum","plantType":"vegetable","plantationDate":"2026-06-26T00:00:00.000Z","surfaceAreaRequired":1,"idealHumidityLevel":60,"gardenId":1}'
```
Expected: `201`. (Retry on a random `500`.) Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/app/shared/constants.ts apps/api/src/app/services/plant.service.ts
git commit -m "feat(api): enforce plant/garden humidity compatibility"
```

---

### Task 5: BFF bearer-token gate

**Files:**
- Modify: `apps/api/package.json` (add `@fastify/bearer-auth`)
- Modify: `apps/api/src/app/app.ts` (encapsulated route scope with bearer auth)

**Interfaces:**
- Consumes: `process.env.API_BEARER_TOKEN`.
- Produces: all `routes/` endpoints require `Authorization: Bearer <token>` when the env var is set; `/docs` remains open.

- [ ] **Step 1: Add and install the dependency**

In `apps/api/package.json`, add to `dependencies` (keep alphabetical near the other `@fastify/*` entries):

```json
    "@fastify/bearer-auth": "^10.0.0",
```

Run: `npm install`
Expected: `@fastify/bearer-auth` installed, no peer-dependency errors against Fastify 5.

- [ ] **Step 2: Register bearer auth around the routes in `app.ts`**

In `apps/api/src/app/app.ts`, add the import near the top with the other plugin imports:

```typescript
import bearerAuth from '@fastify/bearer-auth';
```

Replace the existing routes autoload block:

```typescript
  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: { ...opts },
  });
```

with an encapsulated scope that gates the routes but leaves Swagger `/docs` open:

```typescript
  // Gate all API routes behind a bearer token (the BFF service token).
  // Registered in an encapsulated scope so the Swagger UI at /docs stays open.
  fastify.register(async (scope) => {
    const apiToken = process.env.API_BEARER_TOKEN;
    if (apiToken) {
      await scope.register(bearerAuth, { keys: new Set([apiToken]), addHook: true });
    } else {
      scope.log.warn('API_BEARER_TOKEN not set — bearer auth gate disabled');
    }

    // This loads all plugins defined in routes
    // define your routes in one of these
    await scope.register(AutoLoad, {
      dir: path.join(__dirname, 'routes'),
      options: { ...opts },
    });
  });
```

- [ ] **Step 3: Build the API**

Run: `npx nx build api`
Expected: build succeeds.

- [ ] **Step 4: Verify the gate (401 / 200 / open docs)**

Start the API with a token: `API_BEARER_TOKEN=dev-secret npx nx dev api`

Unauthenticated request is rejected:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/gardens
```
Expected: `401`.

Authenticated request passes:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -H 'Authorization: Bearer dev-secret' http://localhost:3000/gardens
```
Expected: `200` (retry on a random `500`).

Docs stay open:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/docs
```
Expected: `200`. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json package-lock.json apps/api/src/app/app.ts
git commit -m "feat(api): add BFF bearer-token gate, keep /docs open"
```

---

## Self-Review

**Spec coverage (Sections 5 of the design spec):**
- Garden `targetHumidity` + `userId` FK + seeded user → Task 1.
- Garden schema updates → Task 2.
- `GET /gardens/user/:userId` → Task 3.
- Humidity rule (`MAX_HUMIDITY_DELTA = 15`, create/update, warn-don't-block on garden edit) → Task 4 (garden-edit non-validation is the absence of a check, consistent with the existing surface-area behavior).
- `@fastify/bearer-auth` BFF gate, `/docs` open → Task 5.
- `libs/shared`, the resilient client, all UI, and automated tests → **Plan 2 (frontend)**, per the agreed test scope.

**Placeholder scan:** none — every code step contains complete code; every verification step has an exact command and expected status.

**Type consistency:** `findByUserId`/`getGardensByUserId` names match across repository, service, and route. `MAX_HUMIDITY_DELTA` is defined in Task 4 Step 1 and imported in Steps 3–4. `targetHumidity`/`userId` names are consistent across `types.ts`, the migration, schemas, and services.

**Note on garden edits and humidity:** updating a garden's `targetHumidity` deliberately does not re-validate existing plants (warn-don't-block); the frontend surfaces any now-incompatible plants. No backend task is needed for that — it is the intentional absence of a check.
