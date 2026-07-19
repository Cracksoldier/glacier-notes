import { Component, inject, input, output } from '@angular/core';
import type { Note } from '../../../../electron/api';
import { I18nService, TranslationKey } from '../../core/i18n/i18n.service';
import { NoteStore } from '../../core/store/note-store';
import { NOTE_COLORS } from './note-colors';

@Component({
  selector: 'app-color-picker-menu',
  templateUrl: './color-picker-menu.html',
  styleUrl: './color-picker-menu.scss',
  host: { '(document:click)': 'closed.emit()' },
})
export class ColorPickerMenu {
  readonly note = input.required<Note>();
  readonly closed = output<void>();

  protected readonly i18n = inject(I18nService);
  private readonly noteStore = inject(NoteStore);

  protected readonly colors = NOTE_COLORS;

  protected colorTitle(color: string): string {
    return this.i18n.t(`color.${color}` as TranslationKey);
  }

  protected async choose(color: string | undefined): Promise<void> {
    await this.noteStore.updateInPlace(this.note().id, { color });
    this.closed.emit();
  }
}
