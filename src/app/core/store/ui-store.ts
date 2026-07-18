import { inject, Injectable, signal } from '@angular/core';
import { NotebookStore } from './notebook-store';

export type View = { kind: 'notebook'; id: string } | { kind: 'archive' } | { kind: 'trash' };

@Injectable({ providedIn: 'root' })
export class UiStore {
  private readonly api = window.glacierApi;
  private readonly notebookStore = inject(NotebookStore);

  readonly view = signal<View | null>(null);
  readonly editorNoteId = signal<string | null>(null);

  async init(): Promise<void> {
    const settings = await this.api.settings.get();
    const saved = settings.lastSelectedNotebookId;
    const exists = saved !== null && this.notebookStore.notebooks().some((n) => n.id === saved);
    const id = exists ? saved : await this.api.notebooks.getDefaultId();
    this.view.set({ kind: 'notebook', id });
  }

  selectNotebook(id: string): void {
    this.view.set({ kind: 'notebook', id });
    void this.api.settings.set({ lastSelectedNotebookId: id });
  }

  showArchive(): void {
    this.view.set({ kind: 'archive' });
  }

  showTrash(): void {
    this.view.set({ kind: 'trash' });
  }

  openEditor(noteId: string): void {
    this.editorNoteId.set(noteId);
  }

  closeEditor(): void {
    this.editorNoteId.set(null);
  }
}
