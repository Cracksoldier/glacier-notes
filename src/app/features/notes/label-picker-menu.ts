import { Component, inject, input, output, signal } from '@angular/core';
import type { Note } from '../../../../electron/api';
import { I18nService } from '../../core/i18n/i18n.service';
import { LabelStore } from '../../core/store/label-store';
import { NoteStore } from '../../core/store/note-store';

@Component({
  selector: 'app-label-picker-menu',
  templateUrl: './label-picker-menu.html',
  styleUrl: './label-picker-menu.scss',
  host: { '(document:click)': 'closed.emit()' },
})
export class LabelPickerMenu {
  readonly note = input.required<Note>();
  readonly closed = output<void>();

  protected readonly i18n = inject(I18nService);
  protected readonly labelStore = inject(LabelStore);
  private readonly noteStore = inject(NoteStore);

  protected readonly newName = signal('');
  // Local copy: the note() input only refreshes on the next change-detection
  // pass, so rapid toggles must not re-read it (stale-input pitfall).
  private assigned: string[] | null = null;

  protected isAssigned(labelId: string): boolean {
    return (this.assigned ?? this.note().labels).includes(labelId);
  }

  protected async toggle(labelId: string): Promise<void> {
    const current = this.assigned ?? this.note().labels;
    this.assigned = current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId];
    await this.noteStore.updateInPlace(this.note().id, { labels: this.assigned });
  }

  protected async createAndAssign(): Promise<void> {
    const name = this.newName().trim();
    if (!name) return;
    this.newName.set('');
    const label = await this.labelStore.create(name);
    await this.toggle(label.id);
  }
}
