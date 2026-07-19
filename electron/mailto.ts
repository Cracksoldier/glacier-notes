import { ipcMain, shell } from 'electron';
import { Repos } from './ipc';
import { Note } from './storage/models';

export function buildMailtoUrl(note: Note): string {
  const body =
    note.type === 'checklist'
      ? [...(note.checklist ?? [])]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`)
          .join('\n')
      : note.content;
  return `mailto:?subject=${encodeURIComponent(note.title)}&body=${encodeURIComponent(body)}`;
}

export function registerShareIpc(repos: Pick<Repos, 'notes'>): void {
  // Deliberately not routed through shell:openExternal, which allows http(s) only.
  ipcMain.handle('share:emailNote', (_e, noteId: unknown) => {
    if (typeof noteId !== 'string' || noteId.length === 0) {
      throw new Error('Invalid note id');
    }
    return shell.openExternal(buildMailtoUrl(repos.notes.get(noteId)));
  });
}
