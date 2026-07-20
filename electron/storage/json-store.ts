import * as fs from 'fs';
import * as path from 'path';

export type StorageRecoveryAction = 'reset' | 'skipped';

export interface StorageRecoveryWarning {
  storageFile: string;
  backupPath: string;
  action: StorageRecoveryAction;
}

export interface ReadJsonOptions {
  action: StorageRecoveryAction;
  storageFile?: string;
  onCorrupt?: (warning: StorageRecoveryWarning) => void;
}

function corruptBackupPath(file: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const candidate = `${file}.corrupt-${stamp}`;
  if (!fs.existsSync(candidate)) return candidate;

  let suffix = 2;
  while (fs.existsSync(`${candidate}-${suffix}`)) suffix += 1;
  return `${candidate}-${suffix}`;
}

export function readJsonFile<T>(file: string, options?: ReadJsonOptions): T | undefined {
  let source: string;
  try {
    source = fs.readFileSync(file, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }

  try {
    return JSON.parse(source) as T;
  } catch {
    const backupPath = corruptBackupPath(file);
    fs.renameSync(file, backupPath);
    options?.onCorrupt?.({
      storageFile: options.storageFile ?? path.basename(file),
      backupPath,
      action: options.action,
    });
    return undefined;
  }
}

export function writeJsonAtomic(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

interface PendingWrite {
  timer: NodeJS.Timeout;
  produce: () => unknown;
}

export class DebouncedWriter {
  private readonly pending = new Map<string, PendingWrite>();

  constructor(private readonly delayMs = 500) {}

  schedule(file: string, produce: () => unknown): void {
    const existing = this.pending.get(file);
    if (existing) {
      clearTimeout(existing.timer);
    }
    const timer = setTimeout(() => {
      this.pending.delete(file);
      writeJsonAtomic(file, produce());
    }, this.delayMs);
    this.pending.set(file, { timer, produce });
  }

  cancel(file: string): void {
    const existing = this.pending.get(file);
    if (existing) {
      clearTimeout(existing.timer);
      this.pending.delete(file);
    }
  }

  flush(): void {
    for (const [file, { timer, produce }] of this.pending) {
      clearTimeout(timer);
      writeJsonAtomic(file, produce());
    }
    this.pending.clear();
  }

  discard(): void {
    for (const { timer } of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
  }
}
