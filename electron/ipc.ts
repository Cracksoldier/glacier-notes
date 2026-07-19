import { ipcMain, shell } from 'electron';
import { ImageStore } from './storage/image-store';
import { LabelRepo } from './storage/label-repo';
import {
  Label,
  Notebook,
  NoteCreateInput,
  NoteFilter,
  NoteUpdatePatch,
  Settings,
} from './storage/models';
import { NotebookRepo } from './storage/notebook-repo';
import { NoteRepo } from './storage/note-repo';
import { SettingsStore } from './storage/settings-store';

export interface Repos {
  notebooks: NotebookRepo;
  notes: NoteRepo;
  labels: LabelRepo;
  images: ImageStore;
  settings: SettingsStore;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

function requireObject<T>(value: unknown, name: string): T {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Invalid ${name}`);
  }
  return value as T;
}

export function gcImages(repos: Pick<Repos, 'notes' | 'images'>, imageIds: string[]): void {
  for (const id of new Set(imageIds)) {
    if (repos.images.has(id) && !repos.notes.isImageReferenced(id)) {
      repos.images.delete(id);
    }
  }
}

export interface IpcHooks {
  setSettings?(prev: Settings, patch: Partial<Settings>, commit: () => Settings): Settings;
}

export function registerIpc(repos: Repos, hooks?: IpcHooks): void {
  ipcMain.handle('app:ping', () => 'pong');

  // Notebooks
  ipcMain.handle('notebooks:list', () => repos.notebooks.list());
  ipcMain.handle('notebooks:create', (_e, name: unknown) =>
    repos.notebooks.create(requireString(name, 'notebook name')),
  );
  ipcMain.handle('notebooks:update', (_e, id: unknown, patch: unknown) =>
    repos.notebooks.update(
      requireString(id, 'notebook id'),
      requireObject<Partial<Notebook>>(patch, 'patch'),
    ),
  );
  ipcMain.handle('notebooks:delete', (_e, id: unknown) => {
    const notebookId = requireString(id, 'notebook id');
    repos.notebooks.delete(notebookId);
    gcImages(repos, repos.notes.purgeByNotebook(notebookId));
  });
  ipcMain.handle('notebooks:getDefaultId', () => repos.notebooks.getDefaultId());

  // Notes
  ipcMain.handle('notes:list', (_e, filter: unknown) =>
    repos.notes.list((filter ?? {}) as NoteFilter),
  );
  ipcMain.handle('notes:get', (_e, id: unknown) => repos.notes.get(requireString(id, 'note id')));
  ipcMain.handle('notes:create', (_e, input: unknown) => {
    const noteInput = requireObject<NoteCreateInput>(input, 'note input');
    requireString(noteInput.notebookId, 'notebookId');
    if (noteInput.type !== 'text' && noteInput.type !== 'checklist') {
      throw new Error('Invalid note type');
    }
    if (!repos.notebooks.exists(noteInput.notebookId)) {
      throw new Error(`Notebook not found: ${noteInput.notebookId}`);
    }
    return repos.notes.create(noteInput);
  });
  ipcMain.handle('notes:update', (_e, id: unknown, patch: unknown) => {
    const notePatch = requireObject<NoteUpdatePatch>(patch, 'patch');
    if (
      notePatch.type !== undefined &&
      notePatch.type !== 'text' &&
      notePatch.type !== 'checklist'
    ) {
      throw new Error('Invalid note type');
    }
    return repos.notes.update(requireString(id, 'note id'), notePatch);
  });
  ipcMain.handle('notes:trash', (_e, id: unknown) =>
    repos.notes.trash(requireString(id, 'note id')),
  );
  ipcMain.handle('notes:restore', (_e, id: unknown) =>
    repos.notes.restore(requireString(id, 'note id')),
  );
  ipcMain.handle('notes:purge', (_e, id: unknown) => {
    gcImages(repos, repos.notes.purge(requireString(id, 'note id')));
  });
  ipcMain.handle('notes:move', (_e, id: unknown, notebookId: unknown) => {
    const target = requireString(notebookId, 'notebook id');
    if (!repos.notebooks.exists(target)) {
      throw new Error(`Notebook not found: ${target}`);
    }
    return repos.notes.move(requireString(id, 'note id'), target);
  });

  // Labels
  ipcMain.handle('labels:list', () => repos.labels.list());
  ipcMain.handle('labels:create', (_e, name: unknown) =>
    repos.labels.create(requireString(name, 'label name')),
  );
  ipcMain.handle('labels:update', (_e, id: unknown, patch: unknown) =>
    repos.labels.update(
      requireString(id, 'label id'),
      requireObject<Partial<Label>>(patch, 'patch'),
    ),
  );
  ipcMain.handle('labels:delete', (_e, id: unknown) =>
    repos.labels.delete(requireString(id, 'label id')),
  );

  // Images
  ipcMain.handle('images:add', (_e, data: unknown, mimeType: unknown, fileName?: unknown) => {
    if (!(data instanceof Uint8Array)) {
      throw new Error('Invalid image data');
    }
    return repos.images.add(
      data,
      requireString(mimeType, 'mime type'),
      fileName === undefined ? undefined : requireString(fileName, 'file name'),
    );
  });
  ipcMain.handle('images:getDataUrl', (_e, id: unknown) =>
    repos.images.getDataUrl(requireString(id, 'image id')),
  );
  ipcMain.handle('images:delete', (_e, id: unknown) =>
    repos.images.delete(requireString(id, 'image id')),
  );
  ipcMain.handle('images:deleteIfUnreferenced', (_e, id: unknown) => {
    const imageId = requireString(id, 'image id');
    if (!repos.images.has(imageId) || repos.notes.isImageReferenced(imageId)) {
      return false;
    }
    repos.images.delete(imageId);
    return true;
  });

  // Shell
  ipcMain.handle('shell:openExternal', (_e, url: unknown) => {
    const parsed = new URL(requireString(url, 'url'));
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Refusing to open non-http(s) URL: ${parsed.protocol}`);
    }
    return shell.openExternal(parsed.href);
  });

  // Settings
  ipcMain.handle('settings:get', () => repos.settings.get());
  ipcMain.handle('settings:set', (_e, patch: unknown) => {
    const prev = repos.settings.get();
    const settingsPatch = requireObject<Partial<Settings>>(patch, 'settings patch');
    const commit = () => repos.settings.set(settingsPatch);
    return hooks?.setSettings ? hooks.setSettings(prev, settingsPatch, commit) : commit();
  });
}
