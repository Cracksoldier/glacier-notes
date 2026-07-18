import { Component, computed, inject } from '@angular/core';
import { Header } from './core/layout/header';
import { Sidebar } from './core/layout/sidebar';
import { NotebookStore } from './core/store/notebook-store';
import { NoteStore } from './core/store/note-store';
import { SettingsStore } from './core/store/settings-store';
import { UiStore } from './core/store/ui-store';
import { NoteEditorDialog } from './features/notes/note-editor-dialog';
import { NoteGrid } from './features/notes/note-grid';

@Component({
  selector: 'app-root',
  imports: [Header, Sidebar, NoteGrid, NoteEditorDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly notebookStore = inject(NotebookStore);
  private readonly settingsStore = inject(SettingsStore);
  protected readonly noteStore = inject(NoteStore);
  protected readonly ui = inject(UiStore);

  protected readonly currentNotebookId = computed(() => {
    const view = this.ui.view();
    return view?.kind === 'notebook' ? view.id : null;
  });

  protected readonly editorNote = computed(() => {
    const id = this.ui.editorNoteId();
    return id ? (this.noteStore.find(id) ?? null) : null;
  });

  constructor() {
    void this.bootstrap();
  }

  protected async createTextNote(): Promise<void> {
    const notebookId = this.currentNotebookId();
    if (!notebookId) return;
    const note = await this.noteStore.create({ notebookId, type: 'text' });
    this.ui.openEditor(note.id);
  }

  protected async createChecklistNote(): Promise<void> {
    const notebookId = this.currentNotebookId();
    if (!notebookId) return;
    const note = await this.noteStore.create({ notebookId, type: 'checklist', checklist: [] });
    this.ui.openEditor(note.id);
  }

  private async bootstrap(): Promise<void> {
    await Promise.all([this.notebookStore.init(), this.noteStore.reloadAll(), this.settingsStore.init()]);
    await this.ui.init();
  }
}
