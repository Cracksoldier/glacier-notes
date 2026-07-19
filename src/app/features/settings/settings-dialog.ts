import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';
import type { LanguageCode, ThemeName } from '../../../../electron/api';
import { I18nService } from '../../core/i18n/i18n.service';
import { SettingsStore } from '../../core/store/settings-store';

@Component({
  selector: 'app-settings-dialog',
  templateUrl: './settings-dialog.html',
  styleUrl: './settings-dialog.scss',
})
export class SettingsDialog implements AfterViewInit, OnDestroy {
  readonly closed = output<void>();

  protected readonly settings = inject(SettingsStore);
  protected readonly i18n = inject(I18nService);

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  ngAfterViewInit(): void {
    this.dialogRef().nativeElement.showModal();
  }

  ngOnDestroy(): void {
    this.dialogRef().nativeElement.close();
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.closed.emit();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogRef().nativeElement) {
      this.closed.emit();
    }
  }

  protected setTheme(value: string): void {
    void this.settings.setTheme(value as ThemeName);
  }

  protected setLanguage(value: string): void {
    void this.settings.setLanguage(value as LanguageCode);
  }

  protected setPurgeDays(value: string): void {
    const days = Math.max(0, Math.floor(Number(value)));
    if (Number.isFinite(days)) {
      void this.settings.setTrashAutoPurgeDays(days);
    }
  }
}
