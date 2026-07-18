import * as fs from 'fs';
import * as path from 'path';
import { readJsonFile, writeJsonAtomic } from './json-store';
import { ImageAsset, newId, SCHEMA_VERSION } from './models';

interface ImagesFile {
  schemaVersion: number;
  images: ImageAsset[];
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export class ImageStore {
  private readonly file: string;
  private readonly dir: string;
  private readonly images = new Map<string, ImageAsset>();

  constructor(baseDir: string) {
    this.file = path.join(baseDir, 'images.json');
    this.dir = path.join(baseDir, 'images');
  }

  init(): void {
    fs.mkdirSync(this.dir, { recursive: true });
    for (const asset of readJsonFile<ImagesFile>(this.file)?.images ?? []) {
      this.images.set(asset.id, asset);
    }
  }

  add(data: Uint8Array, mimeType: string, fileName?: string): ImageAsset {
    const ext = EXTENSIONS[mimeType];
    if (!ext) {
      throw new Error(`Unsupported image type: ${mimeType}`);
    }
    const asset: ImageAsset = { id: newId(), mimeType, ...(fileName ? { fileName } : {}) };
    fs.writeFileSync(this.imageFile(asset), Buffer.from(data));
    this.images.set(asset.id, asset);
    this.persist();
    return asset;
  }

  getDataUrl(id: string): string {
    const asset = this.get(id);
    const data = fs.readFileSync(this.imageFile(asset));
    return `data:${asset.mimeType};base64,${data.toString('base64')}`;
  }

  delete(id: string): void {
    const asset = this.get(id);
    fs.rmSync(this.imageFile(asset), { force: true });
    this.images.delete(id);
    this.persist();
  }

  private get(id: string): ImageAsset {
    const asset = this.images.get(id);
    if (!asset) {
      throw new Error(`Image not found: ${id}`);
    }
    return asset;
  }

  private imageFile(asset: ImageAsset): string {
    return path.join(this.dir, `${asset.id}.${EXTENSIONS[asset.mimeType]}`);
  }

  private persist(): void {
    writeJsonAtomic(this.file, {
      schemaVersion: SCHEMA_VERSION,
      images: [...this.images.values()],
    } satisfies ImagesFile);
  }
}
