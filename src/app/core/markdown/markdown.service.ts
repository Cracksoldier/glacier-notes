import { inject, Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { highlightHtml } from './highlight';

const PREVIEW_SOURCE_LIMIT = 600;

const GLACIER_IMG_SRC = /^glacier-img:\/\/[0-9a-f-]{36}$/;

// DOMPurify's default URI allow-list plus the app's glacier-img scheme.
const ALLOWED_URI = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|glacier-img):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

@Injectable({ providedIn: 'root' })
export class MarkdownService {
  private readonly sanitizer = inject(DomSanitizer);

  constructor() {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('rel', 'noopener');
      }
      // Only app-stored images may render; external/data sources are removed
      // entirely so no empty <img> boxes remain (CSP is the backstop).
      if (node.tagName === 'IMG' && !GLACIER_IMG_SRC.test(node.getAttribute('src') ?? '')) {
        node.remove();
      }
    });
  }

  // The only place allowed to bypass Angular's sanitizer: DOMPurify runs first,
  // and the strict CSP (script-src 'self') is the second line of defense.
  // Highlighting runs after DOMPurify — safe because highlightHtml only wraps
  // existing text nodes in <mark>; the query never becomes markup.
  render(markdown: string, highlight?: string): SafeHtml {
    const html = marked.parse(markdown, { gfm: true, breaks: true, async: false });
    const clean = DOMPurify.sanitize(html, {
      FORBID_TAGS: ['style', 'form', 'input', 'button'],
      ALLOWED_URI_REGEXP: ALLOWED_URI,
    });
    return this.sanitizer.bypassSecurityTrustHtml(this.applyHighlight(clean, highlight));
  }

  renderPreview(markdown: string, highlight?: string): SafeHtml {
    return this.render(
      markdown.length > PREVIEW_SOURCE_LIMIT ? `${markdown.slice(0, PREVIEW_SOURCE_LIMIT)}…` : markdown,
      highlight,
    );
  }

  // Inline-only markdown (bold/italic/code/links) for checklist item text — no block elements.
  renderInline(markdown: string, highlight?: string): SafeHtml {
    const html = marked.parseInline(markdown, { gfm: true, breaks: true, async: false });
    const clean = DOMPurify.sanitize(html, {
      FORBID_TAGS: ['img', 'style', 'form', 'input', 'button'],
    });
    return this.sanitizer.bypassSecurityTrustHtml(this.applyHighlight(clean, highlight));
  }

  private applyHighlight(clean: string, highlight: string | undefined): string {
    return highlight?.trim() ? highlightHtml(clean, highlight) : clean;
  }
}
