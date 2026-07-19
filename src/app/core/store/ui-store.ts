import { computed, inject, Injectable, signal } from '@angular/core';
import { NotebookStore } from './notebook-store';

export type View =
  | { kind: 'notebook'; id: string }
  | { kind: 'archive' }
  | { kind: 'trash' }
  | { kind: 'label'; id: string };

@Injectable({ providedIn: 'root' })
export class UiStore {
  private readonly api = window.glacierApi;
  private readonly notebookStore = inject(NotebookStore);

  readonly view = signal<View | null>(null);
  readonly editorNoteId = signal<string | null>(null);
  readonly lightboxImageId = signal<string | null>(null);
  readonly settingsOpen = signal(false);
  readonly transferOpen = signal(false);
  readonly shortcutHelpOpen = signal(false);
  /** Bumped to request focus on the header search input. */
  readonly focusSearchTick = signal(0);

  readonly searchQuery = signal('');
  readonly searchScope = signal<'all' | 'notebook'>('all');
  readonly searching = computed(() => this.searchQuery().trim().length > 0);

  async init(): Promise<void> {
    const settings = await this.api.settings.get();
    const saved = settings.lastSelectedNotebookId;
    const exists = saved !== null && this.notebookStore.notebooks().some((n) => n.id === saved);
    const id = exists ? saved : await this.api.notebooks.getDefaultId();
    this.view.set({ kind: 'notebook', id });
  }

  selectNotebook(id: string): void {
    this.clearSearch();
    this.view.set({ kind: 'notebook', id });
    void this.api.settings.set({ lastSelectedNotebookId: id });
  }

  showArchive(): void {
    this.clearSearch();
    this.view.set({ kind: 'archive' });
  }

  showTrash(): void {
    this.clearSearch();
    this.view.set({ kind: 'trash' });
  }

  selectLabel(id: string): void {
    this.clearSearch();
    this.view.set({ kind: 'label', id });
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  toggleSearchScope(): void {
    this.searchScope.update((scope) => (scope === 'all' ? 'notebook' : 'all'));
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  openTransfer(): void {
    this.settingsOpen.set(false);
    this.shortcutHelpOpen.set(false);
    this.transferOpen.set(true);
  }

  closeTransfer(): void {
    this.transferOpen.set(false);
  }

  toggleTransfer(): void {
    const opening = !this.transferOpen();
    this.settingsOpen.set(false);
    this.shortcutHelpOpen.set(false);
    this.transferOpen.set(opening);
  }

  openShortcutHelp(): void {
    this.settingsOpen.set(false);
    this.transferOpen.set(false);
    this.shortcutHelpOpen.set(true);
  }

  closeShortcutHelp(): void {
    this.shortcutHelpOpen.set(false);
  }

  toggleShortcutHelp(): void {
    const opening = !this.shortcutHelpOpen();
    this.settingsOpen.set(false);
    this.transferOpen.set(false);
    this.shortcutHelpOpen.set(opening);
  }

  focusSearch(): void {
    this.focusSearchTick.update((tick) => tick + 1);
  }

  openSettings(): void {
    this.transferOpen.set(false);
    this.shortcutHelpOpen.set(false);
    this.settingsOpen.set(true);
  }

  closeSettings(): void {
    this.settingsOpen.set(false);
  }

  openEditor(noteId: string): void {
    this.settingsOpen.set(false);
    this.transferOpen.set(false);
    this.shortcutHelpOpen.set(false);
    this.editorNoteId.set(noteId);
  }

  closeEditor(): void {
    this.editorNoteId.set(null);
  }

  openLightbox(imageId: string): void {
    this.lightboxImageId.set(imageId);
  }

  closeLightbox(): void {
    this.lightboxImageId.set(null);
  }
}
