import * as path from 'path';
import { DebouncedWriter, readJsonFile, writeJsonAtomic } from './json-store';
import { newId, Notebook, nowIso, SCHEMA_VERSION } from './models';

interface NotebooksFile {
  schemaVersion: number;
  defaultNotebookId: string;
  notebooks: Notebook[];
}

const DEFAULT_NOTEBOOK_NAME = 'Notes';

export class NotebookRepo {
  private readonly file: string;
  private notebooks: Notebook[] = [];
  private defaultNotebookId = '';

  constructor(baseDir: string, private readonly writer: DebouncedWriter) {
    this.file = path.join(baseDir, 'notebooks.json');
  }

  init(): void {
    const raw = readJsonFile<NotebooksFile>(this.file);
    if (raw?.notebooks?.length) {
      this.notebooks = raw.notebooks;
      this.defaultNotebookId = this.notebooks.some((n) => n.id === raw.defaultNotebookId)
        ? raw.defaultNotebookId
        : this.notebooks[0].id;
    } else {
      const now = nowIso();
      const defaultNotebook: Notebook = {
        id: newId(),
        name: DEFAULT_NOTEBOOK_NAME,
        createdAt: now,
        updatedAt: now,
        sortOrder: 0,
      };
      this.notebooks = [defaultNotebook];
      this.defaultNotebookId = defaultNotebook.id;
      writeJsonAtomic(this.file, this.toFile());
    }
  }

  list(): Notebook[] {
    return [...this.notebooks].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getDefaultId(): string {
    return this.defaultNotebookId;
  }

  exists(id: string): boolean {
    return this.notebooks.some((n) => n.id === id);
  }

  create(name: string): Notebook {
    const now = nowIso();
    const notebook: Notebook = {
      id: newId(),
      name,
      createdAt: now,
      updatedAt: now,
      sortOrder: Math.max(-1, ...this.notebooks.map((n) => n.sortOrder)) + 1,
    };
    this.notebooks.push(notebook);
    this.persist();
    return notebook;
  }

  update(id: string, patch: Partial<Pick<Notebook, 'name' | 'color' | 'sortOrder'>>): Notebook {
    const notebook = this.notebooks.find((n) => n.id === id);
    if (!notebook) {
      throw new Error(`Notebook not found: ${id}`);
    }
    Object.assign(notebook, patch, { updatedAt: nowIso() });
    this.persist();
    return notebook;
  }

  delete(id: string): void {
    if (id === this.defaultNotebookId) {
      throw new Error('The default notebook cannot be deleted');
    }
    const index = this.notebooks.findIndex((n) => n.id === id);
    if (index === -1) {
      throw new Error(`Notebook not found: ${id}`);
    }
    this.notebooks.splice(index, 1);
    this.persist();
  }

  private toFile(): NotebooksFile {
    return {
      schemaVersion: SCHEMA_VERSION,
      defaultNotebookId: this.defaultNotebookId,
      notebooks: this.notebooks,
    };
  }

  private persist(): void {
    this.writer.schedule(this.file, () => this.toFile());
  }
}
