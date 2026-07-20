import { app, BrowserWindow, dialog, globalShortcut, ipcMain, protocol, session } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { AppCommand } from './api';
import { registerTransferIpc } from './export-import';
import { recoverImportTransaction } from './import-transaction';
import { gcImages, registerIpc } from './ipc';
import { registerShareIpc } from './mailto';
import { installAppMenu } from './menu';
import {
  isQuickNoteShortcutRegistered,
  openQuickNoteWindow,
  registerQuickNoteIpc,
  registerQuickNoteShortcut,
  setQuickNoteLanguage,
} from './quick-note';
import { setupTray, updateTrayLanguage } from './tray';
import { ImageStore } from './storage/image-store';
import { DebouncedWriter } from './storage/json-store';
import { LabelRepo } from './storage/label-repo';
import { NotebookRepo } from './storage/notebook-repo';
import { NoteRepo } from './storage/note-repo';
import { SettingsStore } from './storage/settings-store';
import type { StorageRecoveryWarning } from './storage/json-store';
import { createWindowState } from './window-state';

const isDev = process.env['GLACIER_DEV'] === '1';
const DEV_URL = 'http://localhost:4200';
const smokeRemoteRequests: string[] = [];

if (process.env['GLACIER_SMOKE'] === '1' && process.env['GLACIER_SMOKE_USER_DATA']) {
  app.setPath('userData', path.resolve(process.env['GLACIER_SMOKE_USER_DATA']));
}

const IMAGE_ID_PATTERN = /^[0-9a-f-]{36}$/;

protocol.registerSchemesAsPrivileged([
  { scheme: 'glacier-img', privileges: { secure: true, stream: true } },
]);

function registerImageProtocol(images: ImageStore): void {
  protocol.handle('glacier-img', async (request) => {
    // Strip the scheme manually — custom-scheme parsing via new URL() is
    // inconsistent, and the id must be validated to prevent path traversal.
    const id = request.url.replace(/^glacier-img:\/\//, '').replace(/\/$/, '');
    if (!IMAGE_ID_PATTERN.test(id) || !images.has(id)) {
      return new Response('Not found', { status: 404 });
    }
    const { path: filePath, mimeType } = images.getFileInfo(id);
    const data = await fs.promises.readFile(filePath);
    return new Response(data, { headers: { 'Content-Type': mimeType } });
  });
}

function installCsp(): void {
  const csp = isDev
    ? [
        `default-src 'self' ${DEV_URL}`,
        `script-src 'self' ${DEV_URL}`,
        `style-src 'self' 'unsafe-inline' ${DEV_URL}`,
        `img-src 'self' data: blob: glacier-img: ${DEV_URL}`,
        `font-src 'self' ${DEV_URL}`,
        `connect-src 'self' ${DEV_URL} ws://localhost:4200`,
      ].join('; ')
    : [
        `default-src 'self'`,
        `script-src 'self'`,
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: blob: glacier-img:`,
        `font-src 'self'`,
        `connect-src 'self'`,
      ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  if (process.env['GLACIER_SMOKE_OFFLINE'] === '1') {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
      (details, callback) => {
        smokeRemoteRequests.push(details.url);
        callback({ cancel: true });
      },
    );
  }
}

let mainWin: BrowserWindow | null = null;
let isQuitting = false;
let trayAvailable = false;
let settingsRef: SettingsStore | null = null;
let globalShortcutAvailable = true;

function refreshDesktopLanguage(language: 'en' | 'de'): void {
  installAppMenu(
    (command: AppCommand) => mainWin?.webContents.send('glacier:command', command),
    language,
  );
  updateTrayLanguage(language);
  setQuickNoteLanguage(language);
}

function showMainWindow(): void {
  if (mainWin) {
    mainWin.show();
    mainWin.focus();
  } else {
    createMainWindow();
  }
}

function createMainWindow(): void {
  const windowState = createWindowState({ width: 1200, height: 800 });
  const icon = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '..', 'build', 'icon.png');

  const win = new BrowserWindow({
    ...windowState.bounds,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#0d1b2a',
    title: 'Glacier Notes',
    icon,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWin = win;
  win.on('closed', () => {
    if (mainWin === win) {
      mainWin = null;
    }
  });
  // Close-to-tray (§5.12): reads the setting live, so toggling it needs no rewiring.
  win.on('close', (event) => {
    if (!isQuitting && trayAvailable && settingsRef?.get().closeToTray) {
      event.preventDefault();
      win.hide();
    } else if (!isQuitting) {
      isQuitting = true;
      app.quit();
    }
  });

  windowState.manage(win);
  if (windowState.isMaximized) {
    win.maximize();
  }
  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? url.startsWith(DEV_URL) : url.startsWith('file://');
    if (!allowed) {
      event.preventDefault();
    }
  });

  // Headless smoke check (GLACIER_SMOKE=1): report bridge/shell health, dump a
  // screenshot, then quit — lets automated runs verify the app without a human.
  if (process.env['GLACIER_SMOKE'] === '1') {
    win.webContents.on('console-message', (event) => {
      console.log('[renderer]', event.level, event.message);
    });
    win.webContents.on('did-finish-load', () => {
      void (async () => {
        try {
          const ping = await win.webContents.executeJavaScript('window.glacierApi.ping()');
          const requireType = await win.webContents.executeJavaScript('typeof window.require');
          const title = await win.webContents.executeJavaScript(
            `document.querySelector('.header__title')?.textContent ?? null`,
          );
          const bodyClass = await win.webContents.executeJavaScript('document.body.className');
          await new Promise((resolve) => setTimeout(resolve, 500));
          const fonts = await win.webContents.executeJavaScript(
            `document.fonts.ready.then(() => [...document.fonts].map(f => f.family + ':' + f.weight + ':' + f.status))`,
          );
          const iconProbe = await win.webContents.executeJavaScript(
            `(() => { const el = document.querySelector('.fa-solid'); if (!el) return null;
               const cs = getComputedStyle(el, '::before');
               return { family: cs.fontFamily, content: cs.content, sheets: document.styleSheets.length }; })()`,
          );
          const probeFile = process.env['GLACIER_SMOKE_PROBE'];
          if (probeFile) {
            const cssProbe = await win.webContents.executeJavaScript(
              fs.readFileSync(probeFile, 'utf-8'),
            );
            console.log('[smoke:probe]', JSON.stringify(cssProbe));
          }
          const image = await win.webContents.capturePage();
          fs.writeFileSync(path.join(app.getPath('temp'), 'glacier-smoke.png'), image.toPNG());
          const resources = await win.webContents.executeJavaScript(
            `performance.getEntriesByType('resource').map(entry => entry.name)`,
          );
          const result = {
            ping,
            requireType,
            title,
            bodyClass,
            fonts,
            iconProbe,
            resources,
            remoteRequests: smokeRemoteRequests,
          };
          const resultFile = process.env['GLACIER_SMOKE_RESULT'];
          if (resultFile) fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
          console.log('[smoke]', JSON.stringify(result));
        } catch (err) {
          console.error('[smoke] failed:', err);
          process.exitCode = 1;
        }
        app.quit();
      })();
    });
  }

  if (isDev) {
    void win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'glacier-notes', 'browser', 'index.html'));
  }
}

app
  .whenReady()
  .then(() => {
    installCsp();

    const baseDir = app.getPath('userData');
    const startupWarnings: StorageRecoveryWarning[] = [];
    const onCorrupt = (warning: StorageRecoveryWarning) => startupWarnings.push(warning);
    recoverImportTransaction(baseDir);
    const writer = new DebouncedWriter();
    const notebooks = new NotebookRepo(baseDir, writer, onCorrupt);
    const notes = new NoteRepo(baseDir, writer, onCorrupt);
    const labels = new LabelRepo(baseDir, writer, notes, onCorrupt);
    const images = new ImageStore(baseDir, onCorrupt);
    const settings = new SettingsStore(baseDir, app.getLocale(), onCorrupt);
    notebooks.init();
    notes.init();
    labels.init();
    images.init();
    settings.init();
    gcImages({ notes, images }, notes.purgeExpired(settings.get().trashAutoPurgeDays));
    registerImageProtocol(images);
    const repos = { notebooks, notes, labels, images, settings };
    settingsRef = settings;
    const isSmoke = process.env['GLACIER_SMOKE'] === '1';
    // Heuristic: globalShortcut.register silently fails on most Wayland compositors.
    globalShortcutAvailable =
      process.platform !== 'linux' || process.env['XDG_SESSION_TYPE'] !== 'wayland';

    registerIpc(repos, {
      setSettings: (prev, patch, commit) => {
        const nextShortcut = patch.quickNoteShortcut;
        const changesShortcut =
          nextShortcut !== undefined && nextShortcut !== prev.quickNoteShortcut;
        if (changesShortcut && globalShortcutAvailable && !isSmoke) {
          if (!registerQuickNoteShortcut(nextShortcut)) {
            registerQuickNoteShortcut(prev.quickNoteShortcut);
            throw new Error('Unable to register quick-note shortcut');
          }
        }
        try {
          const next = commit();
          if (prev.language !== next.language) refreshDesktopLanguage(next.language);
          return next;
        } catch (error) {
          if (changesShortcut && globalShortcutAvailable && !isSmoke) {
            registerQuickNoteShortcut(prev.quickNoteShortcut);
          }
          throw error;
        }
      },
    });
    registerTransferIpc(repos, writer, () => mainWin, baseDir);
    registerShareIpc(repos);
    registerQuickNoteIpc(repos, () => mainWin);
    ipcMain.handle('system:getCapabilities', () => ({
      tray: trayAvailable,
      globalShortcut: globalShortcutAvailable,
      quickNoteShortcutRegistered: isQuickNoteShortcutRegistered(),
    }));
    ipcMain.handle('system:getStartupWarnings', () =>
      startupWarnings.map((warning) => ({ ...warning })),
    );
    refreshDesktopLanguage(settings.get().language);

    // Tray and global shortcuts touch the desktop environment — skip them in headless smoke runs.
    if (!isSmoke) {
      trayAvailable = setupTray(
        {
          onOpen: () => showMainWindow(),
          onQuickNote: () => openQuickNoteWindow(),
          onQuit: () => app.quit(),
        },
        settings.get().language,
      ).available;
      if (globalShortcutAvailable) registerQuickNoteShortcut(settings.get().quickNoteShortcut);
    }

    app.on('before-quit', () => {
      isQuitting = true;
      writer.flush();
    });
    app.on('will-quit', () => globalShortcut.unregisterAll());

    createMainWindow();

    app.on('activate', () => showMainWindow());
  })
  .catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox(
      'Glacier Notes',
      `Glacier Notes could not open its local data directory.\n\n${detail}`,
    );
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
