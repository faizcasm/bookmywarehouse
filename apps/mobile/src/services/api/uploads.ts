/** Upload endpoints (base64 data URI upload). */

import { api } from './client';

export type UploadFolder = 'listings' | 'avatars' | 'documents' | 'logos';

export interface UploadFileInput {
  /** A data URI (`data:image/...;base64,...`) or an https URL. */
  file: string;
  folder?: UploadFolder;
}

export interface UploadResult {
  url: string;
  provider?: string;
  publicId?: string;
  note?: string;
}

/** POST /uploads — returns the hosted (or inline-dev) image URL. */
export function uploadFile(input: UploadFileInput): Promise<UploadResult> {
  return api.post<UploadResult>('/uploads', { file: input.file, folder: input.folder ?? 'listings' });
}

/** Read a local file:// URI into a data URI suitable for POST /uploads. */
export async function uriToDataUri(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.readAsDataURL(blob);
  });
}
