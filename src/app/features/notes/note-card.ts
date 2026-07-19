import { Component, computed, inject, input, signal } from '@angular/core';
import type { ChecklistItem, Note } from '../../../../electron/api';
import { I18nService } from '../../core/i18n/i18n.service';
import { splitText } from '../../core/markdown/highlight';
import { MarkdownService } from '../../core/markdown/markdown.service';
import { LabelStore } from '../../core/store/label-store';
import { NoteStore } from '../../core/store/note-store';
import { SettingsStore } from '../../core/store/settings-store';
import { UiStore } from '../../core/store/ui-store';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { GlacierImgPipe } from '../../shared/glacier-img.pipe';
import { displayOrder } from './checklist-model';
import { ColorPickerMenu } from './color-picker-menu';
import { MoveNoteMenu } from './move-note-menu';
import { noteColorVar } from './note-colors';

const CARD_ITEM_LIMIT = 8;

@Component({
  selector: 'app-note-card',
  imports: [ColorPickerMenu, ConfirmDialog, GlacierImgPipe, MoveNoteMenu],
  templateUrl: './note-card.html',
  styleUrl: './note-card.scss',
})
export class NoteCard {
  readonly note = input.required<Note>();
  readonly searchQuery = input<string | null>(null);

  private readonly markdown = inject(MarkdownService);
  private readonly settings = inject(SettingsStore);
  private readonly labelStore = inject(LabelStore);
  protected readonly noteStore = inject(NoteStore);
  protected readonly ui = inject(UiStore);
  protected readonly i18n = inject(I18nService);

  protected readonly moveMenuOpen = signal(false);
  protected readonly colorMenuOpen = signal(false);
  protected readonly purgeConfirm = signal(false);
  protected readonly shareConfirm = signal(false);

  protected readonly trashed = computed(() => Boolean(this.note().deletedAt));
  protected readonly colorVar = computed(() => noteColorVar(this.note().color));
  protected readonly cardLabels = computed(() =>
    this.labelStore.labels().filter((l) => this.note().labels.includes(l.id)),
  );
  protected readonly previewHtml = computed(() =>
    this.markdown.renderPreview(this.note().content, this.searchQuery() ?? undefined),
  );

  protected readonly titleSegments = computed(() =>
    splitText(this.note().title, this.searchQuery() ?? ''),
  );

  protected readonly checklistEntries = computed(() =>
    displayOrder(this.note().checklist ?? [], this.settings.moveCheckedToBottom())
      .slice(0, CARD_ITEM_LIMIT)
      .map((item) => ({
        item,
        html: this.markdown.renderInline(item.text, this.searchQuery() ?? undefined),
      })),
  );
  protected readonly checklistMore = computed(() =>
    Math.max(0, (this.note().checklist?.length ?? 0) - CARD_ITEM_LIMIT),
  );

  protected open(): void {
    if (!this.trashed()) {
      this.ui.openEditor(this.note().id);
    }
  }

  protected openLightbox(event: Event, imageId: string): void {
    event.stopPropagation();
    this.ui.openLightbox(imageId);
  }

  protected openLabel(event: Event, labelId: string): void {
    event.stopPropagation();
    if (!this.trashed()) {
      this.ui.selectLabel(labelId);
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
    this.colorMenuOpen.set(false);
    this.moveMenuOpen.update((open) => !open);
  }

  protected toggleColorMenu(event: Event): void {
    event.stopPropagation();
    this.moveMenuOpen.set(false);
    this.colorMenuOpen.update((open) => !open);
  }

  protected share(): void {
    if (this.note().imageIds.length > 0) {
      this.shareConfirm.set(true);
    } else {
      void window.glacierApi.share.emailNote(this.note().id);
    }
  }

  protected onShareConfirmed(confirmed: boolean): void {
    this.shareConfirm.set(false);
    if (confirmed) {
      void window.glacierApi.share.emailNote(this.note().id);
    }
  }

  protected async onPurgeConfirmed(confirmed: boolean): Promise<void> {
    this.purgeConfirm.set(false);
    if (confirmed) {
      await this.noteStore.purge(this.note().id);
    }
  }
}
