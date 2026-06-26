import { ReactNode, useEffect, useRef } from 'react';

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-full max-w-lg rounded-xl border border-gray-200 p-0 backdrop:bg-black/45"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between">
          <h3 className="text-base font-medium">{title}</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="text-gray-500">
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
