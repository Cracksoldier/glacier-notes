import { NOTE_COLORS, noteColorVar } from './note-colors';

describe('noteColorVar', () => {
  it('maps every palette color to its CSS variable', () => {
    for (const color of NOTE_COLORS) {
      expect(noteColorVar(color)).toBe(`var(--note-${color})`);
    }
  });

  it('returns null for unknown or missing colors', () => {
    expect(noteColorVar(undefined)).toBeNull();
    expect(noteColorVar('')).toBeNull();
    expect(noteColorVar('magenta')).toBeNull();
    expect(noteColorVar('red; background: url(x)')).toBeNull();
  });
});
