import { BrowserWindow, globalShortcut, ipcMain } from 'electron';
import * as path from 'path';
import { Repos } from './ipc';

const isDev = process.env['GLACIER_DEV'] === '1';
const DEV_URL = 'http://localhost:4200';

let quickWin: BrowserWindow | null = null;
let shortcutRegistered = false;
let registeredAccelerator: string | null = null;
let quickNoteTitle = 'Glacier Notes — Quick note';

export function setQuickNoteLanguage(language: 'en' | 'de'): void {
  quickNoteTitle =
    language === 'de' ? 'Glacier Notes — Schnellnotiz' : 'Glacier Notes — Quick note';
  if (quickWin && !quickWin.isDestroyed()) quickWin.setTitle(quickNoteTitle);
}

/** Singleton always-on-top capture window; reuses the main Angular bundle via #quick-note. */
export function openQuickNoteWindow(): void {
  if (quickWin) {
    quickWin.show();
    quickWin.focus();
    return;
  }
  quickWin = new BrowserWindow({
    width: 420,
    height: 280,
    alwaysOnTop: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    title: quickNoteTitle,
    backgroundColor: '#0d1b2a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  quickWin.on('closed', () => {
    quickWin = null;
  });
  if (isDev) {
    void quickWin.loadURL(`${DEV_URL}/#quick-note`);
  } else {
    void quickWin.loadFile(
      path.join(__dirname, '..', 'dist', 'glacier-notes', 'browser', 'index.html'),
      {
        hash: 'quick-note',
      },
    );
  }
}

export function registerQuickNoteIpc(
  repos: Pick<Repos, 'notes' | 'notebooks'>,
  getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle('quickNote:save', (_e, content: unknown) => {
    if (typeof content !== 'string') {
      throw new Error('Invalid quick note content');
    }
    if (content.trim().length > 0) {
      repos.notes.create({
        notebookId: repos.notebooks.getDefaultId(),
        type: 'text',
        content,
      });
      const main = getMainWindow();
      if (main && !main.isDestroyed()) {
        main.webContents.send('glacier:notes-changed');
      }
    }
    quickWin?.close();
  });
  ipcMain.handle('quickNote:cancel', () => {
    quickWin?.close();
  });
}

/** Re-registers the global shortcut; returns success (fails on Wayland or invalid accelerators). */
export function registerQuickNoteShortcut(accelerator: string): boolean {
  if (registeredAccelerator) {
    try {
      globalShortcut.unregister(registeredAccelerator);
    } catch {
      // previous accelerator no longer valid — nothing to release
    }
    registeredAccelerator = null;
  }
  shortcutRegistered = false;
  if (accelerator.length === 0) {
    return false;
  }
  try {
    shortcutRegistered = globalShortcut.register(accelerator, () => openQuickNoteWindow());
  } catch {
    shortcutRegistered = false;
  }
  if (shortcutRegistered) {
    registeredAccelerator = accelerator;
  }
  return shortcutRegistered;
}

export function isQuickNoteShortcutRegistered(): boolean {
  return shortcutRegistered;
}
