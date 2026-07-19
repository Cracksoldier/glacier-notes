import { Injectable, signal } from '@angular/core';
import type { LanguageCode, ThemeName } from '../../../../electron/api';

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly api = window.glacierApi;

  readonly theme = signal<ThemeName>('dark');
  readonly language = signal<LanguageCode>('en');
  readonly moveCheckedToBottom = signal(false);
  readonly trashAutoPurgeDays = signal(30);

  async init(): Promise<void> {
    const settings = await this.api.settings.get();
    this.theme.set(settings.theme);
    this.language.set(settings.language);
    this.moveCheckedToBottom.set(settings.moveCheckedToBottom);
    this.trashAutoPurgeDays.set(settings.trashAutoPurgeDays);
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

  async setTrashAutoPurgeDays(value: number): Promise<void> {
    this.trashAutoPurgeDays.set(value);
    await this.api.settings.set({ trashAutoPurgeDays: value });
  }
}
