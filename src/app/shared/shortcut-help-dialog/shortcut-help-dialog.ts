import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/en';

interface ShortcutRow {
  combo: string;
  labelKey: TranslationKey;
}

const IS_MAC = navigator.platform.startsWith('Mac');
const MOD = IS_MAC ? '⌘' : 'Ctrl';

@Component({
  selector: 'app-shortcut-help-dialog',
  templateUrl: './shortcut-help-dialog.html',
  styleUrl: './shortcut-help-dialog.scss',
})
export class ShortcutHelpDialog implements AfterViewInit, OnDestroy {
  readonly closed = output<void>();

  protected readonly i18n = inject(I18nService);

  protected readonly rows: ShortcutRow[] = [
    { combo: `${MOD}+N`, labelKey: 'shortcuts.newTextNote' },
    { combo: `${MOD}+Shift+N`, labelKey: 'shortcuts.newChecklist' },
    { combo: `${MOD}+F`, labelKey: 'shortcuts.focusSearch' },
    { combo: `${MOD}+Enter`, labelKey: 'shortcuts.closeEditor' },
    { combo: 'Esc', labelKey: 'shortcuts.escape' },
    { combo: `${MOD}+B / ${MOD}+I`, labelKey: 'shortcuts.boldItalic' },
    { combo: `${MOD}+E`, labelKey: 'shortcuts.transfer' },
    { combo: `${MOD}+,`, labelKey: 'shortcuts.settings' },
    { combo: `${MOD}+/`, labelKey: 'shortcuts.help' },
  ];

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
}
