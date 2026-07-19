import { Menu, MenuItemConstructorOptions } from 'electron';
import { AppCommand } from './api';
import type { LanguageCode } from './storage/models';

const isDev = process.env['GLACIER_DEV'] === '1';

/**
 * The renderer owns every §5.11 shortcut; menu items only display the
 * accelerator hints (registerAccelerator: false prevents double-firing).
 */
export function installAppMenu(
  sendCommand: (command: AppCommand) => void,
  language: LanguageCode,
): void {
  const de = language === 'de';
  const command = (
    label: string,
    accelerator: string,
    cmd: AppCommand,
  ): MenuItemConstructorOptions => ({
    label,
    accelerator,
    registerAccelerator: false,
    click: () => sendCommand(cmd),
  });

  const template: MenuItemConstructorOptions[] = [
    {
      label: de ? '&Datei' : '&File',
      submenu: [
        command(de ? 'Neue Notiz' : 'New Note', 'CmdOrCtrl+N', 'new-text-note'),
        command(
          de ? 'Neue Checkliste' : 'New Checklist',
          'CmdOrCtrl+Shift+N',
          'new-checklist-note',
        ),
        { type: 'separator' },
        command(de ? 'Import / Export' : 'Import / Export', 'CmdOrCtrl+E', 'toggle-transfer'),
        command(de ? 'Einstellungen' : 'Settings', 'CmdOrCtrl+,', 'open-settings'),
        { type: 'separator' },
        { role: 'quit', accelerator: 'CmdOrCtrl+Q' },
      ],
    },
    { role: 'editMenu' },
    ...(isDev
      ? [
          {
            label: 'View',
            submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: de ? 'Hilfe' : 'Help',
      submenu: [
        command(de ? 'Tastenkürzel' : 'Keyboard Shortcuts', 'CmdOrCtrl+/', 'toggle-shortcut-help'),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
