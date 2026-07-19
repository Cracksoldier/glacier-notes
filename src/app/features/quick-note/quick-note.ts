import { Component, effect, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { SettingsStore } from '../../core/store/settings-store';
import { Autofocus } from '../../shared/autofocus';

/** Minimal capture UI for the always-on-top quick-note window (§5.12). */
@Component({
  selector: 'app-quick-note',
  imports: [Autofocus],
  templateUrl: './quick-note.html',
  styleUrl: './quick-note.scss',
})
export class QuickNote {
  private readonly api = window.glacierApi;
  private readonly settings = inject(SettingsStore);
  protected readonly i18n = inject(I18nService);
  protected readonly saving = signal(false);

  constructor() {
    effect(() => {
      const dark = this.settings.theme() === 'dark';
      document.body.classList.toggle('theme-dark', dark);
      document.body.classList.toggle('theme-light', !dark);
    });
    void this.settings.init();
  }

  protected save(value: string): void {
    if (this.saving()) return;
    this.saving.set(true);
    void this.api.quickNote.save(value).catch(() => this.saving.set(false));
  }

  protected cancel(): void {
    void this.api.quickNote.cancel();
  }

  protected onKeydown(event: KeyboardEvent, value: string): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.save(value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
    }
  }
}
