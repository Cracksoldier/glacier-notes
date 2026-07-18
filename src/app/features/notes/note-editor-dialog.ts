import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import type { ChecklistItem, Note, NoteUpdatePatch } from '../../../../electron/api';
import { ImageUploadService } from '../../core/images/image-upload';
import { MarkdownService } from '../../core/markdown/markdown.service';
import { NoteStore } from '../../core/store/note-store';
import { SettingsStore } from '../../core/store/settings-store';
import { UiStore } from '../../core/store/ui-store';
import { Autofocus } from '../../shared/autofocus';
import { GlacierImgPipe } from '../../shared/glacier-img.pipe';
import { ChecklistEditor } from './checklist-editor';
import { checklistToText, textToChecklist } from './checklist-model';
import { insertLink, orderedList, prefixLines, toggleCode, wrapSelection } from './markdown-edit';
import { MarkdownToolbar, ToolbarAction } from './markdown-toolbar';

const SAVE_DEBOUNCE_MS = 500;

@Component({
  selector: 'app-note-editor-dialog',
  imports: [Autofocus, ChecklistEditor, DatePipe, GlacierImgPipe, MarkdownToolbar],
  templateUrl: './note-editor-dialog.html',
  styleUrl: './note-editor-dialog.scss',
})
export class NoteEditorDialog implements OnInit, AfterViewInit, OnDestroy {
  readonly note = input.required<Note>();

  private readonly markdown = inject(MarkdownService);
  private readonly noteStore = inject(NoteStore);
  private readonly upload = inject(ImageUploadService);
  protected readonly ui = inject(UiStore);
  protected readonly settings = inject(SettingsStore);

  protected readonly title = signal('');
  protected readonly content = signal('');
  protected readonly items = signal<ChecklistItem[]>([]);
  protected readonly previewMode = signal(false);
  protected readonly previewHtml = computed(() => this.markdown.render(this.content()));
  protected readonly isChecklist = computed(() => this.note().type === 'checklist');

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');
  private readonly fileInputRef = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private closing = false;
  private converting = false;
  // Set when the picker was opened from the markdown toolbar: the added
  // image should also be embedded at the cursor, not just attached.
  private insertOnAdd = false;
  private readonly flushOnUnload = () => void this.flush();

  ngOnInit(): void {
    this.title.set(this.note().title);
    this.content.set(this.note().content);
    this.items.set(this.note().checklist ?? []);
    window.addEventListener('beforeunload', this.flushOnUnload);
  }

  ngAfterViewInit(): void {
    this.dialogRef().nativeElement.showModal();
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.flushOnUnload);
    this.dialogRef().nativeElement.close();
  }

  protected onTitleInput(value: string): void {
    this.title.set(value);
    this.scheduleSave();
  }

  protected onContentInput(value: string): void {
    this.content.set(value);
    this.scheduleSave();
  }

  protected onItemsChange(items: ChecklistItem[]): void {
    this.items.set(items);
    this.scheduleSave();
  }

  protected async convert(): Promise<void> {
    if (this.converting) return;
    this.converting = true;
    try {
      await this.flush();
      if (this.isChecklist()) {
        const content = checklistToText(this.items());
        await this.noteStore.updateInPlace(this.note().id, { type: 'text', content, checklist: [] });
        this.content.set(content);
        this.items.set([]);
      } else {
        const items = textToChecklist(this.content());
        await this.noteStore.updateInPlace(this.note().id, { type: 'checklist', content: '', checklist: items });
        this.items.set(items);
        this.content.set('');
        this.previewMode.set(false);
      }
    } finally {
      this.converting = false;
    }
  }

  protected openImagePicker(insertOnAdd = false): void {
    this.insertOnAdd = insertOnAdd && !this.isChecklist();
    this.fileInputRef().nativeElement.click();
  }

  protected onFilesPicked(input: HTMLInputElement): void {
    const files = input.files ? [...input.files] : [];
    input.value = '';
    void this.addImages(files);
  }

  protected onDragOver(event: DragEvent): void {
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
    }
  }

  protected onDrop(event: DragEvent): void {
    const files = [...(event.dataTransfer?.files ?? [])].filter((f) => this.upload.isSupported(f.type));
    if (files.length === 0) return;
    event.preventDefault();
    void this.addImages(files);
  }

  protected onPaste(event: ClipboardEvent): void {
    const files = [...(event.clipboardData?.items ?? [])]
      .filter((item) => item.kind === 'file' && this.upload.isSupported(item.type))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length === 0) return;
    event.preventDefault();
    void this.addImages(files);
  }

  protected async removeImage(id: string): Promise<void> {
    const embed = new RegExp(`!\\[[^\\]]*\\]\\(glacier-img://${id}\\)`, 'g');
    const content = this.content().replace(embed, '');
    const imageIds = this.note().imageIds.filter((i) => i !== id);
    this.content.set(content);
    await this.noteStore.updateInPlace(this.note().id, { content, imageIds });
    await window.glacierApi.images.deleteIfUnreferenced(id);
  }

  private async addImages(files: File[]): Promise<void> {
    const insert = this.insertOnAdd;
    this.insertOnAdd = false;
    // Local copy: the note() input only refreshes on the next change-detection
    // pass, so reading it inside the loop would drop earlier additions.
    let imageIds = this.note().imageIds;
    for (const file of files) {
      if (!this.upload.isSupported(file.type)) continue;
      const asset = await this.upload.attach(file, file.name);
      imageIds = [...imageIds, asset.id];
      await this.noteStore.updateInPlace(this.note().id, { imageIds });
      if (insert) {
        this.insertEmbed(asset.id);
      }
    }
  }

  private insertEmbed(id: string): void {
    const embed = `![image](glacier-img://${id})`;
    const textarea = this.textareaRef()?.nativeElement;
    if (textarea) {
      const { value, selectionStart, selectionEnd } = textarea;
      const next = value.slice(0, selectionStart) + embed + value.slice(selectionEnd);
      const caret = selectionStart + embed.length;
      textarea.value = next;
      this.content.set(next);
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
    } else {
      this.content.set(this.content() ? `${this.content()}\n${embed}` : embed);
    }
    this.scheduleSave();
  }

  protected onToolbar(action: ToolbarAction): void {
    if (action === 'image') {
      this.openImagePicker(true);
      return;
    }
    const textarea = this.textareaRef()?.nativeElement;
    if (!textarea) return;
    const { value, selectionStart, selectionEnd } = textarea;
    const result = (() => {
      switch (action) {
        case 'bold':
          return wrapSelection(value, selectionStart, selectionEnd, '**');
        case 'italic':
          return wrapSelection(value, selectionStart, selectionEnd, '*');
        case 'h1':
          return prefixLines(value, selectionStart, selectionEnd, '# ');
        case 'h2':
          return prefixLines(value, selectionStart, selectionEnd, '## ');
        case 'ul':
          return prefixLines(value, selectionStart, selectionEnd, '- ');
        case 'ol':
          return orderedList(value, selectionStart, selectionEnd);
        case 'link':
          return insertLink(value, selectionStart, selectionEnd);
        case 'code':
          return toggleCode(value, selectionStart, selectionEnd);
      }
    })();
    textarea.value = result.value;
    this.content.set(result.value);
    textarea.focus();
    textarea.setSelectionRange(result.selStart, result.selEnd);
    this.scheduleSave();
  }

  protected onPreviewClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement).closest('a');
    if (anchor?.href) {
      event.preventDefault();
      void window.glacierApi.shell.openExternal(anchor.href);
    }
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    void this.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogRef().nativeElement) {
      void this.close();
    }
  }

  protected async close(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    await this.flush();
    this.ui.closeEditor();
    await this.noteStore.reloadAll();
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => void this.flush(), SAVE_DEBOUNCE_MS);
  }

  private async flush(): Promise<void> {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.dirty) return;
    this.dirty = false;
    const patch: NoteUpdatePatch = this.isChecklist()
      ? { title: this.title(), checklist: this.items() }
      : { title: this.title(), content: this.content() };
    await this.noteStore.updateInPlace(this.note().id, patch);
  }
}
