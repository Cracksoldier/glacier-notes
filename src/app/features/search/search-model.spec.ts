import type { Note } from '../../../../electron/api';
import { normalizeQuery, noteMatches } from './search-model';

function makeNote(partial: Partial<Note>): Note {
  return {
    id: 'n1',
    notebookId: 'nb1',
    type: 'text',
    title: '',
    content: '',
    imageIds: [],
    pinned: false,
    archived: false,
    labels: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('noteMatches', () => {
  it('matches in the title, case-insensitively', () => {
    const note = makeNote({ title: 'Grocery List' });
    expect(noteMatches(note, 'grocery')).toBe(true);
    expect(noteMatches(note, 'GROCERY')).toBe(true);
    expect(noteMatches(note, 'meeting')).toBe(false);
  });

  it('matches in the content', () => {
    const note = makeNote({ content: 'Buy **milk** tomorrow' });
    expect(noteMatches(note, 'Milk')).toBe(true);
    expect(noteMatches(note, 'cheese')).toBe(false);
  });

  it('matches in checklist item text', () => {
    const note = makeNote({
      type: 'checklist',
      checklist: [
        { id: 'i1', text: 'Call the plumber', checked: false, sortOrder: 0 },
        { id: 'i2', text: 'Water plants', checked: true, sortOrder: 1 },
      ],
    });
    expect(noteMatches(note, 'plumber')).toBe(true);
    expect(noteMatches(note, 'plants')).toBe(true);
    expect(noteMatches(note, 'garage')).toBe(false);
  });

  it('never matches an empty or whitespace query', () => {
    const note = makeNote({ title: 'anything' });
    expect(noteMatches(note, '')).toBe(false);
    expect(noteMatches(note, '   ')).toBe(false);
  });

  it('trims the query before matching', () => {
    const note = makeNote({ title: 'hello world' });
    expect(noteMatches(note, '  hello ')).toBe(true);
  });
});

describe('normalizeQuery', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeQuery('  abc ')).toBe('abc');
  });
});
