import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  AppCommand,
  ExportScope,
  GlacierApi,
  ImportStrategy,
  NoteCreateInput,
  NoteFilter,
  NoteUpdatePatch,
} from './api';

const api: GlacierApi = {
  ping: () => ipcRenderer.invoke('app:ping'),
  notebooks: {
    list: () => ipcRenderer.invoke('notebooks:list'),
    create: (name: string) => ipcRenderer.invoke('notebooks:create', name),
    update: (id: string, patch) => ipcRenderer.invoke('notebooks:update', id, patch),
    delete: (id: string) => ipcRenderer.invoke('notebooks:delete', id),
    getDefaultId: () => ipcRenderer.invoke('notebooks:getDefaultId'),
  },
  notes: {
    list: (filter?: NoteFilter) => ipcRenderer.invoke('notes:list', filter),
    get: (id: string) => ipcRenderer.invoke('notes:get', id),
    create: (input: NoteCreateInput) => ipcRenderer.invoke('notes:create', input),
    update: (id: string, patch: NoteUpdatePatch) => ipcRenderer.invoke('notes:update', id, patch),
    trash: (id: string) => ipcRenderer.invoke('notes:trash', id),
    restore: (id: string) => ipcRenderer.invoke('notes:restore', id),
    purge: (id: string) => ipcRenderer.invoke('notes:purge', id),
    move: (id: string, notebookId: string) => ipcRenderer.invoke('notes:move', id, notebookId),
  },
  labels: {
    list: () => ipcRenderer.invoke('labels:list'),
    create: (name: string) => ipcRenderer.invoke('labels:create', name),
    update: (id: string, patch) => ipcRenderer.invoke('labels:update', id, patch),
    delete: (id: string) => ipcRenderer.invoke('labels:delete', id),
  },
  images: {
    add: (data: Uint8Array, mimeType: string, fileName?: string) =>
      ipcRenderer.invoke('images:add', data, mimeType, fileName),
    getDataUrl: (id: string) => ipcRenderer.invoke('images:getDataUrl', id),
    delete: (id: string) => ipcRenderer.invoke('images:delete', id),
    deleteIfUnreferenced: (id: string) => ipcRenderer.invoke('images:deleteIfUnreferenced', id),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
  transfer: {
    exportData: (scope: ExportScope, filePath?: string) =>
      ipcRenderer.invoke('transfer:exportData', scope, filePath),
    importInspect: (filePath?: string) => ipcRenderer.invoke('transfer:importInspect', filePath),
    importApply: (strategy: ImportStrategy) => ipcRenderer.invoke('transfer:importApply', strategy),
    importCancel: () => ipcRenderer.invoke('transfer:importCancel'),
  },
  share: {
    emailNote: (noteId: string) => ipcRenderer.invoke('share:emailNote', noteId),
  },
  quickNote: {
    save: (content: string) => ipcRenderer.invoke('quickNote:save', content),
    cancel: () => ipcRenderer.invoke('quickNote:cancel'),
  },
  system: {
    getCapabilities: () => ipcRenderer.invoke('system:getCapabilities'),
  },
  events: {
    onCommand: (callback: (command: AppCommand) => void) => {
      const listener = (_e: IpcRendererEvent, command: AppCommand) => callback(command);
      ipcRenderer.on('glacier:command', listener);
      return () => ipcRenderer.removeListener('glacier:command', listener);
    },
    onNotesChanged: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('glacier:notes-changed', listener);
      return () => ipcRenderer.removeListener('glacier:notes-changed', listener);
    },
  },
};

contextBridge.exposeInMainWorld('glacierApi', api);
