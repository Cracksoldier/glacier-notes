import { Component, computed, inject, signal } from '@angular/core';
import type { Note } from '../../../../electron/api';
import { NoteStore } from '../../core/store/note-store';
import { UiStore } from '../../core/store/ui-store';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { NoteCard } from './note-card';

@Component({
  selector: 'app-note-grid',
  imports: [NoteCard, ConfirmDialog],
  templateUrl: './note-grid.html',
  styleUrl: './note-grid.scss',
})
export class NoteGrid {
  protected readonly noteStore = inject(NoteStore);
  protected readonly ui = inject(UiStore);

  protected readonly emptyTrashConfirm = signal(false);

  protected readonly notes = computed<Note[]>(() => {
    const view = this.ui.view();
    if (!view) return [];
    switch (view.kind) {
      case 'archive':
        return this.noteStore.archived();
      case 'trash':
        return this.noteStore.trashed();
      case 'notebook':
        return this.noteStore.active().filter((n) => n.notebookId === view.id);
    }
  });

  protected readonly pinned = computed(() => this.notes().filter((n) => n.pinned));
  protected readonly others = computed(() => this.notes().filter((n) => !n.pinned));

  protected readonly emptyState = computed(() => {
    switch (this.ui.view()?.kind) {
      case 'archive':
        return { icon: 'fa-solid fa-box-archive', title: 'Nothing archived', hint: 'Archived notes appear here.' };
      case 'trash':
        return { icon: 'fa-regular fa-trash-can', title: 'Trash is empty', hint: 'Deleted notes appear here.' };
      default:
        return { icon: 'fa-regular fa-note-sticky', title: 'No notes yet', hint: 'Create a note to get started.' };
    }
  });

  protected async onEmptyTrashConfirmed(confirmed: boolean): Promise<void> {
    this.emptyTrashConfirm.set(false);
    if (confirmed) {
      await this.noteStore.emptyTrash();
    }
  }
}
