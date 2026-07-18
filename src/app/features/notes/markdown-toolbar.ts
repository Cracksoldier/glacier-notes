import { Component, input, output } from '@angular/core';

export type ToolbarAction = 'bold' | 'italic' | 'h1' | 'h2' | 'ul' | 'ol' | 'link' | 'code';

@Component({
  selector: 'app-markdown-toolbar',
  template: `
    @for (button of buttons; track button.action) {
      <button
        type="button"
        class="toolbar__button"
        [title]="button.title"
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

  protected readonly buttons: { action: ToolbarAction; title: string; icon?: string; label?: string }[] = [
    { action: 'bold', title: 'Bold', icon: 'fa-bold' },
    { action: 'italic', title: 'Italic', icon: 'fa-italic' },
    { action: 'h1', title: 'Heading 1', label: 'H1' },
    { action: 'h2', title: 'Heading 2', label: 'H2' },
    { action: 'ul', title: 'Bulleted list', icon: 'fa-list-ul' },
    { action: 'ol', title: 'Numbered list', icon: 'fa-list-ol' },
    { action: 'link', title: 'Link', icon: 'fa-link' },
    { action: 'code', title: 'Code', icon: 'fa-code' },
  ];
}
