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
import type { Note } from '../../../../electron/api';
import { MarkdownService } from '../../core/markdown/markdown.service';
import { NoteStore } from '../../core/store/note-store';
import { UiStore } from '../../core/store/ui-store';
import { Autofocus } from '../../shared/autofocus';
import { insertLink, orderedList, prefixLines, toggleCode, wrapSelection } from './markdown-edit';
import { MarkdownToolbar, ToolbarAction } from './markdown-toolbar';

const SAVE_DEBOUNCE_MS = 500;

@Component({
  selector: 'app-note-editor-dialog',
  imports: [Autofocus, DatePipe, MarkdownToolbar],
  templateUrl: './note-editor-dialog.html',
  styleUrl: './note-editor-dialog.scss',
})
export class NoteEditorDialog implements OnInit, AfterViewInit, OnDestroy {
  readonly note = input.required<Note>();

  private readonly markdown = inject(MarkdownService);
  private readonly noteStore = inject(NoteStore);
  private readonly ui = inject(UiStore);

  protected readonly title = signal('');
  protected readonly content = signal('');
  protected readonly previewMode = signal(false);
  protected readonly previewHtml = computed(() => this.markdown.render(this.content()));

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private closing = false;
  private readonly flushOnUnload = () => void this.flush();

  ngOnInit(): void {
    this.title.set(this.note().title);
    this.content.set(this.note().content);
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

  protected onToolbar(action: ToolbarAction): void {
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
    await this.noteStore.updateInPlace(this.note().id, {
      title: this.title(),
      content: this.content(),
    });
  }
}
