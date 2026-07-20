import { Component, computed, inject, signal } from '@angular/core';
import type { Label, Notebook } from '../../../../electron/api';
import { I18nService } from '../i18n/i18n.service';
import {
  NotebookDeleteDialog,
  NotebookDeleteResult,
} from '../../features/notebooks/notebook-delete-dialog';
import { Autofocus } from '../../shared/autofocus';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { LabelStore } from '../store/label-store';
import { NotebookStore } from '../store/notebook-store';
import { NoteStore } from '../store/note-store';
import { UiStore } from '../store/ui-store';

@Component({
  selector: 'app-sidebar',
  imports: [ConfirmDialog, NotebookDeleteDialog, Autofocus],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  protected readonly notebookStore = inject(NotebookStore);
  protected readonly noteStore = inject(NoteStore);
  protected readonly labelStore = inject(LabelStore);
  protected readonly ui = inject(UiStore);
  protected readonly i18n = inject(I18nService);

  protected readonly creating = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly deleteTarget = signal<Notebook | null>(null);

  protected readonly labelCreating = signal(false);
  protected readonly labelEditingId = signal<string | null>(null);
  protected readonly labelDeleteTarget = signal<Label | null>(null);

  protected readonly selectedNotebookId = computed(() => {
    const view = this.ui.view();
    return view?.kind === 'notebook' ? view.id : null;
  });

  protected readonly selectedLabelId = computed(() => {
    const view = this.ui.view();
    return view?.kind === 'label' ? view.id : null;
  });

  protected readonly countsByLabel = computed(() => {
    const counts = new Map<string, number>();
    for (const note of this.noteStore.active()) {
      for (const labelId of note.labels) {
        counts.set(labelId, (counts.get(labelId) ?? 0) + 1);
      }
    }
    return counts;
  });

  protected readonly deleteTargetNoteCount = computed(() => {
    const target = this.deleteTarget();
    if (!target) return 0;
    return [
      ...this.noteStore.active(),
      ...this.noteStore.archived(),
      ...this.noteStore.trashed(),
    ].filter((n) => n.notebookId === target.id).length;
  });

  protected async commitCreate(value: string): Promise<void> {
    if (!this.creating()) return;
    this.creating.set(false);
    const name = value.trim();
    if (!name) return;
    const notebook = await this.notebookStore.create(name);
    this.ui.selectNotebook(notebook.id);
  }

  protected async commitRename(notebook: Notebook, value: string): Promise<void> {
    if (this.editingId() !== notebook.id) return;
    this.editingId.set(null);
    const name = value.trim();
    if (!name || name === notebook.name) return;
    await this.notebookStore.rename(notebook.id, name);
  }

  protected async onDeleteClosed(result: NotebookDeleteResult | null): Promise<void> {
    const target = this.deleteTarget();
    this.deleteTarget.set(null);
    if (!result || !target) return;
    if (result.mode === 'move') {
      await this.noteStore.moveAllFromNotebook(target.id, result.targetId);
    }
    await this.notebookStore.remove(target.id);
    await this.noteStore.reloadAll();
    const view = this.ui.view();
    if (view?.kind === 'notebook' && view.id === target.id) {
      const fallback = this.notebookStore.defaultId();
      if (fallback) {
        this.ui.selectNotebook(fallback);
      }
    }
  }

  protected reorder(event: Event, id: string, direction: 'up' | 'down'): void {
    event.stopPropagation();
    void this.notebookStore.reorder(id, direction);
  }

  protected async commitLabelCreate(value: string): Promise<void> {
    if (!this.labelCreating()) return;
    this.labelCreating.set(false);
    const name = value.trim();
    if (!name) return;
    await this.labelStore.create(name);
  }

  protected async commitLabelRename(label: Label, value: string): Promise<void> {
    if (this.labelEditingId() !== label.id) return;
    this.labelEditingId.set(null);
    const name = value.trim();
    if (!name || name === label.name) return;
    await this.labelStore.rename(label.id, name);
  }

  protected async onLabelDeleteConfirmed(confirmed: boolean): Promise<void> {
    const target = this.labelDeleteTarget();
    this.labelDeleteTarget.set(null);
    if (!confirmed || !target) return;
    await this.labelStore.remove(target.id);
    await this.noteStore.reloadAll();
    const view = this.ui.view();
    if (view?.kind === 'label' && view.id === target.id) {
      const fallback = this.notebookStore.defaultId();
      if (fallback) {
        this.ui.selectNotebook(fallback);
      }
    }
  }
}
