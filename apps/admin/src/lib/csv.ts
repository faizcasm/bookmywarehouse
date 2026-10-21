/**
 * Client-side helpers for CSV exports: the attachment filename convention
 * (mirrors the API's Content-Disposition) and a browser download that
 * revokes its object URL.
 */

/** e.g. bmw-bookings-2026-10-21.csv — UTC date to match the server's filename. */
export function exportCsvFilename(kind: 'bookings' | 'payouts', at: Date = new Date()): string {
  return `bmw-${kind}-${at.toISOString().slice(0, 10)}.csv`;
}

/** Saves a Blob as a downloaded file, cleaning up the object URL afterwards. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
