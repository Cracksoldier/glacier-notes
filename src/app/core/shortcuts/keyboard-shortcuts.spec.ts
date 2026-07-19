import { TestBed } from '@angular/core/testing';
import { installGlacierApiStub } from '../../testing/glacier-api-stub';
import { NotebookStore } from '../store/notebook-store';
import { NoteStore } from '../store/note-store';
import { UiStore } from '../store/ui-store';
import { KeyboardShortcuts } from './keyboard-shortcuts';

describe('KeyboardShortcuts', () => {
  it('routes renderer keys and main-process commands without stacking dialogs', async () => {
    const state = installGlacierApiStub();
    const notebooks = TestBed.inject(NotebookStore);
    const notes = TestBed.inject(NoteStore);
    const ui = TestBed.inject(UiStore);
    const shortcuts = TestBed.inject(KeyboardShortcuts);
    await notebooks.init();
    await notes.reloadAll();
    await ui.init();
    shortcuts.init();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.notes).toHaveLength(1);
    expect(ui.editorNoteId()).toBe(state.notes[0].id);

    ui.closeEditor();
    state.fireCommand('open-settings');
    expect(ui.settingsOpen()).toBe(true);
    state.fireCommand('toggle-transfer');
    expect(ui.settingsOpen()).toBe(false);
    expect(ui.transferOpen()).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }));
    expect(ui.focusSearchTick()).toBe(1);
  });
});
