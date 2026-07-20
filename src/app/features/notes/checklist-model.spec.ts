import type { ChecklistItem } from '../../../../electron/api';
import {
  checklistToText,
  displayOrder,
  newItem,
  reorderItems,
  resequence,
  textToChecklist,
} from './checklist-model';

const item = (id: string, text: string, checked: boolean, sortOrder: number): ChecklistItem => ({
  id,
  text,
  checked,
  sortOrder,
});

describe('displayOrder', () => {
  const items = [item('a', 'a', true, 0), item('b', 'b', false, 2), item('c', 'c', false, 1)];

  it('sorts by sortOrder', () => {
    expect(displayOrder(items, false).map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });

  it('moves checked to the bottom keeping relative order', () => {
    expect(displayOrder(items, true).map((i) => i.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('reorderItems', () => {
  const items = [item('a', 'a', false, 0), item('b', 'b', false, 1), item('c', 'c', false, 2)];

  it('moves an item and resequences sortOrder', () => {
    const result = reorderItems(items, 0, 2, false);
    expect(result.map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(result.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
  });

  it('reorders within the displayed list when checked items sit at the bottom', () => {
    const mixed = [item('a', 'a', true, 0), item('b', 'b', false, 1), item('c', 'c', false, 2)];
    // displayed: b, c, a — move c before b
    const result = reorderItems(mixed, 1, 0, true);
    expect(result.map((i) => i.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('resequence', () => {
  it('assigns consecutive sortOrders', () => {
    const result = resequence([item('a', 'a', false, 7), item('b', 'b', false, 3)]);
    expect(result.map((i) => i.sortOrder)).toEqual([0, 1]);
  });
});

describe('newItem', () => {
  it('creates an unchecked item with a unique id', () => {
    const a = newItem('x', 0);
    const b = newItem('x', 1);
    expect(a.checked).toBe(false);
    expect(a.id).not.toBe(b.id);
  });
});

describe('textToChecklist', () => {
  it('converts plain lines to unchecked items', () => {
    const items = textToChecklist('one\ntwo');
    expect(items.map((i) => i.text)).toEqual(['one', 'two']);
    expect(items.every((i) => !i.checked)).toBe(true);
    expect(items.map((i) => i.sortOrder)).toEqual([0, 1]);
  });

  it('strips list markers and parses task states', () => {
    const items = textToChecklist('- [x] done\n- [ ] open\n* starred\n1. numbered');
    expect(items.map((i) => i.text)).toEqual(['done', 'open', 'starred', 'numbered']);
    expect(items.map((i) => i.checked)).toEqual([true, false, false, false]);
  });

  it('skips empty lines', () => {
    expect(textToChecklist('a\n\n  \nb')).toHaveLength(2);
  });
});

describe('checklistToText', () => {
  it('renders task-list lines in sort order', () => {
    const text = checklistToText([item('b', 'second', true, 1), item('a', 'first', false, 0)]);
    expect(text).toBe('- [ ] first\n- [x] second');
  });

  it('round-trips through textToChecklist', () => {
    const original = [item('a', 'one', false, 0), item('b', 'two', true, 1)];
    const roundTripped = textToChecklist(checklistToText(original));
    expect(roundTripped.map((i) => [i.text, i.checked])).toEqual([
      ['one', false],
      ['two', true],
    ]);
  });
});
