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
