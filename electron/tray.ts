import { app, Menu, nativeImage, Tray } from 'electron';
import * as path from 'path';
import type { LanguageCode } from './storage/models';

export interface TrayHandlers {
  onOpen(): void;
  onQuickNote(): void;
  onQuit(): void;
}

let tray: Tray | null = null;
let trayHandlers: TrayHandlers | null = null;

function applyMenu(language: LanguageCode): void {
  if (!tray || !trayHandlers) return;
  const de = language === 'de';
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: de ? 'Glacier Notes öffnen' : 'Open Glacier Notes',
        click: () => trayHandlers?.onOpen(),
      },
      { label: de ? 'Schnellnotiz' : 'Quick note', click: () => trayHandlers?.onQuickNote() },
      { type: 'separator' },
      { label: de ? 'Beenden' : 'Quit', click: () => trayHandlers?.onQuit() },
    ]),
  );
}

/** Returns availability so callers can degrade (Linux DEs without tray support). */
export function setupTray(handlers: TrayHandlers, language: LanguageCode): { available: boolean } {
  try {
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'tray.png')
      : path.join(__dirname, '..', 'build', 'tray.png');
    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error(`Tray icon unavailable: ${iconPath}`);
    tray = new Tray(icon);
    trayHandlers = handlers;
    tray.setToolTip('Glacier Notes');
    applyMenu(language);
    tray.on('click', () => handlers.onOpen());
    return { available: true };
  } catch {
    tray = null;
    trayHandlers = null;
    return { available: false };
  }
}

export function updateTrayLanguage(language: LanguageCode): void {
  applyMenu(language);
}
