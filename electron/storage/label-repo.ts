import * as path from 'path';
import { DebouncedWriter, readJsonFile } from './json-store';
import { Label, newId, SCHEMA_VERSION } from './models';
import { NoteRepo } from './note-repo';

interface LabelsFile {
  schemaVersion: number;
  labels: Label[];
}

export class LabelRepo {
  private readonly file: string;
  private labels: Label[] = [];

  constructor(
    baseDir: string,
    private readonly writer: DebouncedWriter,
    private readonly noteRepo: NoteRepo,
  ) {
    this.file = path.join(baseDir, 'labels.json');
  }

  init(): void {
    this.labels = readJsonFile<LabelsFile>(this.file)?.labels ?? [];
  }

  list(): Label[] {
    return [...this.labels].sort((a, b) => a.name.localeCompare(b.name));
  }

  exists(id: string): boolean {
    return this.labels.some((l) => l.id === id);
  }

  create(name: string): Label {
    const label: Label = { id: newId(), name };
    this.labels.push(label);
    this.persist();
    return label;
  }

  update(id: string, patch: Partial<Pick<Label, 'name'>>): Label {
    const label = this.labels.find((l) => l.id === id);
    if (!label) {
      throw new Error(`Label not found: ${id}`);
    }
    Object.assign(label, patch);
    this.persist();
    return label;
  }

  delete(id: string): void {
    const index = this.labels.findIndex((l) => l.id === id);
    if (index === -1) {
      throw new Error(`Label not found: ${id}`);
    }
    this.labels.splice(index, 1);
    this.noteRepo.stripLabel(id);
    this.persist();
  }

  private persist(): void {
    this.writer.schedule(this.file, () => ({ schemaVersion: SCHEMA_VERSION, labels: this.labels }) satisfies LabelsFile);
  }
}
