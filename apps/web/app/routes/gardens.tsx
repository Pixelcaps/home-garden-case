import { Link, isRouteErrorResponse, useLoaderData, useRouteError } from 'react-router';
import { usedArea, type Garden } from '@itp-home-garden/shared';
import { apiConfig } from '../lib/api/config';
import { createGarden, getGardensByUser, getPlantsByGarden } from '../lib/api/garden-api';
import { actionError, gardenInputFromForm } from '../lib/forms';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Meter } from '../components/ui/Meter';

interface GardenCard extends Garden {
  usedArea: number;
  plantCount: number;
}

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
