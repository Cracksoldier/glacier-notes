import { TestBed } from '@angular/core/testing';
import { installGlacierApiStub } from '../../testing/glacier-api-stub';
import { LabelStore } from './label-store';
import { NoteStore } from './note-store';

describe('LabelStore', () => {
  let state: ReturnType<typeof installGlacierApiStub>;
  let store: LabelStore;

  beforeEach(() => {
    state = installGlacierApiStub();
    store = TestBed.inject(LabelStore);
  });

  it('creates labels and lists them sorted by name', async () => {
    await store.create('zeta');
    await store.create('alpha');
    expect(store.labels().map((l) => l.name)).toEqual(['alpha', 'zeta']);
  });

  it('renames a label', async () => {
    const label = await store.create('old');
    await store.rename(label.id, 'new');
    expect(store.labels().map((l) => l.name)).toEqual(['new']);
  });

  it('removes a label and strips it from notes', async () => {
    const noteStore = TestBed.inject(NoteStore);
    const label = await store.create('todo');
    const note = await noteStore.create({ notebookId: 'nb-default', type: 'text' });
    await noteStore.updateInPlace(note.id, { labels: [label.id] });

    await store.remove(label.id);
    await noteStore.reloadAll();

    expect(store.labels()).toEqual([]);
    expect(state.notes.find((n) => n.id === note.id)?.labels).toEqual([]);
    expect(noteStore.find(note.id)?.labels).toEqual([]);
  });
});
