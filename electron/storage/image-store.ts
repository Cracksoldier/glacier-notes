import * as fs from 'fs';
import * as path from 'path';
import { readJsonFile, StorageRecoveryWarning, writeJsonAtomic } from './json-store';
import { ImageAsset, newId, requireEntityId, SCHEMA_VERSION } from './models';

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

  constructor(
    baseDir: string,
    private readonly onCorrupt?: (warning: StorageRecoveryWarning) => void,
  ) {
    this.file = path.join(baseDir, 'images.json');
    this.dir = path.join(baseDir, 'images');
  }

  init(): void {
    this.images.clear();
    fs.mkdirSync(this.dir, { recursive: true });
    const stored = readJsonFile<ImagesFile>(this.file, {
      action: 'reset',
      onCorrupt: this.onCorrupt,
    });
    for (const asset of stored?.images ?? []) {
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

  /** Upsert with a caller-provided id (import path). */
  addWithId(id: string, data: Uint8Array, mimeType: string, fileName?: string): ImageAsset {
    requireEntityId(id);
    if (!EXTENSIONS[mimeType]) {
      throw new Error(`Unsupported image type: ${mimeType}`);
    }
    const existing = this.images.get(id);
    if (existing && existing.mimeType !== mimeType) {
      fs.rmSync(this.imageFile(existing), { force: true });
    }
    const asset: ImageAsset = { id, mimeType, ...(fileName ? { fileName } : {}) };
    fs.writeFileSync(this.imageFile(asset), Buffer.from(data));
    this.images.set(asset.id, asset);
    this.persist();
    return asset;
  }

  has(id: string): boolean {
    return this.images.has(id);
  }

  getFileInfo(id: string): { path: string; mimeType: string; fileName?: string } {
    const asset = this.get(id);
    return {
      path: this.imageFile(asset),
      mimeType: asset.mimeType,
      ...(asset.fileName ? { fileName: asset.fileName } : {}),
    };
  }

  list(): ImageAsset[] {
    return [...this.images.values()].map((asset) => ({ ...asset }));
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
    requireEntityId(asset.id);
    return path.join(this.dir, `${asset.id}.${EXTENSIONS[asset.mimeType]}`);
  }

  private persist(): void {
    writeJsonAtomic(this.file, {
      schemaVersion: SCHEMA_VERSION,
      images: [...this.images.values()],
    } satisfies ImagesFile);
  }
}
