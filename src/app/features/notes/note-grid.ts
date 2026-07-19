import { Component, computed, inject, signal } from '@angular/core';
import type { Note } from '../../../../electron/api';
import { I18nService } from '../../core/i18n/i18n.service';
import { NoteStore } from '../../core/store/note-store';
import { UiStore } from '../../core/store/ui-store';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { noteMatches } from '../search/search-model';
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
  protected readonly i18n = inject(I18nService);

  protected readonly emptyTrashConfirm = signal(false);

  protected readonly notes = computed<Note[]>(() => {
    const view = this.ui.view();
    if (this.ui.searching()) {
      const query = this.ui.searchQuery();
      const scoped =
        this.ui.searchScope() === 'notebook' && view?.kind === 'notebook'
          ? (n: Note) => n.notebookId === view.id
          : () => true;
      return [...this.noteStore.active(), ...this.noteStore.archived()]
        .filter(scoped)
        .filter((n) => noteMatches(n, query));
    }
    if (!view) return [];
    switch (view.kind) {
      case 'archive':
        return this.noteStore.archived();
      case 'trash':
        return this.noteStore.trashed();
      case 'notebook':
        return this.noteStore.active().filter((n) => n.notebookId === view.id);
      case 'label':
        return this.noteStore.active().filter((n) => n.labels.includes(view.id));
    }
  });

  protected readonly cardSearchQuery = computed(() =>
    this.ui.searching() ? this.ui.searchQuery().trim() : null,
  );

  protected readonly pinned = computed(() => this.notes().filter((n) => n.pinned));
  protected readonly others = computed(() => this.notes().filter((n) => !n.pinned));

  protected readonly emptyState = computed(() => {
    const t = this.i18n.t.bind(this.i18n);
    if (this.ui.searching()) {
      return {
        icon: 'fa-solid fa-magnifying-glass',
        title: t('grid.noMatches'),
        hint: t('grid.noMatchesHint'),
      };
    }
    switch (this.ui.view()?.kind) {
      case 'archive':
        return {
          icon: 'fa-solid fa-box-archive',
          title: t('grid.nothingArchived'),
          hint: t('grid.nothingArchivedHint'),
        };
      case 'trash':
        return {
          icon: 'fa-regular fa-trash-can',
          title: t('grid.trashEmpty'),
          hint: t('grid.trashEmptyHint'),
        };
      case 'label':
        return {
          icon: 'fa-solid fa-tag',
          title: t('grid.noLabelNotes'),
          hint: t('grid.noLabelNotesHint'),
        };
      default:
        return {
          icon: 'fa-regular fa-note-sticky',
          title: t('grid.noNotes'),
          hint: t('grid.noNotesHint'),
        };
    }
  });

  protected async onEmptyTrashConfirmed(confirmed: boolean): Promise<void> {
    this.emptyTrashConfirm.set(false);
    if (confirmed) {
      await this.noteStore.emptyTrash();
    }
  }
}
