import { Menu, nativeImage, Tray } from 'electron';
import type { LanguageCode } from './storage/models';

// Embedded snowflake glyph (22px + 44px @2x) — tsc copies no assets; proper
// branded icons arrive with packaging in M10.
const ICON_22 =
  'iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAjklEQVR42t2UwRHAIAgElTJSSApLIRZGIbZhXs44DMQD8kl8osLeiZTyi9W4j8Z9ZM6QFrzOo87LUThC6K3YBAgl9hYNe434vyXOeE0R6U/emoklHUKt7YWlrtSN+5Aq0v1qFa2aLFndW1hNjHq4e0DykiAd4frSXnsoO+HciVdCVD5M/IbXoemFDqRvrBtQxXVxIT/vOAAAAABJRU5ErkJggg==';
const ICON_44 =
  'iVBORw0KGgoAAAANSUhEUgAAACwAAAAsCAYAAAAehFoBAAABGklEQVR42u1Y2xGDMAzDPqZgEAZjEAZjENagv1yPED9kB9rou4kcVX4xDB0df4h1249W3GwN1hO05yx5SJZ5IkSwmnvECl9dirCG9tH8Nu8TkrSkVumMxVI8vAyM8tydWhYl4WVNYxXLmRJGq8LeBLKqzkjCq0eg6nezpPP6mdHkZ0UjZo4QhZF11xQwsll4uyBLL7IELf2NZgKkrDlX80/cPS4tYNRjf3+WaA3SZG8tuaIsdeYlacmRVIJawLVKIeGAjX0SddMaB2qxRFgmNOmQgzsk4HXbD23h96rMkZ6NsAahA43enBnpSy152pqvJUI2FI70b8Q96R/zvs8/+tsaQmXOVDd9a17miSK6V8ri4CV56nbT0RGND5vl09222C7HAAAAAElFTkSuQmCC';

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
    const icon = nativeImage.createFromDataURL(`data:image/png;base64,${ICON_22}`);
    icon.addRepresentation({
      scaleFactor: 2,
      dataURL: `data:image/png;base64,${ICON_44}`,
    });
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
