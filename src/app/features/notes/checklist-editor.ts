import { afterEveryRender, Component, computed, ElementRef, inject, input, model, signal, viewChildren } from '@angular/core';
import type { ChecklistItem } from '../../../../electron/api';
import { I18nService } from '../../core/i18n/i18n.service';
import { displayOrder, newItem, reorderItems, resequence } from './checklist-model';

@Component({
  selector: 'app-checklist-editor',
  templateUrl: './checklist-editor.html',
  styleUrl: './checklist-editor.scss',
})
export class ChecklistEditor {
  // model() so mutations update synchronously — deriving new arrays from a plain
  // input() would read stale state until the next change-detection pass.
  protected readonly i18n = inject(I18nService);

  readonly items = model.required<ChecklistItem[]>();
  readonly moveCheckedToBottom = input.required<boolean>();

  protected readonly displayed = computed(() => displayOrder(this.items(), this.moveCheckedToBottom()));
  protected readonly dragIndex = signal<number | null>(null);
  protected readonly dropIndex = signal<number | null>(null);

  private readonly inputRefs = viewChildren<ElementRef<HTMLInputElement>>('itemInput');
  private pendingFocusId: string | null = null;

  constructor() {
    afterEveryRender(() => {
      if (this.pendingFocusId === null) return;
      const index = this.displayed().findIndex((i) => i.id === this.pendingFocusId);
      this.pendingFocusId = null;
      this.inputRefs()[index]?.nativeElement.focus();
    });
  }

  protected toggle(item: ChecklistItem): void {
    this.items.update((items) => items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)));
  }

  protected onTextInput(item: ChecklistItem, text: string): void {
    this.items.update((items) => items.map((i) => (i.id === item.id ? { ...i, text } : i)));
  }

  protected addItem(): void {
    const item = newItem('', this.items().length);
    this.pendingFocusId = item.id;
    this.items.update((items) => [...items, item]);
  }

  protected insertAfter(displayIndex: number): void {
    const display = [...this.displayed()];
    const item = newItem('', 0);
    display.splice(displayIndex + 1, 0, item);
    this.pendingFocusId = item.id;
    this.items.set(resequence(display));
  }

  protected removeAt(displayIndex: number): void {
    const display = [...this.displayed()];
    display.splice(displayIndex, 1);
    this.items.set(resequence(display));
  }

  protected onKeydown(event: KeyboardEvent, displayIndex: number): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.insertAfter(displayIndex);
    } else if (event.key === 'Backspace' && (event.target as HTMLInputElement).value === '') {
      event.preventDefault();
      const previous = this.displayed()[displayIndex - 1];
      this.pendingFocusId = previous?.id ?? null;
      this.removeAt(displayIndex);
    }
  }

  protected onDragStart(event: DragEvent, displayIndex: number): void {
    event.dataTransfer?.setData('text/plain', '');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    this.dragIndex.set(displayIndex);
  }

  protected onDragOver(event: DragEvent, displayIndex: number): void {
    if (this.dragIndex() === null) return;
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const before = event.clientY < rect.top + rect.height / 2;
    this.dropIndex.set(before ? displayIndex : displayIndex + 1);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    const from = this.dragIndex();
    const drop = this.dropIndex();
    this.dragIndex.set(null);
    this.dropIndex.set(null);
    if (from === null || drop === null) return;
    const to = drop > from ? drop - 1 : drop;
    if (to === from) return;
    this.items.set(reorderItems(this.items(), from, to, this.moveCheckedToBottom()));
  }

  protected onDragEnd(): void {
    this.dragIndex.set(null);
    this.dropIndex.set(null);
  }
}
