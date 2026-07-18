import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createWindowState } from './window-state';

const isDev = process.env['GLACIER_DEV'] === '1';
const DEV_URL = 'http://localhost:4200';

function installCsp(): void {
  const csp = isDev
    ? [
        `default-src 'self' ${DEV_URL}`,
        `script-src 'self' ${DEV_URL}`,
        `style-src 'self' 'unsafe-inline' ${DEV_URL}`,
        `img-src 'self' data: blob: ${DEV_URL}`,
        `font-src 'self' ${DEV_URL}`,
        `connect-src 'self' ${DEV_URL} ws://localhost:4200`,
      ].join('; ')
    : [
        `default-src 'self'`,
        `script-src 'self'`,
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: blob:`,
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
  ipcMain.handle('app:ping', () => 'pong');
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
