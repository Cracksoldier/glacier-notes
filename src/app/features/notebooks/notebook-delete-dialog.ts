import { AfterViewInit, Component, computed, ElementRef, inject, input, OnDestroy, output, signal, viewChild } from '@angular/core';
import type { Notebook } from '../../../../electron/api';
import { I18nService } from '../../core/i18n/i18n.service';

export type NotebookDeleteResult = { mode: 'delete' } | { mode: 'move'; targetId: string };

@Component({
  selector: 'app-notebook-delete-dialog',
  templateUrl: './notebook-delete-dialog.html',
  styleUrl: './notebook-delete-dialog.scss',
})
export class NotebookDeleteDialog implements AfterViewInit, OnDestroy {
  protected readonly i18n = inject(I18nService);
  readonly notebook = input.required<Notebook>();
  readonly notebooks = input.required<Notebook[]>();
  readonly noteCount = input.required<number>();
  readonly closed = output<NotebookDeleteResult | null>();

  protected readonly mode = signal<'delete' | 'move'>('delete');
  protected readonly targetId = signal('');

  protected readonly moveTargets = computed(() => this.notebooks().filter((n) => n.id !== this.notebook().id));

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  ngAfterViewInit(): void {
    this.targetId.set(this.moveTargets()[0]?.id ?? '');
    this.dialogRef().nativeElement.showModal();
  }

  ngOnDestroy(): void {
    this.dialogRef().nativeElement.close();
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.closed.emit(null);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogRef().nativeElement) {
      this.closed.emit(null);
    }
  }

  protected confirm(): void {
    this.closed.emit(this.mode() === 'move' ? { mode: 'move', targetId: this.targetId() } : { mode: 'delete' });
  }

  protected onTargetChange(event: Event): void {
    this.targetId.set((event.target as HTMLSelectElement).value);
  }
}
