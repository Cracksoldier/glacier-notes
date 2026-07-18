import { AfterViewInit, Component, ElementRef, input, OnDestroy, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog implements AfterViewInit, OnDestroy {
  readonly title = input.required<string>();
  readonly message = input('');
  readonly confirmLabel = input('Delete');
  readonly closed = output<boolean>();

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  ngAfterViewInit(): void {
    this.dialogRef().nativeElement.showModal();
  }

  ngOnDestroy(): void {
    this.dialogRef().nativeElement.close();
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.closed.emit(false);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogRef().nativeElement) {
      this.closed.emit(false);
    }
  }
}
