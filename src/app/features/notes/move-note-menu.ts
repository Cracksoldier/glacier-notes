import { Component, computed, inject, input, output } from '@angular/core';
import type { Note } from '../../../../electron/api';
import { NotebookStore } from '../../core/store/notebook-store';
import { NoteStore } from '../../core/store/note-store';

@Component({
  selector: 'app-move-note-menu',
  templateUrl: './move-note-menu.html',
  styleUrl: './move-note-menu.scss',
  host: { '(document:click)': 'closed.emit()' },
})
export class MoveNoteMenu {
  readonly note = input.required<Note>();
  readonly closed = output<void>();

  private readonly notebookStore = inject(NotebookStore);
  private readonly noteStore = inject(NoteStore);

  protected readonly targets = computed(() =>
    this.notebookStore.notebooks().filter((n) => n.id !== this.note().notebookId),
  );

  protected async choose(notebookId: string): Promise<void> {
    await this.noteStore.move(this.note().id, notebookId);
    this.closed.emit();
  }
}
