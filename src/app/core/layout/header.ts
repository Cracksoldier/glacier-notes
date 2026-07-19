import { Component, computed, effect, ElementRef, inject, viewChild } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { SettingsStore } from '../store/settings-store';
import { UiStore } from '../store/ui-store';

const SEARCH_DEBOUNCE_MS = 200;

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  protected readonly ui = inject(UiStore);
  protected readonly i18n = inject(I18nService);
  private readonly settings = inject(SettingsStore);

  protected readonly isDark = computed(() => this.settings.theme() === 'dark');

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly searchInputRef = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  constructor() {
    effect(() => {
      if (this.ui.focusSearchTick() > 0) {
        const input = this.searchInputRef().nativeElement;
        input.focus();
        input.select();
      }
    });
  }

  protected toggleTheme(): void {
    void this.settings.setTheme(this.isDark() ? 'light' : 'dark');
  }

  protected onSearchInput(value: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.ui.setSearchQuery(value), SEARCH_DEBOUNCE_MS);
  }

  protected clearSearch(input: HTMLInputElement): void {
    clearTimeout(this.searchTimer);
    input.value = '';
    this.ui.clearSearch();
  }
}
