import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  protected readonly isDark = signal(true);

  // Placeholder for M1: toggles the theme class only. Persistence arrives with
  // the settings store (M2) and the full theming pass (M7).
  protected toggleTheme(): void {
    this.isDark.update((dark) => !dark);
    document.body.classList.toggle('theme-dark', this.isDark());
    document.body.classList.toggle('theme-light', !this.isDark());
  }
}
