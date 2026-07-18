import { computed, Injectable, signal } from '@angular/core';
import type { Note, NoteCreateInput, NoteUpdatePatch } from '../../../../electron/api';

@Injectable({ providedIn: 'root' })
export class NoteStore {
  private readonly api = window.glacierApi;

  readonly active = signal<Note[]>([]);
  readonly archived = signal<Note[]>([]);
  readonly trashed = signal<Note[]>([]);

  readonly countsByNotebook = computed(() => {
    const counts = new Map<string, number>();
    for (const note of this.active()) {
      counts.set(note.notebookId, (counts.get(note.notebookId) ?? 0) + 1);
    }
    return counts;
  });

  async reloadAll(): Promise<void> {
    const [active, archived, trashed] = await Promise.all([
      this.api.notes.list({}),
      this.api.notes.list({ archived: true }),
      this.api.notes.list({ trashed: true }),
    ]);
    this.active.set(active);
    this.archived.set(archived);
    this.trashed.set(trashed);
  }

  async create(input: NoteCreateInput): Promise<Note> {
    const note = await this.api.notes.create(input);
    await this.reloadAll();
    return note;
  }

  // Used by the editor: patches lists without reordering so the grid stays put mid-typing.
  async updateInPlace(id: string, patch: NoteUpdatePatch): Promise<Note> {
    const updated = await this.api.notes.update(id, patch);
    const replace = (notes: Note[]) => notes.map((n) => (n.id === id ? updated : n));
    this.active.update(replace);
    this.archived.update(replace);
    return updated;
  }

  find(id: string): Note | undefined {
    return (
      this.active().find((n) => n.id === id) ??
      this.archived().find((n) => n.id === id) ??
      this.trashed().find((n) => n.id === id)
    );
  }

  async togglePin(note: Note): Promise<void> {
    await this.api.notes.update(note.id, { pinned: !note.pinned });
    await this.reloadAll();
  }

  async setArchived(id: string, archived: boolean): Promise<void> {
    await this.api.notes.update(id, { archived });
    await this.reloadAll();
  }

  async move(id: string, notebookId: string): Promise<void> {
    await this.api.notes.move(id, notebookId);
    await this.reloadAll();
  }

  async trash(id: string): Promise<void> {
    await this.api.notes.trash(id);
    await this.reloadAll();
  }

  async restore(id: string): Promise<void> {
    await this.api.notes.restore(id);
    await this.reloadAll();
  }

  async purge(id: string): Promise<void> {
    await this.api.notes.purge(id);
    await this.reloadAll();
  }

  async emptyTrash(): Promise<void> {
    for (const note of this.trashed()) {
      await this.api.notes.purge(note.id);
    }
    await this.reloadAll();
  }

  async moveAllFromNotebook(fromNotebookId: string, toNotebookId: string): Promise<void> {
    const inNotebook = [...this.active(), ...this.archived(), ...this.trashed()].filter(
      (n) => n.notebookId === fromNotebookId,
    );
    for (const note of inNotebook) {
      await this.api.notes.move(note.id, toNotebookId);
    }
    await this.reloadAll();
  }
}
