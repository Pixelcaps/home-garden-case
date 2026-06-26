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
