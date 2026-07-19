import { highlightHtml, splitText } from './highlight';

describe('splitText', () => {
  it('splits text into match and non-match segments', () => {
    expect(splitText('one two one', 'one')).toEqual([
      { text: 'one', match: true },
      { text: ' two ', match: false },
      { text: 'one', match: true },
    ]);
  });

  it('is case-insensitive but preserves original casing', () => {
    expect(splitText('Hello World', 'hello')).toEqual([
      { text: 'Hello', match: true },
      { text: ' World', match: false },
    ]);
  });

  it('returns a single non-match segment when nothing matches', () => {
    expect(splitText('abc', 'xyz')).toEqual([{ text: 'abc', match: false }]);
  });

  it('handles empty query and empty text', () => {
    expect(splitText('abc', '')).toEqual([{ text: 'abc', match: false }]);
    expect(splitText('', 'x')).toEqual([{ text: '', match: false }]);
  });
});

describe('highlightHtml', () => {
  it('wraps matches in <mark>', () => {
    expect(highlightHtml('<p>hello world</p>', 'world')).toBe('<p>hello <mark>world</mark></p>');
  });

  it('is case-insensitive', () => {
    expect(highlightHtml('<p>Hello</p>', 'hello')).toBe('<p><mark>Hello</mark></p>');
  });

  it('highlights multiple matches across nested tags', () => {
    const result = highlightHtml('<p>foo <strong>foo</strong> bar</p>', 'foo');
    expect(result).toBe('<p><mark>foo</mark> <strong><mark>foo</mark></strong> bar</p>');
  });

  it('never touches attributes, even when they contain the query', () => {
    const html = '<a href="https://example.com/foo">link</a>';
    const result = highlightHtml(html, 'foo');
    expect(result).toContain('href="https://example.com/foo"');
    expect(result).not.toContain('href="https://example.com/<mark>');
  });

  it('does not treat the query as markup', () => {
    const result = highlightHtml('<p>a &lt;b&gt; c</p>', '<b>');
    expect(result).toBe('<p>a <mark>&lt;b&gt;</mark> c</p>');
  });

  it('returns input unchanged for an empty query', () => {
    expect(highlightHtml('<p>abc</p>', '')).toBe('<p>abc</p>');
    expect(highlightHtml('<p>abc</p>', '  ')).toBe('<p>abc</p>');
  });
});
