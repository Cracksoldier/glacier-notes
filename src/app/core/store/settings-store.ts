import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly api = window.glacierApi;

  readonly moveCheckedToBottom = signal(false);

  async init(): Promise<void> {
    const settings = await this.api.settings.get();
    this.moveCheckedToBottom.set(settings.moveCheckedToBottom);
  }

  async setMoveCheckedToBottom(value: boolean): Promise<void> {
    this.moveCheckedToBottom.set(value);
    await this.api.settings.set({ moveCheckedToBottom: value });
  }
}
