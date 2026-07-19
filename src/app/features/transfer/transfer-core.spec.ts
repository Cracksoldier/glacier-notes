import {
  collectExport,
  detectConflicts,
  envelopeCounts,
  ExportEnvelope,
  ExportSource,
  referencedImageIds,
  remapAsCopies,
  validateEnvelope,
} from '../../../../electron/transfer-core';
import type { Label, Note, Notebook } from '../../../../electron/api';

const IMG_A = '11111111-1111-4111-8111-111111111111';
const IMG_B = '22222222-2222-4222-8222-222222222222';
const NB_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const NB_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const NOTE_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const NOTE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const LABEL_A = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const ITEM_A = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';

const now = '2026-07-19T00:00:00.000Z';

const notebook = (id: string, name = id): Notebook => ({
  id,
  name,
  createdAt: now,
  updatedAt: now,
  sortOrder: 0,
});

const note = (id: string, notebookId: string, patch: Partial<Note> = {}): Note => ({
  id,
  notebookId,
  type: 'text',
  title: `title-${id}`,
  content: '',
  imageIds: [],
  pinned: false,
  archived: false,
  labels: [],
  createdAt: now,
  updatedAt: now,
  ...patch,
});

const label = (id: string, name = id): Label => ({ id, name });

const source = (overrides: Partial<ExportSource> = {}): ExportSource => ({
  notebooks: [notebook('nb1'), notebook('nb2')],
  notes: [],
  labels: [],
  defaultNotebookId: 'nb1',
  readImage: (id) => ({ mimeType: 'image/png', base64: `data-${id}` }),
  ...overrides,
});

describe('referencedImageIds', () => {
  it('unions imageIds and glacier-img refs in content', () => {
    const n = note('n1', 'nb1', {
      imageIds: [IMG_A],
      content: `![x](glacier-img://${IMG_B}) and again ![y](glacier-img://${IMG_A})`,
    });
    expect(referencedImageIds(n).sort()).toEqual([IMG_A, IMG_B].sort());
  });
});

describe('collectExport', () => {
  it('exports everything for scope "all"', () => {
    const env = collectExport(
      { kind: 'all' },
      source({
        notes: [note('n1', 'nb1'), note('n2', 'nb2')],
        labels: [label('l1')],
      }),
    );
    expect(env.format).toBe('glacier-notes-export');
    expect(env.notebooks.map((n) => n.id)).toEqual(['nb1', 'nb2']);
    expect(env.notes.map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(env.labels.map((l) => l.id)).toEqual(['l1']);
  });

  it('scope "notebook" keeps that notebook, all its notes (incl. archived/trashed) and only referenced labels', () => {
    const env = collectExport(
      { kind: 'notebook', notebookId: 'nb1' },
      source({
        notes: [
          note('n1', 'nb1', { labels: ['l1'] }),
          note('n2', 'nb1', { archived: true }),
          note('n3', 'nb1', { deletedAt: now }),
          note('n4', 'nb2', { labels: ['l2'] }),
        ],
        labels: [label('l1'), label('l2')],
      }),
    );
    expect(env.notebooks.map((n) => n.id)).toEqual(['nb1']);
    expect(env.notes.map((n) => n.id)).toEqual(['n1', 'n2', 'n3']);
    expect(env.notes.find((n) => n.id === 'n3')?.deletedAt).toBe(now);
    expect(env.labels.map((l) => l.id)).toEqual(['l1']);
  });

  it('collects each referenced image once and skips unresolvable ids', () => {
    const env = collectExport(
      { kind: 'all' },
      source({
        notes: [
          note('n1', 'nb1', { imageIds: [IMG_A], content: `![x](glacier-img://${IMG_B})` }),
          note('n2', 'nb1', { imageIds: [IMG_A] }),
        ],
        readImage: (id) => (id === IMG_B ? null : { mimeType: 'image/png', base64: 'AA==' }),
      }),
    );
    expect(env.images.map((i) => i.id)).toEqual([IMG_A]);
  });

  it('exports a single note with only its dependencies', () => {
    const env = collectExport(
      { kind: 'note', noteId: 'n1' },
      source({
        notes: [note('n1', 'nb1', { labels: ['l1'], imageIds: [IMG_A] }), note('n2', 'nb1')],
        labels: [label('l1'), label('l2')],
        readImage: () => ({ mimeType: 'image/png', fileName: 'image.png', base64: 'AQID' }),
      }),
    );
    expect(env.notes.map((value) => value.id)).toEqual(['n1']);
    expect(env.notebooks.map((value) => value.id)).toEqual(['nb1']);
    expect(env.labels.map((value) => value.id)).toEqual(['l1']);
    expect(env.images[0].fileName).toBe('image.png');
  });
});

describe('validateEnvelope', () => {
  const valid = (): ExportEnvelope =>
    collectExport(
      { kind: 'all' },
      source({
        notebooks: [notebook(NB_A), notebook(NB_B)],
        defaultNotebookId: NB_A,
        notes: [
          note(NOTE_A, NB_A, { imageIds: [IMG_A] }),
          note(NOTE_B, NB_A, {
            type: 'checklist',
            checklist: [{ id: ITEM_A, text: 'a', checked: true, sortOrder: 0 }],
          }),
        ],
        labels: [label(LABEL_A)],
        readImage: () => ({ mimeType: 'image/png', base64: 'AAAA' }),
      }),
    );

  it('accepts a round-tripped envelope', () => {
    const result = validateEnvelope(JSON.parse(JSON.stringify(valid())));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope.notes).toHaveLength(2);
      expect(result.envelope.notes[1].checklist).toHaveLength(1);
      expect(result.envelope.images).toHaveLength(1);
    }
  });

  it('rejects an unknown format', () => {
    const result = validateEnvelope({ ...valid(), format: 'something-else' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toContain('format');
  });

  it('rejects a newer schemaVersion', () => {
    const result = validateEnvelope({ ...valid(), schemaVersion: 999 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toContain('schemaVersion');
  });

  it('rejects missing arrays', () => {
    const { notes: _notes, ...rest } = valid();
    expect(validateEnvelope(rest).ok).toBe(false);
  });

  it('rejects unsupported image mime types and invalid base64', () => {
    const env = valid();
    expect(
      validateEnvelope({
        ...env,
        images: [{ id: IMG_A, mimeType: 'image/svg+xml', base64: 'AAAA' }],
      }).ok,
    ).toBe(false);
    expect(
      validateEnvelope({
        ...env,
        images: [{ id: IMG_A, mimeType: 'image/png', base64: 'not base64!' }],
      }).ok,
    ).toBe(false);
  });

  it('rejects notes with invalid type', () => {
    const env = JSON.parse(JSON.stringify(valid()));
    env.notes[0].type = 'audio';
    expect(validateEnvelope(env).ok).toBe(false);
  });

  it('accepts legacy v1 envelopes without scope metadata', () => {
    const { scope: _scope, defaultNotebookId: _default, ...legacy } = valid();
    expect(validateEnvelope(legacy).ok).toBe(true);
  });

  it('rejects traversal ids, duplicate ids, and dangling references', () => {
    const traversal = JSON.parse(JSON.stringify(valid()));
    traversal.notes[0].id = '../../escape';
    expect(validateEnvelope(traversal).ok).toBe(false);

    const duplicate = JSON.parse(JSON.stringify(valid()));
    duplicate.notes.push({ ...duplicate.notes[0] });
    expect(validateEnvelope(duplicate).ok).toBe(false);

    const dangling = JSON.parse(JSON.stringify(valid()));
    dangling.notes[0].labels = ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'];
    expect(validateEnvelope(dangling).ok).toBe(false);
  });

  it('rejects missing fields instead of silently repairing them', () => {
    const env = JSON.parse(JSON.stringify(valid()));
    delete env.notes[0].title;
    expect(validateEnvelope(env).ok).toBe(false);
  });
});

describe('detectConflicts', () => {
  const empty = {
    notebookIds: new Set<string>(),
    noteIds: new Set<string>(),
    labelIds: new Set<string>(),
    imageIds: new Set<string>(),
  };
  const env = collectExport({ kind: 'all' }, source({ notes: [note('n1', 'nb1')] }));

  it('is false without id overlap', () => {
    expect(detectConflicts(env, empty)).toBe(false);
  });

  it('is true when any id collides', () => {
    expect(detectConflicts(env, { ...empty, noteIds: new Set(['n1']) })).toBe(true);
    expect(detectConflicts(env, { ...empty, notebookIds: new Set(['nb2']) })).toBe(true);
  });
});

describe('remapAsCopies', () => {
  it('assigns fresh ids and keeps all references consistent', () => {
    const env = collectExport(
      { kind: 'all' },
      source({
        notes: [
          note('n1', 'nb1', {
            labels: ['l1'],
            imageIds: [IMG_A],
            content: `before ![x](glacier-img://${IMG_A}) after`,
            checklist: undefined,
          }),
        ],
        labels: [label('l1')],
      }),
    );
    const copy = remapAsCopies(env);

    const nb = copy.notebooks[0];
    const n = copy.notes[0];
    const l = copy.labels[0];
    const img = copy.images[0];

    expect(nb.id).not.toBe('nb1');
    expect(n.id).not.toBe('n1');
    expect(l.id).not.toBe('l1');
    expect(img.id).not.toBe(IMG_A);

    expect(n.notebookId).toBe(nb.id);
    expect(n.labels).toEqual([l.id]);
    expect(n.imageIds).toEqual([img.id]);
    expect(n.content).toBe(`before ![x](glacier-img://${img.id}) after`);
    // original untouched
    expect(env.notes[0].content).toContain(IMG_A);
  });

  it('remaps checklist item ids and leaves unknown references untouched', () => {
    const env = collectExport(
      { kind: 'all' },
      source({
        notebooks: [],
        notes: [
          note('n1', 'nb-unknown', {
            type: 'checklist',
            labels: ['l-unknown'],
            checklist: [{ id: 'c1', text: 'a', checked: false, sortOrder: 0 }],
          }),
        ],
      }),
    );
    const copy = remapAsCopies(env);
    expect(copy.notes[0].notebookId).toBe('nb-unknown');
    expect(copy.notes[0].labels).toEqual(['l-unknown']);
    expect(copy.notes[0].checklist?.[0].id).not.toBe('c1');
  });
});

describe('envelopeCounts', () => {
  it('counts each entity kind', () => {
    const env = collectExport(
      { kind: 'all' },
      source({ notes: [note('n1', 'nb1')], labels: [label('l1')] }),
    );
    expect(envelopeCounts(env)).toEqual({ notebooks: 2, notes: 1, labels: 1, images: 0 });
  });
});
