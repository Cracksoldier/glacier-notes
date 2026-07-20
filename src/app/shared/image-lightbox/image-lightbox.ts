import {
  AfterViewInit,
  Component,
  ElementRef,
  input,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';
import { GlacierImgPipe } from '../glacier-img.pipe';

@Component({
  selector: 'app-image-lightbox',
  imports: [GlacierImgPipe],
  templateUrl: './image-lightbox.html',
  styleUrl: './image-lightbox.scss',
})
export class ImageLightbox implements AfterViewInit, OnDestroy {
  readonly imageId = input.required<string>();
  readonly closed = output<void>();

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  ngAfterViewInit(): void {
    this.dialogRef().nativeElement.showModal();
  }

  ngOnDestroy(): void {
    this.dialogRef().nativeElement.close();
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.closed.emit();
  }
}
