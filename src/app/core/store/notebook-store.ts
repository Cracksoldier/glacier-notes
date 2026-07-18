import { Injectable, signal } from '@angular/core';
import type { Notebook } from '../../../../electron/api';

@Injectable({ providedIn: 'root' })
export class NotebookStore {
  private readonly api = window.glacierApi;

  readonly notebooks = signal<Notebook[]>([]);
  readonly defaultId = signal<string | null>(null);

  async init(): Promise<void> {
    this.defaultId.set(await this.api.notebooks.getDefaultId());
    await this.reload();
  }

  async reload(): Promise<void> {
    this.notebooks.set(await this.api.notebooks.list());
  }

  async create(name: string): Promise<Notebook> {
    const notebook = await this.api.notebooks.create(name);
    await this.reload();
    return notebook;
  }

  async rename(id: string, name: string): Promise<void> {
    await this.api.notebooks.update(id, { name });
    await this.reload();
  }

  async reorder(id: string, direction: 'up' | 'down'): Promise<void> {
    const list = this.notebooks();
    const index = list.findIndex((n) => n.id === id);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= list.length) return;
    const a = list[index];
    const b = list[swapIndex];
    await Promise.all([
      this.api.notebooks.update(a.id, { sortOrder: b.sortOrder }),
      this.api.notebooks.update(b.id, { sortOrder: a.sortOrder }),
    ]);
    await this.reload();
  }

  async remove(id: string): Promise<void> {
    await this.api.notebooks.delete(id);
    await this.reload();
  }
}
