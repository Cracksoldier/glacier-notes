import type {
  AppCommand,
  GlacierApi,
  ImageAsset,
  ImportInspectResult,
  ImportStrategy,
  Label,
  Note,
  Notebook,
  Settings,
} from '../../../electron/api';

interface TransferStubState {
  /** Result the next importInspect call resolves to; tests may replace it. */
  inspectResult: ImportInspectResult;
  exportCalls: unknown[];
  appliedStrategies: ImportStrategy[];
  importCanceled: boolean;
}

// In-memory fake of the preload bridge for renderer unit tests.
export function installGlacierApiStub(): {
  notes: Note[];
  notebooks: Notebook[];
  labels: Label[];
  images: ImageAsset[];
  settings: Settings;
  transfer: TransferStubState;
  sharedNoteIds: string[];
  capabilities: { tray: boolean; globalShortcut: boolean; quickNoteShortcutRegistered: boolean };
  quickNotes: string[];
  quickNoteCanceled: boolean;
  rejectNextSettingsSet: boolean;
  /** Fire a main-process command as the menu/tray would. */
  fireCommand: (command: AppCommand) => void;
  /** Fire the cross-window notes-changed event. */
  fireNotesChanged: () => void;
} {
  const now = new Date().toISOString();
  const defaultNotebook: Notebook = {
    id: 'nb-default',
    name: 'Notes',
    createdAt: now,
    updatedAt: now,
    sortOrder: 0,
  };
  const state = {
    notebooks: [defaultNotebook] as Notebook[],
    notes: [] as Note[],
    labels: [] as Label[],
    images: [] as ImageAsset[],
    settings: {
      theme: 'dark',
      language: 'en',
      moveCheckedToBottom: false,
      closeToTray: true,
      quickNoteShortcut: 'CommandOrControl+Alt+G',
      trashAutoPurgeDays: 30,
      lastSelectedNotebookId: null,
    } as Settings,
    transfer: {
      inspectResult: {
        status: 'ready',
        hasConflicts: false,
        counts: { notebooks: 0, notes: 0, labels: 0, images: 0 },
      },
      exportCalls: [],
      appliedStrategies: [],
      importCanceled: false,
    } as TransferStubState,
    sharedNoteIds: [] as string[],
    capabilities: { tray: true, globalShortcut: true, quickNoteShortcutRegistered: true },
    quickNotes: [] as string[],
    quickNoteCanceled: false,
    rejectNextSettingsSet: false,
    fireCommand: (command: AppCommand) => {
      for (const cb of commandCallbacks) cb(command);
    },
    fireNotesChanged: () => {
      for (const cb of notesChangedCallbacks) cb();
    },
  };

  const commandCallbacks = new Set<(command: AppCommand) => void>();
  const notesChangedCallbacks = new Set<() => void>();

  let nextId = 1;
  const newId = () => `id-${nextId++}`;

  const getNote = (id: string): Note => {
    const note = state.notes.find((n) => n.id === id);
    if (!note) throw new Error(`Note not found: ${id}`);
    return note;
  };

  const api: GlacierApi = {
    ping: async () => 'pong',
    notebooks: {
      list: async () => [...state.notebooks].sort((a, b) => a.sortOrder - b.sortOrder),
      create: async (name) => {
        const notebook: Notebook = {
          id: newId(),
          name,
          createdAt: now,
          updatedAt: now,
          sortOrder: state.notebooks.length,
        };
        state.notebooks.push(notebook);
        return notebook;
      },
      update: async (id, patch) => {
        const notebook = state.notebooks.find((n) => n.id === id);
        if (!notebook) throw new Error(`Notebook not found: ${id}`);
        Object.assign(notebook, patch);
        return notebook;
      },
      delete: async (id) => {
        state.notebooks = state.notebooks.filter((n) => n.id !== id);
        state.notes = state.notes.filter((n) => n.notebookId !== id);
      },
      getDefaultId: async () => defaultNotebook.id,
    },
    notes: {
      list: async (filter = {}) =>
        state.notes.filter((note) => {
          if (Boolean(note.deletedAt) !== (filter.trashed === true)) return false;
          if (filter.trashed !== true && note.archived !== (filter.archived === true)) return false;
          if (filter.notebookId && note.notebookId !== filter.notebookId) return false;
          return true;
        }),
      get: async (id) => getNote(id),
      create: async (input) => {
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
        state.notes.push(note);
        return note;
      },
      update: async (id, patch) => Object.assign(getNote(id), patch),
      trash: async (id) => Object.assign(getNote(id), { deletedAt: now }),
      restore: async (id) => {
        const note = getNote(id);
        delete note.deletedAt;
        return note;
      },
      purge: async (id) => {
        state.notes = state.notes.filter((n) => n.id !== id);
      },
      move: async (id, notebookId) => Object.assign(getNote(id), { notebookId }),
    },
    labels: {
      list: async () => [...state.labels].sort((a, b) => a.name.localeCompare(b.name)),
      create: async (name) => {
        const label: Label = { id: newId(), name };
        state.labels.push(label);
        return label;
      },
      update: async (id, patch) => {
        const label = state.labels.find((l) => l.id === id);
        if (!label) throw new Error(`Label not found: ${id}`);
        return Object.assign(label, patch);
      },
      delete: async (id) => {
        state.labels = state.labels.filter((l) => l.id !== id);
        for (const note of state.notes) {
          note.labels = note.labels.filter((l) => l !== id);
        }
      },
    },
    images: {
      add: async (_data, mimeType, fileName) => {
        const asset = { id: newId(), mimeType, ...(fileName ? { fileName } : {}) };
        state.images.push(asset);
        return asset;
      },
      getDataUrl: async () => '',
      delete: async (id) => {
        state.images = state.images.filter((i) => i.id !== id);
      },
      deleteIfUnreferenced: async (id) => {
        const referenced = state.notes.some(
          (n) => n.imageIds.includes(id) || n.content.includes(id),
        );
        if (referenced || !state.images.some((i) => i.id === id)) return false;
        state.images = state.images.filter((i) => i.id !== id);
        return true;
      },
    },
    settings: {
      get: async () => ({ ...state.settings }),
      set: async (patch) => {
        if (state.rejectNextSettingsSet) {
          state.rejectNextSettingsSet = false;
          throw new Error('Settings update rejected');
        }
        return Object.assign(state.settings, patch);
      },
    },
    shell: {
      openExternal: async () => undefined,
    },
    transfer: {
      exportData: async (scope) => {
        state.transfer.exportCalls.push(scope);
        return { status: 'saved' };
      },
      importInspect: async () => state.transfer.inspectResult,
      importApply: async (strategy) => {
        state.transfer.appliedStrategies.push(strategy);
        return { status: 'done', counts: { notebooks: 0, notes: 0, labels: 0, images: 0 } };
      },
      importCancel: async () => {
        state.transfer.importCanceled = true;
      },
    },
    share: {
      emailNote: async (noteId) => {
        state.sharedNoteIds.push(noteId);
      },
    },
    quickNote: {
      save: async (content) => {
        state.quickNotes.push(content);
      },
      cancel: async () => {
        state.quickNoteCanceled = true;
      },
    },
    system: {
      getCapabilities: async () => ({ ...state.capabilities }),
    },
    events: {
      onCommand: (callback) => {
        commandCallbacks.add(callback);
        return () => commandCallbacks.delete(callback);
      },
      onNotesChanged: (callback) => {
        notesChangedCallbacks.add(callback);
        return () => notesChangedCallbacks.delete(callback);
      },
    },
  };

  (window as { glacierApi: GlacierApi }).glacierApi = api;
  return state;
}
