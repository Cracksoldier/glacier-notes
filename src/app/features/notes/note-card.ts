import { Component, computed, inject, input, signal } from '@angular/core';
import type { ChecklistItem, Note } from '../../../../electron/api';
import { MarkdownService } from '../../core/markdown/markdown.service';
import { NoteStore } from '../../core/store/note-store';
import { SettingsStore } from '../../core/store/settings-store';
import { UiStore } from '../../core/store/ui-store';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { displayOrder } from './checklist-model';
import { MoveNoteMenu } from './move-note-menu';

const CARD_ITEM_LIMIT = 8;

@Component({
  selector: 'app-note-card',
  imports: [ConfirmDialog, MoveNoteMenu],
  templateUrl: './note-card.html',
  styleUrl: './note-card.scss',
})
export class NoteCard {
  readonly note = input.required<Note>();

  private readonly markdown = inject(MarkdownService);
  private readonly settings = inject(SettingsStore);
  protected readonly noteStore = inject(NoteStore);
  protected readonly ui = inject(UiStore);

  protected readonly moveMenuOpen = signal(false);
  protected readonly purgeConfirm = signal(false);

  protected readonly trashed = computed(() => Boolean(this.note().deletedAt));
  protected readonly previewHtml = computed(() => this.markdown.renderPreview(this.note().content));

  protected readonly checklistEntries = computed(() =>
    displayOrder(this.note().checklist ?? [], this.settings.moveCheckedToBottom())
      .slice(0, CARD_ITEM_LIMIT)
      .map((item) => ({ item, html: this.markdown.renderInline(item.text) })),
  );
  protected readonly checklistMore = computed(() =>
    Math.max(0, (this.note().checklist?.length ?? 0) - CARD_ITEM_LIMIT),
  );

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

  protected async toggleItem(item: ChecklistItem): Promise<void> {
    const checklist = (this.note().checklist ?? []).map((i) =>
      i.id === item.id ? { ...i, checked: !i.checked } : i,
    );
    await this.noteStore.updateInPlace(this.note().id, { checklist });
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
