import { computed, inject, Injectable } from '@angular/core';
import { SettingsStore } from '../store/settings-store';
import { de } from './de';
import { en, TranslationKey } from './en';

export type { TranslationKey };

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly settings = inject(SettingsStore);

  // Reading the table through this computed makes every t()/formatDate() call
  // in a template binding reactive to language switches (zoneless signal CD).
  private readonly table = computed<Record<TranslationKey, string>>(() =>
    this.settings.language() === 'de' ? de : en,
  );

  t(key: TranslationKey, params?: Record<string, string | number>): string {
    let text = this.table()[key] ?? en[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replace(`{${name}}`, String(value));
      }
    }
    return text;
  }

  formatDate(iso: string): string {
    const locale = this.settings.language() === 'de' ? 'de-DE' : 'en-US';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  }
}
