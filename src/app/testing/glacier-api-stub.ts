import type { GlacierApi, ImageAsset, Note, Notebook, Settings } from '../../../electron/api';

// In-memory fake of the preload bridge for renderer unit tests.
export function installGlacierApiStub(): {
  notes: Note[];
  notebooks: Notebook[];
  images: ImageAsset[];
  settings: Settings;
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
  };

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
      list: async () => [],
      create: async (name) => ({ id: newId(), name }),
      update: async (id, patch) => ({ id, name: patch.name ?? '' }),
      delete: async () => undefined,
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
        const referenced = state.notes.some((n) => n.imageIds.includes(id) || n.content.includes(id));
        if (referenced || !state.images.some((i) => i.id === id)) return false;
        state.images = state.images.filter((i) => i.id !== id);
        return true;
      },
    },
    settings: {
      get: async () => ({ ...state.settings }),
      set: async (patch) => Object.assign(state.settings, patch),
    },
    shell: {
      openExternal: async () => undefined,
    },
  };

  (window as { glacierApi: GlacierApi }).glacierApi = api;
  return state;
}
