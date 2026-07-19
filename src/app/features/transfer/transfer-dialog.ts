import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { ExportScope, ImportCounts, ImportStrategy } from '../../../../electron/api';
import { I18nService } from '../../core/i18n/i18n.service';
import { LabelStore } from '../../core/store/label-store';
import { NotebookStore } from '../../core/store/notebook-store';
import { NoteStore } from '../../core/store/note-store';
import { UiStore } from '../../core/store/ui-store';

type Step =
  | { kind: 'menu' }
  | { kind: 'conflict'; counts: ImportCounts }
  | { kind: 'done'; counts: ImportCounts }
  | { kind: 'error'; errors: string[] };

@Component({
  selector: 'app-transfer-dialog',
  templateUrl: './transfer-dialog.html',
  styleUrl: './transfer-dialog.scss',
})
export class TransferDialog implements AfterViewInit, OnDestroy {
  private readonly api = window.glacierApi;
  private readonly noteStore = inject(NoteStore);
  private readonly labelStore = inject(LabelStore);
  private readonly ui = inject(UiStore);
  protected readonly notebookStore = inject(NotebookStore);
  protected readonly i18n = inject(I18nService);

  readonly closed = output<void>();

  protected readonly step = signal<Step>({ kind: 'menu' });
  protected readonly scopeKind = signal<'all' | 'notebook'>('all');
  protected readonly scopeNotebookId = signal('');
  protected readonly exportSaved = signal(false);
  protected readonly busy = signal(false);

  protected readonly notebooks = computed(() => this.notebookStore.notebooks());
  protected readonly doneCounts = computed(() => {
    const step = this.step();
    return step.kind === 'done' ? step.counts : null;
  });
  protected readonly errors = computed(() => {
    const step = this.step();
    return step.kind === 'error' ? step.errors : [];
  });

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  ngAfterViewInit(): void {
    const view = this.ui.view();
    const current = view?.kind === 'notebook' ? view.id : null;
    this.scopeNotebookId.set(current ?? this.notebooks()[0]?.id ?? '');
    this.dialogRef().nativeElement.showModal();
  }

  ngOnDestroy(): void {
    this.dialogRef().nativeElement.close();
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
    if (this.busy()) return;
    if (this.step().kind === 'conflict') {
      await this.api.transfer.importCancel();
    }
    this.closed.emit();
  }

  protected onScopeNotebookChange(event: Event): void {
    this.scopeNotebookId.set((event.target as HTMLSelectElement).value);
  }

  protected async runExport(): Promise<void> {
    if (this.busy()) return;
    const scope: ExportScope =
      this.scopeKind() === 'all'
        ? { kind: 'all' }
        : { kind: 'notebook', notebookId: this.scopeNotebookId() };
    this.busy.set(true);
    this.exportSaved.set(false);
    try {
      const result = await this.api.transfer.exportData(scope);
      this.exportSaved.set(result.status === 'saved');
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async runImport(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.exportSaved.set(false);
    try {
      const inspected = await this.api.transfer.importInspect();
      if (inspected.status === 'canceled') return;
      if (inspected.status === 'invalid') {
        this.step.set({ kind: 'error', errors: inspected.errors });
        return;
      }
      if (inspected.hasConflicts) {
        this.step.set({ kind: 'conflict', counts: inspected.counts });
        return;
      }
      await this.applyImport('preserve');
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async resolveConflict(strategy: ImportStrategy): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.applyImport(strategy);
    } catch (error) {
      this.showError(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async cancelConflict(): Promise<void> {
    await this.api.transfer.importCancel();
    this.step.set({ kind: 'menu' });
  }

  private async applyImport(strategy: ImportStrategy): Promise<void> {
    const result = await this.api.transfer.importApply(strategy);
    await Promise.all([
      this.notebookStore.reload(),
      this.labelStore.reload(),
      this.noteStore.reloadAll(),
    ]);
    this.step.set({ kind: 'done', counts: result.counts });
  }

  private showError(error: unknown): void {
    this.step.set({
      kind: 'error',
      errors: [error instanceof Error ? error.message : this.i18n.t('transfer.unknownError')],
    });
  }
}
