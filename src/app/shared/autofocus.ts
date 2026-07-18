import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';

// The native autofocus attribute only fires on document load; this focuses
// elements that appear later (inline edit inputs, dialog fields).
@Directive({ selector: '[appAutofocus]' })
export class Autofocus implements AfterViewInit {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  ngAfterViewInit(): void {
    this.el.nativeElement.focus();
  }
}
