export function Meter({ used, total, label }: { used: number; total: number; label?: string }) {
  const ratio = total > 0 ? used / total : 0;
  const pct = Math.min(100, Math.round(ratio * 100));
  const color = ratio >= 1 ? 'bg-red-500' : ratio >= 0.75 ? 'bg-amber-500' : 'bg-green-600';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm text-gray-600">
        <span>{label ?? 'Surface area'}</span>
        <span>
          {used} / {total} m²
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-md bg-gray-100">
        <div className={`h-full rounded-md ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
