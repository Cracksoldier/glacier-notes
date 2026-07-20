import { Component, inject, input, output } from '@angular/core';
import { I18nService, TranslationKey } from '../../core/i18n/i18n.service';

export type ToolbarAction =
  | 'bold'
  | 'italic'
  | 'h1'
  | 'h2'
  | 'ul'
  | 'ol'
  | 'link'
  | 'code'
  | 'image';

@Component({
  selector: 'app-markdown-toolbar',
  template: `
    @for (button of buttons; track button.action) {
      <button
        type="button"
        class="toolbar__button"
        [title]="i18n.t(button.titleKey)"
        [disabled]="disabled()"
        (mousedown)="$event.preventDefault()"
        (click)="action.emit(button.action)"
      >
        @if (button.icon) {
          <i class="fa-solid {{ button.icon }}" aria-hidden="true"></i>
        } @else {
          <span class="toolbar__text">{{ button.label }}</span>
        }
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      gap: 2px;
    }

    .toolbar__button {
      min-width: 30px;
      padding: 6px 7px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      font-size: 13px;

      &:hover:not(:disabled) {
        background-color: var(--color-surface-elevated);
        color: var(--color-text);
      }

      &:disabled {
        opacity: 0.35;
        cursor: default;
      }
    }

    .toolbar__text {
      font-size: 12px;
      font-weight: 700;
    }
  `,
})
export class MarkdownToolbar {
  readonly disabled = input(false);
  readonly action = output<ToolbarAction>();

  protected readonly i18n = inject(I18nService);

  protected readonly buttons: {
    action: ToolbarAction;
    titleKey: TranslationKey;
    icon?: string;
    label?: string;
  }[] = [
    { action: 'bold', titleKey: 'mdToolbar.bold', icon: 'fa-bold' },
    { action: 'italic', titleKey: 'mdToolbar.italic', icon: 'fa-italic' },
    { action: 'h1', titleKey: 'mdToolbar.h1', label: 'H1' },
    { action: 'h2', titleKey: 'mdToolbar.h2', label: 'H2' },
    { action: 'ul', titleKey: 'mdToolbar.ul', icon: 'fa-list-ul' },
    { action: 'ol', titleKey: 'mdToolbar.ol', icon: 'fa-list-ol' },
    { action: 'link', titleKey: 'mdToolbar.link', icon: 'fa-link' },
    { action: 'code', titleKey: 'mdToolbar.code', icon: 'fa-code' },
    { action: 'image', titleKey: 'mdToolbar.image', icon: 'fa-image' },
  ];
}
