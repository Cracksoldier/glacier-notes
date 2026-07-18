import { Component, computed, inject, input, signal } from '@angular/core';
import type { Note } from '../../../../electron/api';
import { MarkdownService } from '../../core/markdown/markdown.service';
import { NoteStore } from '../../core/store/note-store';
import { UiStore } from '../../core/store/ui-store';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { MoveNoteMenu } from './move-note-menu';

@Component({
  selector: 'app-note-card',
  imports: [ConfirmDialog, MoveNoteMenu],
  templateUrl: './note-card.html',
  styleUrl: './note-card.scss',
})
export class NoteCard {
  readonly note = input.required<Note>();

  private readonly markdown = inject(MarkdownService);
  protected readonly noteStore = inject(NoteStore);
  protected readonly ui = inject(UiStore);

  protected readonly moveMenuOpen = signal(false);
  protected readonly purgeConfirm = signal(false);

  protected readonly trashed = computed(() => Boolean(this.note().deletedAt));
  protected readonly previewHtml = computed(() => this.markdown.renderPreview(this.note().content));

  protected open(): void {
    if (!this.trashed()) {
      this.ui.openEditor(this.note().id);
    }
  }

  protected onPreviewClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement).closest('a');
    if (anchor?.href) {
      event.preventDefault();
      event.stopPropagation();
      void window.glacierApi.shell.openExternal(anchor.href);
    }
  }

  protected toggleMoveMenu(event: Event): void {
    event.stopPropagation();
    this.moveMenuOpen.update((open) => !open);
  }

  protected async onPurgeConfirmed(confirmed: boolean): Promise<void> {
    this.purgeConfirm.set(false);
    if (confirmed) {
      await this.noteStore.purge(this.note().id);
    }
  }
}
