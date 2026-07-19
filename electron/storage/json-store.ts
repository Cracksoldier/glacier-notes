import * as fs from 'fs';
import * as path from 'path';

export function readJsonFile<T>(file: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
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
