import { statusMetaFor, type StatusKind } from '../lib/format';

export function StatusBadge({ status, kind = 'booking' }: { status?: string | null; kind?: StatusKind }) {
  const meta = statusMetaFor(kind, status);
  return (
    <span className={`badge tone-${meta.tone}`} data-status={status ?? undefined}>
      {meta.label}
    </span>
  );
}
