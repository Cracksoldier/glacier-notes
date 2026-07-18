import { Injectable } from '@angular/core';
import type { ImageAsset } from '../../../../electron/api';

export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const SIZE_LIMIT = 10 * 1024 * 1024;
const MAX_DIMENSION = 2560;

// Target dimensions when an image exceeds the byte limit: shrink the pixel
// count proportionally to the byte overshoot, and cap the longest edge.
export function scaleDimensions(
  width: number,
  height: number,
  byteSize: number,
  limit = SIZE_LIMIT,
): { width: number; height: number } {
  let factor = byteSize > limit ? Math.sqrt(limit / byteSize) : 1;
  const longest = Math.max(width, height) * factor;
  if (longest > MAX_DIMENSION) {
    factor *= MAX_DIMENSION / longest;
  }
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
  };
}

export interface PreparedImage {
  data: Uint8Array;
  mimeType: string;
  fileName?: string;
}

@Injectable({ providedIn: 'root' })
export class ImageUploadService {
  isSupported(mimeType: string): boolean {
    return SUPPORTED_IMAGE_TYPES.includes(mimeType);
  }

  async prepare(file: Blob, fileName?: string): Promise<PreparedImage> {
    if (!this.isSupported(file.type)) {
      throw new Error(`Unsupported image type: ${file.type}`);
    }
    const blob = file.size > SIZE_LIMIT ? await this.downscale(file) : file;
    return {
      data: new Uint8Array(await blob.arrayBuffer()),
      mimeType: blob.type,
      ...(fileName ? { fileName } : {}),
    };
  }

  async attach(file: Blob, fileName?: string): Promise<ImageAsset> {
    const prepared = await this.prepare(file, fileName);
    return window.glacierApi.images.add(prepared.data, prepared.mimeType, prepared.fileName);
  }

  private async downscale(file: Blob): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const { width, height } = scaleDimensions(bitmap.width, bitmap.height, file.size);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas unavailable for image downscaling');
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    // GIF cannot be re-encoded by canvas; falls back to WebP (loses animation).
    const type = file.type === 'image/gif' ? 'image/webp' : file.type;
    return canvas.convertToBlob({ type, quality: 0.85 });
  }
}
