// Shared contract between preload (implementation) and renderer (window.glacierApi).
// Mirrors the IPC surface in SPECIFICATION.md §9; search/transfer/share arrive in M6/M8.
import type {
  ChecklistItem,
  ImageAsset,
  Label,
  Note,
  Notebook,
  NoteCreateInput,
  NoteFilter,
  NoteUpdatePatch,
  Settings,
} from './storage/models';

export type { ChecklistItem, ImageAsset, Label, Note, Notebook, Settings };
export type { NoteCreateInput, NoteFilter, NoteUpdatePatch };
export type { LanguageCode, NoteType, ThemeName } from './storage/models';

export interface GlacierApi {
  ping(): Promise<string>;
  notebooks: {
    list(): Promise<Notebook[]>;
    create(name: string): Promise<Notebook>;
    update(id: string, patch: Partial<Pick<Notebook, 'name' | 'color' | 'sortOrder'>>): Promise<Notebook>;
    delete(id: string): Promise<void>;
    getDefaultId(): Promise<string>;
  };
  notes: {
    list(filter?: NoteFilter): Promise<Note[]>;
    get(id: string): Promise<Note>;
    create(input: NoteCreateInput): Promise<Note>;
    update(id: string, patch: NoteUpdatePatch): Promise<Note>;
    trash(id: string): Promise<Note>;
    restore(id: string): Promise<Note>;
    purge(id: string): Promise<void>;
    move(id: string, notebookId: string): Promise<Note>;
  };
  labels: {
    list(): Promise<Label[]>;
    create(name: string): Promise<Label>;
    update(id: string, patch: Partial<Pick<Label, 'name'>>): Promise<Label>;
    delete(id: string): Promise<void>;
  };
  images: {
    add(data: Uint8Array, mimeType: string, fileName?: string): Promise<ImageAsset>;
    getDataUrl(id: string): Promise<string>;
    delete(id: string): Promise<void>;
  };
  settings: {
    get(): Promise<Settings>;
    set(patch: Partial<Settings>): Promise<Settings>;
  };
}
