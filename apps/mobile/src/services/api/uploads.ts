/** Upload endpoints (base64 data URI upload). */

import { api } from './client';

export interface UploadFileInput {
  buffer: string; // base64
  mimetype: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  originalname: string;
}

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}

export function uploadFile(input: UploadFileInput): Promise<UploadResult> {
  return api.post<UploadResult>('/uploads', { file: input });
}