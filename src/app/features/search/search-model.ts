import type { Note } from '../../../../electron/api';

export function normalizeQuery(query: string): string {
  return query.trim();
}

export function noteMatches(note: Note, query: string): boolean {
  const q = normalizeQuery(query).toLowerCase();
  if (!q) return false;
  if (note.title.toLowerCase().includes(q)) return true;
  if (note.content.toLowerCase().includes(q)) return true;
  return (note.checklist ?? []).some((item) => item.text.toLowerCase().includes(q));
}
