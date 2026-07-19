import * as fs from 'fs';
import * as path from 'path';
import { writeJsonAtomic } from './storage/json-store';

const MARKER = '.glacier-import-transaction.json';
const BACKUP = '.glacier-import-backup';
const MANAGED = ['notebooks.json', 'labels.json', 'images.json', 'notes', 'images'] as const;

interface Manifest {
  existing: string[];
}

export function beginImportTransaction(baseDir: string): void {
  recoverImportTransaction(baseDir);
  const backupDir = path.join(baseDir, BACKUP);
  fs.rmSync(backupDir, { recursive: true, force: true });
  fs.mkdirSync(backupDir, { recursive: true });
  const existing: string[] = [];
  try {
    for (const name of MANAGED) {
      const source = path.join(baseDir, name);
      if (!fs.existsSync(source)) continue;
      existing.push(name);
      fs.cpSync(source, path.join(backupDir, name), { recursive: true });
    }
    writeJsonAtomic(path.join(backupDir, 'manifest.json'), { existing } satisfies Manifest);
    writeJsonAtomic(path.join(baseDir, MARKER), { startedAt: new Date().toISOString() });
  } catch (error) {
    fs.rmSync(backupDir, { recursive: true, force: true });
    throw error;
  }
}

export function commitImportTransaction(baseDir: string): void {
  fs.rmSync(path.join(baseDir, MARKER), { force: true });
  fs.rmSync(path.join(baseDir, BACKUP), { recursive: true, force: true });
}

export function recoverImportTransaction(baseDir: string): boolean {
  const marker = path.join(baseDir, MARKER);
  if (!fs.existsSync(marker)) return false;
  const backupDir = path.join(baseDir, BACKUP);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(backupDir, 'manifest.json'), 'utf-8'),
  ) as Manifest;
  const existing = new Set(manifest.existing);
  for (const name of MANAGED) {
    const target = path.join(baseDir, name);
    fs.rmSync(target, { recursive: true, force: true });
    if (existing.has(name)) {
      fs.cpSync(path.join(backupDir, name), target, { recursive: true });
    }
  }
  commitImportTransaction(baseDir);
  return true;
}
