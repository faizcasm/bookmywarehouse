/** Badge tone vocabulary shared by status → colour mappings across the app. */

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warn' | 'danger' | 'accent';

export interface StatusMeta {
  label: string;
  tone: BadgeTone;
}
