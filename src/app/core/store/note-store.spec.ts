import { TestBed } from '@angular/core/testing';
import { installGlacierApiStub } from '../../testing/glacier-api-stub';
import { NoteStore } from './note-store';

describe('NoteStore', () => {
  let store: NoteStore;
  let state: ReturnType<typeof installGlacierApiStub>;

  beforeEach(() => {
    state = installGlacierApiStub();
    store = TestBed.inject(NoteStore);
  });

  it('separates active, archived, and trashed notes', async () => {
    await store.create({ notebookId: 'nb-default', type: 'text', title: 'a' });
    const b = await store.create({ notebookId: 'nb-default', type: 'text', title: 'b' });
    const c = await store.create({ notebookId: 'nb-default', type: 'text', title: 'c' });
    await store.setArchived(b.id, true);
    await store.trash(c.id);

    expect(store.active().map((n) => n.title)).toEqual(['a']);
    expect(store.archived().map((n) => n.title)).toEqual(['b']);
    expect(store.trashed().map((n) => n.title)).toEqual(['c']);
  });

  it('counts only active notes per notebook', async () => {
    await store.create({ notebookId: 'nb-default', type: 'text' });
    await store.create({ notebookId: 'nb-default', type: 'text' });
    const archived = await store.create({ notebookId: 'nb-default', type: 'text' });
    await store.setArchived(archived.id, true);

    expect(store.countsByNotebook().get('nb-default')).toBe(2);
  });

  it('restores a trashed note', async () => {
    const note = await store.create({ notebookId: 'nb-default', type: 'text', title: 'x' });
    await store.trash(note.id);
    expect(store.active()).toHaveLength(0);
    await store.restore(note.id);
    expect(store.active().map((n) => n.title)).toEqual(['x']);
    expect(store.trashed()).toHaveLength(0);
  });

  it('empties the trash permanently', async () => {
    const a = await store.create({ notebookId: 'nb-default', type: 'text' });
    const b = await store.create({ notebookId: 'nb-default', type: 'text' });
    await store.trash(a.id);
    await store.trash(b.id);

    await store.emptyTrash();

    expect(store.trashed()).toHaveLength(0);
    expect(state.notes).toHaveLength(0);
  });

  it('patches notes in place without reloading', async () => {
    const note = await store.create({ notebookId: 'nb-default', type: 'text', title: 'old' });
    await store.updateInPlace(note.id, { title: 'new' });
    expect(store.active().find((n) => n.id === note.id)?.title).toBe('new');
  });

  it('moves all notes of a notebook including archived and trashed', async () => {
    const a = await store.create({ notebookId: 'nb-default', type: 'text' });
    const b = await store.create({ notebookId: 'nb-default', type: 'text' });
    await store.setArchived(a.id, true);
    await store.trash(b.id);

    await store.moveAllFromNotebook('nb-default', 'nb-other');

    expect(state.notes.every((n) => n.notebookId === 'nb-other')).toBe(true);
  });
});
