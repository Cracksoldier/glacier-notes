import { inject, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

// Angular's URL sanitizer rejects the custom glacier-img: scheme; ids come
// from the app's own store and the protocol handler validates them again.
@Pipe({ name: 'glacierImg' })
export class GlacierImgPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(imageId: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(`glacier-img://${imageId}`);
  }
}
