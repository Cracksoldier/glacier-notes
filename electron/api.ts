// Shared contract between preload (implementation) and renderer (window.glacierApi).
// Mirrors the IPC surface in SPECIFICATION.md §9.
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
import type {
  ExportDataResult,
  ExportScope,
  ImportApplyResult,
  ImportInspectResult,
  ImportStrategy,
} from './transfer-core';

export type { ChecklistItem, ImageAsset, Label, Note, Notebook, Settings };
export type { NoteCreateInput, NoteFilter, NoteUpdatePatch };
export type { LanguageCode, NoteType, ThemeName } from './storage/models';
export type {
  ExportDataResult,
  ExportScope,
  ImportApplyResult,
  ImportCounts,
  ImportInspectResult,
  ImportStrategy,
} from './transfer-core';

/** Desktop-integration capabilities for graceful degradation (§5.12). */
export interface SystemCapabilities {
  tray: boolean;
  globalShortcut: boolean;
  quickNoteShortcutRegistered: boolean;
}

export interface RecoveryWarning {
  storageFile: string;
  backupPath: string;
  action: 'reset' | 'skipped';
}

/** Commands the main process (menu, tray) sends to the renderer. */
export type AppCommand =
  | 'new-text-note'
  | 'new-checklist-note'
  | 'toggle-transfer'
  | 'open-settings'
  | 'toggle-shortcut-help';

export interface GlacierApi {
  ping(): Promise<string>;
  notebooks: {
    list(): Promise<Notebook[]>;
    create(name: string): Promise<Notebook>;
    update(
      id: string,
      patch: Partial<Pick<Notebook, 'name' | 'color' | 'sortOrder'>>,
    ): Promise<Notebook>;
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
    deleteIfUnreferenced(id: string): Promise<boolean>;
  };
  settings: {
    get(): Promise<Settings>;
    set(patch: Partial<Settings>): Promise<Settings>;
  };
  shell: {
    openExternal(url: string): Promise<void>;
  };
  transfer: {
    /** filePath bypasses the OS save dialog; allowed in smoke mode only. */
    exportData(scope: ExportScope, filePath?: string): Promise<ExportDataResult>;
    /** filePath bypasses the OS open dialog; allowed in smoke mode only. */
    importInspect(filePath?: string): Promise<ImportInspectResult>;
    importApply(strategy: ImportStrategy): Promise<ImportApplyResult>;
    importCancel(): Promise<void>;
  };
  share: {
    emailNote(noteId: string): Promise<void>;
  };
  quickNote: {
    /** Saves non-empty content as a text note in the default notebook, then closes the window. */
    save(content: string): Promise<void>;
    cancel(): Promise<void>;
  };
  system: {
    getCapabilities(): Promise<SystemCapabilities>;
    getStartupWarnings(): Promise<RecoveryWarning[]>;
  };
  events: {
    /** Menu/tray commands from the main process. Returns an unsubscriber. */
    onCommand(callback: (command: AppCommand) => void): () => void;
    /** Notes changed outside this window (e.g. quick note). Returns an unsubscriber. */
    onNotesChanged(callback: () => void): () => void;
  };
}
