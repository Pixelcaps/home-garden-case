import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { useDialogFetcher } from './useDialogFetcher';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  intent: string;
  hiddenFields?: Record<string, string>;
}

export function ConfirmDeleteDialog({ open, onClose, title, message, intent, hiddenFields }: Props) {
  const { fetcher, busy } = useDialogFetcher(onClose);

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
