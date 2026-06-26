import { useState } from 'react';
import {
  Link,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from 'react-router';
import { GardenFormDialog } from '../components/GardenFormDialog';
import { PlantFormDialog } from '../components/PlantFormDialog';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { Button } from '../components/ui/Button';
import { usedArea, type Plant, type PlantType } from '@itp-home-garden/shared';
import {
  createPlant,
  deleteGarden,
  deletePlant,
  getGarden,
  getPlantsByGarden,
  updateGarden,
  updatePlant,
} from '../lib/api/garden-api';
import { actionError, gardenUpdateFromForm, plantInputFromForm } from '../lib/forms';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Meter } from '../components/ui/Meter';

const typeTone: Record<PlantType, 'vegetable' | 'fruit' | 'flower'> = {
  vegetable: 'vegetable',
  fruit: 'fruit',
  flower: 'flower',
};

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
  const [editing, setEditing] = useState(false);
  const [plantDialog, setPlantDialog] = useState<{ mode: 'create' | 'edit'; plant?: Plant } | null>(null);
  const [isDeleteGardenOpen, setIsDeleteGardenOpen] = useState(false);
  const [plantToDelete, setPlantToDelete] = useState<Plant | null>(null);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link to="/gardens" className="text-sm text-gray-600">
        ← Your gardens
      </Link>

      <div className="mt-3 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-medium">{garden.gardenName}</h1>
          {garden.locationDescription ? <p className="text-sm text-gray-600">{garden.locationDescription}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="danger" onClick={() => setIsDeleteGardenOpen(true)}>Delete</Button>
        </div>
      </div>

      <Card className="mt-4">
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

      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="text-base font-medium">Plants</h2>
        <Button
          variant="accent"
          onClick={() => setPlantDialog({ mode: 'create' })}
          disabled={free <= 0}
          title={free <= 0 ? 'Garden is full — no surface area left' : undefined}
        >
          + Add plant
        </Button>
      </div>
      {plants.length === 0 ? (
        <Card className="text-center text-gray-600">No plants in this garden yet.</Card>
      ) : (
        <div className="flex flex-col">
          {plants.map((plant) => (
            <div
              key={plant.plantId}
              className="grid grid-cols-[1fr_auto_70px_64px_auto] items-center gap-3 border-b border-gray-200 py-3 text-sm"
            >
              <div>
                <div className="font-medium">{plant.plantName}</div>
                <div className="text-xs text-gray-500">{plant.species}</div>
              </div>
              <Badge tone={typeTone[plant.plantType]}>{plant.plantType}</Badge>
              <div className="text-right tabular-nums">{plant.surfaceAreaRequired} m²</div>
              <div className="text-right tabular-nums">{plant.idealHumidityLevel}%</div>
              <div className="flex gap-2">
                <Button onClick={() => setPlantDialog({ mode: 'edit', plant })}>Edit</Button>
                <Button variant="danger" onClick={() => setPlantToDelete(plant)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing ? <GardenFormDialog open onClose={() => setEditing(false)} mode="edit" garden={garden} /> : null}
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
      <ConfirmDeleteDialog
        open={isDeleteGardenOpen}
        onClose={() => setIsDeleteGardenOpen(false)}
        title="Delete garden"
        message={`Delete "${garden.gardenName}" and all its plants? This cannot be undone.`}
        intent="delete-garden"
      />
      {plantToDelete ? (
        <ConfirmDeleteDialog
          open
          onClose={() => setPlantToDelete(null)}
          title="Delete plant"
          message={`Remove "${plantToDelete.plantName}" from this garden?`}
          intent="delete-plant"
          hiddenFields={{ plantId: String(plantToDelete.plantId) }}
        />
      ) : null}
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
