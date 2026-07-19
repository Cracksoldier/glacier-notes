import { vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  shell: { openExternal: vi.fn() },
}));

import { buildMailtoUrl } from '../../../../electron/mailto';
import type { Note } from '../../../../electron/api';

const base: Note = {
  id: 'n1',
  notebookId: 'nb1',
  type: 'text',
  title: 'Groceries & more',
  content: 'Buy milk\n**bold**',
  imageIds: [],
  pinned: false,
  archived: false,
  labels: [],
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
};

describe('buildMailtoUrl', () => {
  it('encodes title and markdown content', () => {
    const url = buildMailtoUrl(base);
    expect(url).toBe(
      `mailto:?subject=${encodeURIComponent('Groceries & more')}&body=${encodeURIComponent('Buy milk\n**bold**')}`,
    );
    expect(url).not.toContain(' ');
    expect(url).not.toContain('&body=Buy milk');
  });

  it('renders checklists as task-list lines in sortOrder', () => {
    const url = buildMailtoUrl({
      ...base,
      type: 'checklist',
      content: '',
      checklist: [
        { id: 'b', text: 'second', checked: true, sortOrder: 1 },
        { id: 'a', text: 'first', checked: false, sortOrder: 0 },
      ],
    });
    expect(decodeURIComponent(url.split('&body=')[1])).toBe('- [ ] first\n- [x] second');
  });

  it('handles empty checklist and title', () => {
    const url = buildMailtoUrl({
      ...base,
      title: '',
      type: 'checklist',
      content: '',
      checklist: [],
    });
    expect(url).toBe('mailto:?subject=&body=');
  });
});
