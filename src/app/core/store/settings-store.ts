import { Injectable, signal } from '@angular/core';
import type { LanguageCode, SystemCapabilities, ThemeName } from '../../../../electron/api';

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly api = window.glacierApi;

  readonly theme = signal<ThemeName>('dark');
  readonly language = signal<LanguageCode>('en');
  readonly moveCheckedToBottom = signal(false);
  readonly closeToTray = signal(true);
  readonly quickNoteShortcut = signal('CommandOrControl+Alt+G');
  readonly trashAutoPurgeDays = signal(30);
  readonly capabilities = signal<SystemCapabilities>({
    tray: false,
    globalShortcut: false,
    quickNoteShortcutRegistered: false,
  });
  readonly shortcutError = signal(false);

  async init(): Promise<void> {
    const [settings, capabilities] = await Promise.all([
      this.api.settings.get(),
      this.api.system.getCapabilities(),
    ]);
    this.theme.set(settings.theme);
    this.language.set(settings.language);
    this.moveCheckedToBottom.set(settings.moveCheckedToBottom);
    this.closeToTray.set(settings.closeToTray);
    this.quickNoteShortcut.set(settings.quickNoteShortcut);
    this.trashAutoPurgeDays.set(settings.trashAutoPurgeDays);
    this.capabilities.set(capabilities);
  }

  async setTheme(value: ThemeName): Promise<void> {
    this.theme.set(value);
    await this.api.settings.set({ theme: value });
  }

  async setLanguage(value: LanguageCode): Promise<void> {
    this.language.set(value);
    await this.api.settings.set({ language: value });
  }

  async setMoveCheckedToBottom(value: boolean): Promise<void> {
    this.moveCheckedToBottom.set(value);
    await this.api.settings.set({ moveCheckedToBottom: value });
  }

  async setCloseToTray(value: boolean): Promise<void> {
    this.closeToTray.set(value);
    await this.api.settings.set({ closeToTray: value });
  }

  async setQuickNoteShortcut(value: string): Promise<boolean> {
    this.shortcutError.set(false);
    try {
      const settings = await this.api.settings.set({ quickNoteShortcut: value });
      this.quickNoteShortcut.set(settings.quickNoteShortcut);
      this.capabilities.set(await this.api.system.getCapabilities());
      return true;
    } catch {
      this.shortcutError.set(true);
      this.capabilities.set(await this.api.system.getCapabilities());
      return false;
    }
  }

  async setTrashAutoPurgeDays(value: number): Promise<void> {
    this.trashAutoPurgeDays.set(value);
    await this.api.settings.set({ trashAutoPurgeDays: value });
  }
}
