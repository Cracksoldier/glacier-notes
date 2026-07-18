import * as fs from 'fs';
import * as path from 'path';
import { DebouncedWriter, readJsonFile } from './json-store';
import { newId, Note, NoteCreateInput, NoteFilter, NoteUpdatePatch, nowIso, SCHEMA_VERSION } from './models';

type StoredNote = Note & { schemaVersion: number };

export class NoteRepo {
  private readonly dir: string;
  private readonly notes = new Map<string, Note>();

  constructor(baseDir: string, private readonly writer: DebouncedWriter) {
    this.dir = path.join(baseDir, 'notes');
  }

  init(): void {
    fs.mkdirSync(this.dir, { recursive: true });
    for (const entry of fs.readdirSync(this.dir)) {
      if (!entry.endsWith('.json')) continue;
      const raw = readJsonFile<StoredNote>(path.join(this.dir, entry));
      if (raw?.id) {
        const { schemaVersion: _v, ...note } = raw;
        this.notes.set(note.id, note);
      }
    }
  }

  list(filter: NoteFilter = {}): Note[] {
    const wantTrashed = filter.trashed === true;
    return [...this.notes.values()]
      .filter((note) => {
        if (Boolean(note.deletedAt) !== wantTrashed) return false;
        if (!wantTrashed && note.archived !== (filter.archived === true)) return false;
        if (filter.notebookId && note.notebookId !== filter.notebookId) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  get(id: string): Note {
    const note = this.notes.get(id);
    if (!note) {
      throw new Error(`Note not found: ${id}`);
    }
    return note;
  }

  create(input: NoteCreateInput): Note {
    const now = nowIso();
    const note: Note = {
      id: newId(),
      notebookId: input.notebookId,
      type: input.type,
      title: input.title ?? '',
      content: input.content ?? '',
      ...(input.type === 'checklist' ? { checklist: input.checklist ?? [] } : {}),
      imageIds: [],
      pinned: false,
      archived: false,
      labels: [],
      createdAt: now,
      updatedAt: now,
    };
    this.notes.set(note.id, note);
    this.persist(note);
    return note;
  }

  update(id: string, patch: NoteUpdatePatch): Note {
    const note = this.get(id);
    Object.assign(note, patch, { updatedAt: nowIso() });
    this.persist(note);
    return note;
  }

  trash(id: string): Note {
    const note = this.get(id);
    note.deletedAt = nowIso();
    this.persist(note);
    return note;
  }

  restore(id: string): Note {
    const note = this.get(id);
    delete note.deletedAt;
    note.updatedAt = nowIso();
    this.persist(note);
    return note;
  }

  purge(id: string): void {
    this.get(id);
    this.notes.delete(id);
    const file = this.noteFile(id);
    this.writer.cancel(file);
    fs.rmSync(file, { force: true });
  }

  move(id: string, notebookId: string): Note {
    const note = this.get(id);
    note.notebookId = notebookId;
    note.updatedAt = nowIso();
    this.persist(note);
    return note;
  }

  purgeByNotebook(notebookId: string): void {
    for (const note of this.notes.values()) {
      if (note.notebookId === notebookId) {
        this.purge(note.id);
      }
    }
  }

  purgeExpired(days: number): number {
    if (days <= 0) return 0;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let purged = 0;
    for (const note of this.notes.values()) {
      if (note.deletedAt && Date.parse(note.deletedAt) < cutoff) {
        this.purge(note.id);
        purged++;
      }
    }
    return purged;
  }

  stripLabel(labelId: string): void {
    for (const note of this.notes.values()) {
      if (note.labels.includes(labelId)) {
        note.labels = note.labels.filter((l) => l !== labelId);
        this.persist(note);
      }
    }
  }

  private noteFile(id: string): string {
    return path.join(this.dir, `${id}.json`);
  }

  private persist(note: Note): void {
    this.writer.schedule(this.noteFile(note.id), () => ({ schemaVersion: SCHEMA_VERSION, ...note }));
  }
}
