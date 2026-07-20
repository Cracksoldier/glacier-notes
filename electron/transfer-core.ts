// Pure export/import logic (SPECIFICATION.md §5.7) — no electron/node imports,
// so it is unit-testable from renderer-side Vitest specs.
import {
  ChecklistItem,
  Label,
  newId,
  Note,
  Notebook,
  nowIso,
  SCHEMA_VERSION,
} from './storage/models';

export interface ExportedImage {
  id: string;
  mimeType: string;
  fileName?: string;
  base64: string;
}

export interface ExportEnvelope {
  format: 'glacier-notes-export';
  schemaVersion: number;
  exportedAt: string;
  notebooks: Notebook[];
  notes: Note[];
  labels: Label[];
  images: ExportedImage[];
  /** Optional for compatibility with exports produced before M8 was finalized. */
  scope?: ExportScope;
  /** Present for all-data exports; older v1 exports omit it. */
  defaultNotebookId?: string | null;
}

export type ExportScope =
  | { kind: 'all' }
  | { kind: 'notebook'; notebookId: string }
  | { kind: 'note'; noteId: string };

export interface ImportCounts {
  notebooks: number;
  notes: number;
  labels: number;
  images: number;
}

export type ImportStrategy = 'copy' | 'replace' | 'preserve';

export type ExportDataResult = { status: 'saved' } | { status: 'canceled' };
export type ImportInspectResult =
  | { status: 'canceled' }
  | { status: 'invalid'; errors: string[] }
  | { status: 'ready'; hasConflicts: boolean; counts: ImportCounts };
export type ImportApplyResult = { status: 'done'; counts: ImportCounts };

export const EXPORT_FORMAT = 'glacier-notes-export';

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const IMAGE_REF_PATTERN = /glacier-img:\/\/([0-9a-f-]{36})/g;
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function referencedImageIds(note: Note): string[] {
  const ids = new Set(note.imageIds);
  for (const match of note.content.matchAll(IMAGE_REF_PATTERN)) {
    ids.add(match[1]);
  }
  return [...ids];
}

export interface ExportSource {
  notebooks: Notebook[];
  notes: Note[];
  labels: Label[];
  defaultNotebookId: string;
  readImage(id: string): Omit<ExportedImage, 'id'> | null;
}

export function collectExport(scope: ExportScope, source: ExportSource): ExportEnvelope {
  const notes =
    scope.kind === 'all'
      ? source.notes
      : scope.kind === 'notebook'
        ? source.notes.filter((n) => n.notebookId === scope.notebookId)
        : source.notes.filter((n) => n.id === scope.noteId);
  const notebookIds = new Set(
    scope.kind === 'all'
      ? source.notebooks.map((n) => n.id)
      : scope.kind === 'notebook'
        ? [scope.notebookId]
        : notes.map((n) => n.notebookId),
  );
  const notebooks = source.notebooks.filter((n) => notebookIds.has(n.id));

  let labels: Label[];
  if (scope.kind === 'all') {
    labels = source.labels;
  } else {
    const used = new Set(notes.flatMap((n) => n.labels));
    labels = source.labels.filter((l) => used.has(l.id));
  }

  const images: ExportedImage[] = [];
  const seen = new Set<string>();
  for (const note of notes) {
    for (const id of referencedImageIds(note)) {
      if (seen.has(id)) continue;
      seen.add(id);
      const image = source.readImage(id);
      if (image !== null) {
        images.push({ id, ...image });
      }
    }
  }

  return {
    format: EXPORT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    notebooks: notebooks.map((n) => ({ ...n })),
    notes: notes.map((n) => ({ ...n })),
    labels: labels.map((l) => ({ ...l })),
    images: images,
    scope,
    ...(scope.kind === 'all' ? { defaultNotebookId: source.defaultNotebookId } : {}),
  };
}

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function addDuplicateErrors(
  values: readonly { id: string }[],
  name: string,
  errors: string[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.id)) errors.push(`${name}: duplicate id ${value.id}`);
    seen.add(value.id);
  }
}

export function validateEnvelope(
  raw: unknown,
): { ok: true; envelope: ExportEnvelope } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    return { ok: false, errors: ['Not a JSON object'] };
  }
  if (raw['format'] !== EXPORT_FORMAT) {
    errors.push(`Unknown format: expected "${EXPORT_FORMAT}"`);
  }
  if (!validDate(raw['exportedAt'])) errors.push('Missing or invalid exportedAt');
  const version = raw['schemaVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    errors.push('Missing or invalid schemaVersion');
  } else if (version > SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion ${version} (this app supports up to ${SCHEMA_VERSION})`);
  }
  for (const key of ['notebooks', 'notes', 'labels', 'images'] as const) {
    if (!Array.isArray(raw[key])) {
      errors.push(`Missing or invalid "${key}" array`);
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const notebooks: Notebook[] = [];
  (raw['notebooks'] as unknown[]).forEach((value, i) => {
    if (!isRecord(value) || !validUuid(value['id'])) {
      errors.push(`notebooks[${i}]: invalid id`);
      return;
    }
    if (typeof value['name'] !== 'string' || value['name'] === '') {
      errors.push(`notebooks[${i}]: missing name`);
      return;
    }
    if (!validDate(value['createdAt']) || !validDate(value['updatedAt'])) {
      errors.push(`notebooks[${i}]: invalid timestamps`);
      return;
    }
    if (!Number.isInteger(value['sortOrder'])) {
      errors.push(`notebooks[${i}]: invalid sortOrder`);
      return;
    }
    notebooks.push({
      id: value['id'],
      name: value['name'],
      ...(typeof value['color'] === 'string' ? { color: value['color'] } : {}),
      createdAt: value['createdAt'],
      updatedAt: value['updatedAt'],
      sortOrder: value['sortOrder'] as number,
    });
  });

  const notes: Note[] = [];
  (raw['notes'] as unknown[]).forEach((value, i) => {
    if (!isRecord(value) || !validUuid(value['id'])) {
      errors.push(`notes[${i}]: invalid id`);
      return;
    }
    if (!validUuid(value['notebookId'])) {
      errors.push(`notes[${i}]: invalid notebookId`);
      return;
    }
    const type = value['type'];
    if (type !== 'text' && type !== 'checklist') {
      errors.push(`notes[${i}]: invalid type`);
      return;
    }
    const checklist: ChecklistItem[] = [];
    if (type === 'checklist') {
      if (!Array.isArray(value['checklist'])) {
        errors.push(`notes[${i}]: missing checklist`);
        return;
      }
      const items = value['checklist'];
      const itemIds = new Set<string>();
      items.forEach((item, j) => {
        if (
          !isRecord(item) ||
          !validUuid(item['id']) ||
          typeof item['text'] !== 'string' ||
          typeof item['checked'] !== 'boolean' ||
          !Number.isInteger(item['sortOrder'])
        ) {
          errors.push(`notes[${i}].checklist[${j}]: invalid item`);
          return;
        }
        if (itemIds.has(item['id']))
          errors.push(`notes[${i}].checklist: duplicate id ${item['id']}`);
        itemIds.add(item['id']);
        checklist.push({
          id: item['id'],
          text: item['text'],
          checked: item['checked'],
          sortOrder: item['sortOrder'] as number,
        });
      });
    }
    if (
      typeof value['title'] !== 'string' ||
      typeof value['content'] !== 'string' ||
      !Array.isArray(value['imageIds']) ||
      !value['imageIds'].every(validUuid) ||
      typeof value['pinned'] !== 'boolean' ||
      typeof value['archived'] !== 'boolean' ||
      !Array.isArray(value['labels']) ||
      !value['labels'].every(validUuid) ||
      !validDate(value['createdAt']) ||
      !validDate(value['updatedAt']) ||
      (value['deletedAt'] !== undefined && !validDate(value['deletedAt']))
    ) {
      errors.push(`notes[${i}]: invalid structure`);
      return;
    }
    notes.push({
      id: value['id'],
      notebookId: value['notebookId'],
      type,
      title: value['title'],
      content: value['content'],
      ...(type === 'checklist' ? { checklist } : {}),
      imageIds: value['imageIds'] as string[],
      pinned: value['pinned'],
      archived: value['archived'],
      ...(typeof value['color'] === 'string' ? { color: value['color'] } : {}),
      labels: value['labels'] as string[],
      ...(typeof value['deletedAt'] === 'string' ? { deletedAt: value['deletedAt'] } : {}),
      createdAt: value['createdAt'],
      updatedAt: value['updatedAt'],
    });
  });

  const labels: Label[] = [];
  (raw['labels'] as unknown[]).forEach((value, i) => {
    if (!isRecord(value) || !validUuid(value['id'])) {
      errors.push(`labels[${i}]: invalid id`);
      return;
    }
    if (typeof value['name'] !== 'string' || value['name'] === '') {
      errors.push(`labels[${i}]: missing name`);
      return;
    }
    labels.push({ id: value['id'], name: value['name'] });
  });

  const images: ExportedImage[] = [];
  (raw['images'] as unknown[]).forEach((value, i) => {
    if (!isRecord(value) || !validUuid(value['id'])) {
      errors.push(`images[${i}]: invalid id`);
      return;
    }
    if (typeof value['mimeType'] !== 'string' || !IMAGE_MIME_TYPES.has(value['mimeType'])) {
      errors.push(`images[${i}]: unsupported mimeType`);
      return;
    }
    const base64 = value['base64'];
    let byteLength = -1;
    try {
      byteLength = typeof base64 === 'string' ? atob(base64).length : -1;
    } catch {
      byteLength = -1;
    }
    if (
      typeof base64 !== 'string' ||
      base64.length === 0 ||
      base64.length % 4 !== 0 ||
      !BASE64_PATTERN.test(base64) ||
      byteLength < 0 ||
      byteLength > MAX_IMAGE_BYTES
    ) {
      errors.push(`images[${i}]: invalid base64 data`);
      return;
    }
    images.push({
      id: value['id'],
      mimeType: value['mimeType'],
      ...(typeof value['fileName'] === 'string' ? { fileName: value['fileName'] } : {}),
      base64,
    });
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  addDuplicateErrors(notebooks, 'notebooks', errors);
  addDuplicateErrors(notes, 'notes', errors);
  addDuplicateErrors(labels, 'labels', errors);
  addDuplicateErrors(images, 'images', errors);

  const notebookIds = new Set(notebooks.map((n) => n.id));
  const labelIds = new Set(labels.map((l) => l.id));
  const imageIds = new Set(images.map((image) => image.id));
  for (const note of notes) {
    if (!notebookIds.has(note.notebookId))
      errors.push(`note ${note.id}: missing notebook ${note.notebookId}`);
    for (const id of note.labels)
      if (!labelIds.has(id)) errors.push(`note ${note.id}: missing label ${id}`);
    for (const id of referencedImageIds(note)) {
      if (!imageIds.has(id)) errors.push(`note ${note.id}: missing image ${id}`);
    }
  }
  const scope = raw['scope'];
  let parsedScope: ExportScope | undefined;
  if (scope !== undefined) {
    if (!isRecord(scope) || !['all', 'notebook', 'note'].includes(String(scope['kind']))) {
      errors.push('Invalid export scope');
    } else if (scope['kind'] === 'all') parsedScope = { kind: 'all' };
    else if (scope['kind'] === 'notebook' && validUuid(scope['notebookId'])) {
      parsedScope = { kind: 'notebook', notebookId: scope['notebookId'] };
    } else if (scope['kind'] === 'note' && validUuid(scope['noteId'])) {
      parsedScope = { kind: 'note', noteId: scope['noteId'] };
    } else errors.push('Invalid export scope');
  }
  if (parsedScope?.kind === 'notebook' && !notebookIds.has(parsedScope.notebookId)) {
    errors.push('Export scope references a missing notebook');
  }
  if (parsedScope?.kind === 'note' && !notes.some((note) => note.id === parsedScope.noteId)) {
    errors.push('Export scope references a missing note');
  }
  const defaultNotebookId = raw['defaultNotebookId'];
  if (
    defaultNotebookId !== undefined &&
    defaultNotebookId !== null &&
    (!validUuid(defaultNotebookId) || !notebookIds.has(defaultNotebookId))
  ) {
    errors.push('Invalid defaultNotebookId');
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    envelope: {
      format: EXPORT_FORMAT,
      schemaVersion: version as number,
      exportedAt: validDate(raw['exportedAt']) ? raw['exportedAt'] : nowIso(),
      notebooks,
      notes,
      labels,
      images,
      ...(parsedScope ? { scope: parsedScope } : {}),
      ...(defaultNotebookId === null || typeof defaultNotebookId === 'string'
        ? { defaultNotebookId }
        : {}),
    },
  };
}

export interface ExistingIds {
  notebookIds: ReadonlySet<string>;
  noteIds: ReadonlySet<string>;
  labelIds: ReadonlySet<string>;
  imageIds: ReadonlySet<string>;
}

export function detectConflicts(envelope: ExportEnvelope, existing: ExistingIds): boolean {
  return (
    envelope.notebooks.some((n) => existing.notebookIds.has(n.id)) ||
    envelope.notes.some((n) => existing.noteIds.has(n.id)) ||
    envelope.labels.some((l) => existing.labelIds.has(l.id)) ||
    envelope.images.some((i) => existing.imageIds.has(i.id))
  );
}

/**
 * Returns a deep copy of the envelope where every entity has a fresh id and all
 * cross-references (note→notebook, note→labels, note→images, glacier-img://
 * URLs inside note content) are remapped. References to entities not contained
 * in the envelope are left untouched — the applier resolves or drops them.
 */
export function remapAsCopies(envelope: ExportEnvelope): ExportEnvelope {
  const notebookIds = new Map(envelope.notebooks.map((n) => [n.id, newId()]));
  const labelIds = new Map(envelope.labels.map((l) => [l.id, newId()]));
  const imageIds = new Map(envelope.images.map((i) => [i.id, newId()]));

  return {
    ...envelope,
    notebooks: envelope.notebooks.map((n) => ({ ...n, id: notebookIds.get(n.id)! })),
    labels: envelope.labels.map((l) => ({ ...l, id: labelIds.get(l.id)! })),
    images: envelope.images.map((i) => ({ ...i, id: imageIds.get(i.id)! })),
    notes: envelope.notes.map((note) => {
      let content = note.content;
      for (const [oldId, freshId] of imageIds) {
        content = content.split(oldId).join(freshId);
      }
      return {
        ...note,
        id: newId(),
        notebookId: notebookIds.get(note.notebookId) ?? note.notebookId,
        labels: note.labels.map((id) => labelIds.get(id) ?? id),
        imageIds: note.imageIds.map((id) => imageIds.get(id) ?? id),
        content,
        ...(note.checklist
          ? { checklist: note.checklist.map((item) => ({ ...item, id: newId() })) }
          : {}),
      };
    }),
  };
}

export function envelopeCounts(envelope: ExportEnvelope): ImportCounts {
  return {
    notebooks: envelope.notebooks.length,
    notes: envelope.notes.length,
    labels: envelope.labels.length,
    images: envelope.images.length,
  };
}
