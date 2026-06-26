import { useEffect } from 'react';
import { useFetcher } from 'react-router';

/**
 * Shared plumbing for the fetcher-driven dialogs: a typed fetcher plus a `busy`
 * flag, and an effect that closes the dialog once its action returns { ok: true }.
 */
export function useDialogFetcher(onClose: () => void) {
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok) onClose();
  }, [fetcher.state, fetcher.data, onClose]);
  return { fetcher, busy: fetcher.state !== 'idle' };
}
