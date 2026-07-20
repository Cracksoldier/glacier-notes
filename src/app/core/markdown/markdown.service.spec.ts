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

  const renderToString = (md: string): string =>
    sanitizer.sanitize(1 /* SecurityContext.HTML */, service.render(md)) ?? '';

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

  it('removes img tags with external src', () => {
    const html = renderToString('![alt](https://example.com/x.png)');
    expect(html).not.toContain('<img');
  });

  it('removes img tags with data: src', () => {
    const html = renderToString('<img src="data:image/png;base64,AAAA">');
    expect(html).not.toContain('<img');
  });

  it('keeps img tags with a glacier-img src', () => {
    const id = '01234567-89ab-cdef-0123-456789abcdef';
    const html = renderToString(`![alt](glacier-img://${id})`);
    expect(html).toContain(`src="glacier-img://${id}"`);
  });

  it('removes img tags with a malformed glacier-img src', () => {
    const html = renderToString('![alt](glacier-img://../../etc/passwd)');
    expect(html).not.toContain('<img');
  });

  it('adds rel=noopener to links', () => {
    const html = renderToString('[docs](https://example.com)');
    expect(html).toContain('rel="noopener"');
  });

  describe('renderInline', () => {
    const renderInlineToString = (md: string): string =>
      sanitizer.sanitize(1 /* SecurityContext.HTML */, service.renderInline(md)) ?? '';

    it('renders inline markdown without block wrappers', () => {
      const html = renderInlineToString('**bold** and `code`');
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<code>code</code>');
      expect(html).not.toContain('<p>');
    });

    it('strips script tags', () => {
      const html = renderInlineToString('x <script>alert(1)</script>');
      expect(html).not.toContain('<script');
    });

    it('adds rel=noopener to inline links', () => {
      expect(renderInlineToString('[a](https://example.com)')).toContain('rel="noopener"');
    });

    it('still forbids img tags inline', () => {
      const id = '01234567-89ab-cdef-0123-456789abcdef';
      expect(renderInlineToString(`![alt](glacier-img://${id})`)).not.toContain('<img');
    });
  });

  describe('search highlighting', () => {
    const renderHighlighted = (md: string, query: string): string =>
      sanitizer.sanitize(1 /* SecurityContext.HTML */, service.render(md, query)) ?? '';

    it('wraps matches in <mark> after sanitization', () => {
      const html = renderHighlighted('Some **bold** text', 'bold');
      expect(html).toContain('<strong><mark>bold</mark></strong>');
    });

    it('still sanitizes when a highlight query is present', () => {
      const html = renderHighlighted('hello <script>alert(1)</script>', 'hello');
      expect(html).not.toContain('<script');
      expect(html).toContain('<mark>hello</mark>');
    });

    it('does not highlight inside link attributes', () => {
      const html = renderHighlighted('[example](https://example.com)', 'example');
      expect(html).toContain('href="https://example.com"');
      expect(html).toContain('<mark>example</mark>');
    });

    it('highlights inline renders too', () => {
      const html = sanitizer.sanitize(1, service.renderInline('buy milk', 'milk')) ?? '';
      expect(html).toContain('<mark>milk</mark>');
    });
  });
});
