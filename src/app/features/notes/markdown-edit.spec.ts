import { insertLink, orderedList, prefixLines, toggleCode, wrapSelection } from './markdown-edit';

describe('wrapSelection', () => {
  it('wraps the selection in markers', () => {
    const result = wrapSelection('hello world', 6, 11, '**');
    expect(result.value).toBe('hello **world**');
    expect(result.selStart).toBe(8);
    expect(result.selEnd).toBe(13);
  });

  it('unwraps an already wrapped selection', () => {
    const result = wrapSelection('hello **world**', 8, 13, '**');
    expect(result.value).toBe('hello world');
    expect(result.selStart).toBe(6);
    expect(result.selEnd).toBe(11);
  });

  it('wraps an empty selection leaving the cursor between markers', () => {
    const result = wrapSelection('hi ', 3, 3, '*');
    expect(result.value).toBe('hi **');
    expect(result.selStart).toBe(4);
    expect(result.selEnd).toBe(4);
  });
});

describe('prefixLines', () => {
  it('prefixes all selected lines', () => {
    const result = prefixLines('one\ntwo\nthree', 0, 13, '- ');
    expect(result.value).toBe('- one\n- two\n- three');
    expect(result.selStart).toBe(2);
    expect(result.selEnd).toBe(19);
  });

  it('removes the prefix when all lines already have it', () => {
    const result = prefixLines('- one\n- two', 2, 11, '- ');
    expect(result.value).toBe('one\ntwo');
  });

  it('extends to the start of the first selected line', () => {
    const result = prefixLines('one\ntwo', 6, 7, '# ');
    expect(result.value).toBe('one\n# two');
  });
});

describe('orderedList', () => {
  it('numbers the selected lines', () => {
    const result = orderedList('a\nb\nc', 0, 5);
    expect(result.value).toBe('1. a\n2. b\n3. c');
  });

  it('removes numbering when all lines are numbered', () => {
    const result = orderedList('1. a\n2. b', 0, 9);
    expect(result.value).toBe('a\nb');
  });
});

describe('insertLink', () => {
  it('uses the selection as link text and selects the URL placeholder', () => {
    const result = insertLink('see docs here', 4, 8);
    expect(result.value).toBe('see [docs](https://) here');
    expect(result.value.slice(result.selStart, result.selEnd)).toBe('https://');
  });

  it('inserts a placeholder link for an empty selection', () => {
    const result = insertLink('', 0, 0);
    expect(result.value).toBe('[link](https://)');
  });
});

describe('toggleCode', () => {
  it('wraps a single-line selection in backticks', () => {
    const result = toggleCode('run npm test now', 4, 12);
    expect(result.value).toBe('run `npm test` now');
  });

  it('wraps a multi-line selection in a code fence', () => {
    const result = toggleCode('a\nb', 0, 3);
    expect(result.value).toBe('```\na\nb\n```');
    expect(result.value.slice(result.selStart, result.selEnd)).toBe('a\nb');
  });
});
