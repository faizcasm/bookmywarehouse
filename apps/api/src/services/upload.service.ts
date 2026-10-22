import { createHash } from 'node:crypto';
import { config, env } from '../config/env.js';
import { errors } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { randomSuffix } from '../lib/ids.js';

export interface UploadResult {
  url: string;
  provider: 'cloudinary' | 'inline-dev';
  publicId: string;
  note?: string;
}

const ALLOWED_DATA_PREFIXES = ['data:image/jpeg', 'data:image/png', 'data:image/webp', 'data:image/gif'];
const MAX_BYTES = env.MAX_IMAGE_INLINE_BYTES;

async function uploadToCloudinary(dataUri: string, folder: string): Promise<UploadResult> {
  const { cloudName, apiKey, apiSecret } = config.cloudinary;
  const timestamp = Math.round(Date.now() / 1000);
  const publicId = `${folder}/bmw_${randomSuffix(12)}`;
  const paramsToSign = `folder=bookmywarehouse/${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash('sha1').update(paramsToSign).digest('hex');

  const form = new FormData();
  form.append('file', dataUri);
  form.append('api_key', apiKey ?? '');
  form.append('timestamp', String(timestamp));
  form.append('folder', `bookmywarehouse/${folder}`);
  form.append('public_id', publicId);
  form.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logger.error('Cloudinary upload failed', { status: response.status, body: body.slice(0, 200) });
    throw errors.internal('Image upload failed');
  }
  const result = (await response.json()) as { secure_url: string; public_id: string };
  return { url: result.secure_url, provider: 'cloudinary', publicId: result.public_id };
}

/**
 * Uploads an image. With Cloudinary configured the file is stored there;
 * otherwise development environments keep a size-capped inline data URI so the
 * product remains usable without paid credentials (clearly labeled in the UI).
 */
export async function uploadImage(
  file: string,
  folder: string,
): Promise<UploadResult> {
  if (file.startsWith('https://')) {
    return { url: file, provider: 'cloudinary', publicId: 'external', note: 'External URL stored as-is' };
  }

  const isDataImage = ALLOWED_DATA_PREFIXES.some((prefix) => file.startsWith(prefix));
  if (!isDataImage) {
    throw errors.badRequest('Only JPEG, PNG, WebP or GIF images are supported');
  }

  if (config.cloudinary.enabled) {
    // Cloudinary's own limits apply here; the request body is already capped at
    // 2 MB by express.json, so no extra size gate is needed on this path.
    return uploadToCloudinary(file, folder);
  }

  // Inline dev storage keeps files in the page payload, so it stays size-capped.
  const approxBytes = Math.ceil((file.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    throw errors.badRequest(
      `Image is larger than ${Math.round(MAX_BYTES / 1000)} KB. Configure Cloudinary for larger uploads.`,
    );
  }

  if (env.NODE_ENV === 'production') {
    throw errors.precondition(
      'Image uploads require Cloudinary credentials in production (CLOUDINARY_* variables).',
    );
  }

  logger.info('Using inline development image storage (Cloudinary not configured)');
  return {
    url: file,
    provider: 'inline-dev',
    publicId: `inline_${randomSuffix(10)}`,
    note: 'Stored inline for local development; configure Cloudinary for production.',
  };
}
