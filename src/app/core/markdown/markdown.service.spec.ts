import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { MarkdownService } from './markdown.service';

describe('MarkdownService', () => {
  let service: MarkdownService;
  let sanitizer: DomSanitizer;

  beforeEach(() => {
    service = TestBed.inject(MarkdownService);
    sanitizer = TestBed.inject(DomSanitizer);
  });

  const renderToString = (md: string): string => sanitizer.sanitize(1 /* SecurityContext.HTML */, service.render(md)) ?? '';

  it('renders basic markdown', () => {
    const html = renderToString('# Title\n\nSome **bold** text');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('strips script tags', () => {
    const html = renderToString('hello <script>alert(1)</script>');
    expect(html).not.toContain('<script');
    expect(html).toContain('hello');
  });

  it('strips javascript: links', () => {
    const html = renderToString('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });

  it('strips inline event handlers', () => {
    const html = renderToString('<a href="https://example.com" onclick="alert(1)">x</a>');
    expect(html).not.toContain('onclick');
  });

  it('forbids img tags for now', () => {
    const html = renderToString('![alt](https://example.com/x.png)');
    expect(html).not.toContain('<img');
  });

  it('adds rel=noopener to links', () => {
    const html = renderToString('[docs](https://example.com)');
    expect(html).toContain('rel="noopener"');
  });
});
