import { useEffect, useState } from 'react';
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

const coord = (value: number | null | undefined) => (value == null ? '' : String(value));

export function GardenFormDialog({ open, onClose, mode, garden }: Props) {
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const busy = fetcher.state !== 'idle';

  // Latitude/longitude are controlled so we can mirror the server's "both or
  // neither" rule live; everything else is uncontrolled (defaultValue).
  const [latitude, setLatitude] = useState(coord(garden?.latitude));
  const [longitude, setLongitude] = useState(coord(garden?.longitude));
  const coordsPaired = (latitude.trim() === '') === (longitude.trim() === '');

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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude (optional)" htmlFor="latitude">
            <input id="latitude" name="latitude" type="number" step="any" min="-90" max="90" value={latitude} onChange={(e) => setLatitude(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2" />
          </Field>
          <Field label="Longitude (optional)" htmlFor="longitude">
            <input id="longitude" name="longitude" type="number" step="any" min="-180" max="180" value={longitude} onChange={(e) => setLongitude(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2" />
          </Field>
        </div>
        {!coordsPaired ? (
          <p role="alert" className="text-sm text-red-600">
            Provide both latitude and longitude, or leave both empty.
          </p>
        ) : null}
        {fetcher.data?.error ? <p role="alert" className="text-sm text-red-600">{fetcher.data.error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="accent" disabled={busy || !coordsPaired}>{busy ? 'Saving…' : 'Save garden'}</Button>
        </div>
      </fetcher.Form>
    </Dialog>
  );
}
