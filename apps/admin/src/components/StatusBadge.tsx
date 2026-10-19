import type { ReactNode } from 'react';
import { statusLabel, toneFor, type BadgeTone, type ToneGroup } from '../lib/format';

interface StatusBadgeProps {
  /** Raw status string, e.g. 'PENDING_APPROVAL'. */
  status: string | null | undefined;
  /** Tone map group (booking, listing, …). Omit when passing an explicit tone. */
  group?: ToneGroup;
  /** Explicit tone, bypassing the group map (useful for roles). */
  tone?: BadgeTone;
  /** Override the rendered label. */
  label?: string;
}

export function StatusBadge({ status, group, tone, label }: StatusBadgeProps) {
  if (!status) return <span className="badge badge--neutral">—</span>;
  const resolved: BadgeTone = tone ?? (group ? toneFor(group, status) : 'neutral');
  return <span className={`badge badge--${resolved}`}>{label ?? statusLabel(status)}</span>;
}

/** Non-status accent chip (e.g. listing type, counts). */
export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`chip chip--${tone}`}>{children}</span>;
}
