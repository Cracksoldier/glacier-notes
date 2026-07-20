import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';
import type { RecoveryWarning } from '../../../../electron/api';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-storage-recovery-dialog',
  templateUrl: './storage-recovery-dialog.html',
  styleUrl: './storage-recovery-dialog.scss',
})
export class StorageRecoveryDialog implements AfterViewInit, OnDestroy {
  readonly warnings = input.required<RecoveryWarning[]>();
  readonly closed = output<void>();

  protected readonly i18n = inject(I18nService);

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  ngAfterViewInit(): void {
    this.dialogRef().nativeElement.showModal();
  }

  ngOnDestroy(): void {
    this.dialogRef().nativeElement.close();
  }

  protected close(event?: Event): void {
    event?.preventDefault();
    this.closed.emit();
  }
}
