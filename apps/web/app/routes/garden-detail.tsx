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
