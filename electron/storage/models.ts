// Data model per SPECIFICATION.md §3 and §7.

export const SCHEMA_VERSION = 1;

export interface Notebook {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  sortOrder: number;
}

export type NoteType = 'text' | 'checklist';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  sortOrder: number;
}

export interface Note {
  id: string;
  notebookId: string;
  type: NoteType;
  title: string;
  content: string;
  checklist?: ChecklistItem[];
  imageIds: string[];
  pinned: boolean;
  archived: boolean;
  color?: string;
  labels: string[];
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Label {
  id: string;
  name: string;
}

export interface NoteFilter {
  notebookId?: string;
  archived?: boolean;
  trashed?: boolean;
}

export interface NoteCreateInput {
  notebookId: string;
  type: NoteType;
  title?: string;
  content?: string;
  checklist?: ChecklistItem[];
}

export type NoteUpdatePatch = Partial<
  Pick<Note, 'title' | 'content' | 'checklist' | 'pinned' | 'archived' | 'color' | 'labels' | 'imageIds'>
>;

export interface ImageAsset {
  id: string;
  mimeType: string;
  fileName?: string;
}

export type ThemeName = 'dark' | 'light';
export type LanguageCode = 'en' | 'de';

export interface Settings {
  theme: ThemeName;
  language: LanguageCode;
  moveCheckedToBottom: boolean;
  closeToTray: boolean;
  quickNoteShortcut: string;
  trashAutoPurgeDays: number;
  lastSelectedNotebookId: string | null;
}

export function defaultSettings(osLocale: string): Settings {
  return {
    theme: 'dark',
    language: osLocale.toLowerCase().startsWith('de') ? 'de' : 'en',
    moveCheckedToBottom: false,
    closeToTray: true,
    quickNoteShortcut: 'CommandOrControl+Alt+G',
    trashAutoPurgeDays: 30,
    lastSelectedNotebookId: null,
  };
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
