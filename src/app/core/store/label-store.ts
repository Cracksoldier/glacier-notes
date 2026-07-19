import { Injectable, signal } from '@angular/core';
import type { Label } from '../../../../electron/api';

@Injectable({ providedIn: 'root' })
export class LabelStore {
  private readonly api = window.glacierApi;

  readonly labels = signal<Label[]>([]);

  async init(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.labels.set(await this.api.labels.list());
  }

  async create(name: string): Promise<Label> {
    const label = await this.api.labels.create(name);
    await this.reload();
    return label;
  }

  async rename(id: string, name: string): Promise<void> {
    await this.api.labels.update(id, { name });
    await this.reload();
  }

  // The main process strips the label from all notes; callers must reload the
  // note store afterwards so in-memory notes drop the stale id too.
  async remove(id: string): Promise<void> {
    await this.api.labels.delete(id);
    await this.reload();
  }
}
