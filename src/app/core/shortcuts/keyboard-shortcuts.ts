import { inject, Injectable } from '@angular/core';
import type { AppCommand, NoteType } from '../../../../electron/api';
import { NoteStore } from '../store/note-store';
import { UiStore } from '../store/ui-store';

/**
 * Owns all §5.11 application shortcuts. The Electron menu shows the same
 * accelerators as hints only (registerAccelerator: false) and routes its
 * clicks here via events.onCommand, so every shortcut fires exactly once.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardShortcuts {
  private readonly ui = inject(UiStore);
  private readonly noteStore = inject(NoteStore);

  private unsubscribe: (() => void) | null = null;

  init(): void {
    if (this.unsubscribe) return;
    document.addEventListener('keydown', this.onKeydown, true);
    this.unsubscribe = window.glacierApi.events.onCommand((command) => this.run(command));
  }

  async newNote(type: NoteType): Promise<void> {
    const view = this.ui.view();
    const notebookId =
      view?.kind === 'notebook' ? view.id : await window.glacierApi.notebooks.getDefaultId();
    const note = await this.noteStore.create({
      notebookId,
      type,
      ...(type === 'checklist' ? { checklist: [] } : {}),
    });
    this.ui.openEditor(note.id);
  }

  private run(command: AppCommand): void {
    // The editor dialog owns its own keys; don't stack dialogs on top of it.
    if (this.ui.editorNoteId()) return;
    switch (command) {
      case 'new-text-note':
        void this.newNote('text');
        break;
      case 'new-checklist-note':
        void this.newNote('checklist');
        break;
      case 'toggle-transfer':
        this.ui.toggleTransfer();
        break;
      case 'open-settings':
        this.ui.openSettings();
        break;
      case 'toggle-shortcut-help':
        this.ui.toggleShortcutHelp();
        break;
    }
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const command = this.match(event);
    if (!command) return;
    event.preventDefault();
    if (command === 'focus-search') {
      if (!this.ui.editorNoteId()) {
        this.ui.focusSearch();
      }
      return;
    }
    this.run(command);
  };

  private match(event: KeyboardEvent): AppCommand | 'focus-search' | null {
    switch (event.key.toLowerCase()) {
      case 'n':
        return event.shiftKey ? 'new-checklist-note' : 'new-text-note';
      case 'e':
        return 'toggle-transfer';
      case ',':
        return 'open-settings';
      case '/':
        return 'toggle-shortcut-help';
      case 'f':
        return 'focus-search';
      default:
        return null;
    }
  }
}
