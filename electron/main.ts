import { app, BrowserWindow, protocol, session } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { gcImages, registerIpc } from './ipc';
import { ImageStore } from './storage/image-store';
import { DebouncedWriter } from './storage/json-store';
import { LabelRepo } from './storage/label-repo';
import { NotebookRepo } from './storage/notebook-repo';
import { NoteRepo } from './storage/note-repo';
import { SettingsStore } from './storage/settings-store';
import { createWindowState } from './window-state';

const isDev = process.env['GLACIER_DEV'] === '1';
const DEV_URL = 'http://localhost:4200';

const IMAGE_ID_PATTERN = /^[0-9a-f-]{36}$/;

protocol.registerSchemesAsPrivileged([{ scheme: 'glacier-img', privileges: { secure: true, stream: true } }]);

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
}

function createMainWindow(): void {
  const windowState = createWindowState({ width: 1200, height: 800 });

  const win = new BrowserWindow({
    ...windowState.bounds,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#0d1b2a',
    title: 'Glacier Notes',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
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
            const cssProbe = await win.webContents.executeJavaScript(fs.readFileSync(probeFile, 'utf-8'));
            console.log('[smoke:probe]', JSON.stringify(cssProbe));
          }
          const image = await win.webContents.capturePage();
          fs.writeFileSync(path.join(app.getPath('temp'), 'glacier-smoke.png'), image.toPNG());
          console.log('[smoke]', JSON.stringify({ ping, requireType, title, bodyClass, fonts, iconProbe }));
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

app.whenReady().then(() => {
  installCsp();

  const baseDir = app.getPath('userData');
  const writer = new DebouncedWriter();
  const notebooks = new NotebookRepo(baseDir, writer);
  const notes = new NoteRepo(baseDir, writer);
  const labels = new LabelRepo(baseDir, writer, notes);
  const images = new ImageStore(baseDir);
  const settings = new SettingsStore(baseDir, app.getLocale());
  notebooks.init();
  notes.init();
  labels.init();
  images.init();
  settings.init();
  gcImages({ notes, images }, notes.purgeExpired(settings.get().trashAutoPurgeDays));
  registerImageProtocol(images);
  registerIpc({ notebooks, notes, labels, images, settings });
  app.on('before-quit', () => writer.flush());

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
