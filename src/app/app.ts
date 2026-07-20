import { Component, computed, effect, inject, signal } from '@angular/core';
import type { RecoveryWarning } from '../../electron/api';
import { I18nService } from './core/i18n/i18n.service';
import { Header } from './core/layout/header';
import { Sidebar } from './core/layout/sidebar';
import { KeyboardShortcuts } from './core/shortcuts/keyboard-shortcuts';
import { LabelStore } from './core/store/label-store';
import { NotebookStore } from './core/store/notebook-store';
import { NoteStore } from './core/store/note-store';
import { SettingsStore } from './core/store/settings-store';
import { UiStore } from './core/store/ui-store';
import { NoteEditorDialog } from './features/notes/note-editor-dialog';
import { NoteGrid } from './features/notes/note-grid';
import { SettingsDialog } from './features/settings/settings-dialog';
import { TransferDialog } from './features/transfer/transfer-dialog';
import { ImageLightbox } from './shared/image-lightbox/image-lightbox';
import { ShortcutHelpDialog } from './shared/shortcut-help-dialog/shortcut-help-dialog';
import { StorageRecoveryDialog } from './shared/storage-recovery-dialog/storage-recovery-dialog';

@Component({
  selector: 'app-root',
  imports: [
    Header,
    Sidebar,
    NoteGrid,
    NoteEditorDialog,
    ImageLightbox,
    SettingsDialog,
    ShortcutHelpDialog,
    TransferDialog,
    StorageRecoveryDialog,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly notebookStore = inject(NotebookStore);
  private readonly labelStore = inject(LabelStore);
  private readonly settingsStore = inject(SettingsStore);
  private readonly shortcuts = inject(KeyboardShortcuts);
  protected readonly noteStore = inject(NoteStore);
  protected readonly ui = inject(UiStore);
  protected readonly i18n = inject(I18nService);
  protected readonly startupWarnings = signal<RecoveryWarning[]>([]);

  protected readonly currentNotebookId = computed(() => {
    const view = this.ui.view();
    return view?.kind === 'notebook' ? view.id : null;
  });

  protected readonly editorNote = computed(() => {
    const id = this.ui.editorNoteId();
    return id ? (this.noteStore.find(id) ?? null) : null;
  });

  constructor() {
    effect(() => {
      const dark = this.settingsStore.theme() === 'dark';
      document.body.classList.toggle('theme-dark', dark);
      document.body.classList.toggle('theme-light', !dark);
    });
    void this.bootstrap();
    this.shortcuts.init();
    window.glacierApi.events.onNotesChanged(() => void this.noteStore.reloadAll());
  }

  protected createTextNote(): void {
    void this.shortcuts.newNote('text');
  }

  protected createChecklistNote(): void {
    void this.shortcuts.newNote('checklist');
  }

  private async bootstrap(): Promise<void> {
    await Promise.all([
      this.notebookStore.init(),
      this.labelStore.init(),
      this.noteStore.reloadAll(),
      this.settingsStore.init(),
    ]);
    await this.ui.init();
    this.startupWarnings.set(await window.glacierApi.system.getStartupWarnings());
  }
}
