import { BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'fs';
import { gcImages, Repos } from './ipc';
import {
  beginImportTransaction,
  commitImportTransaction,
  recoverImportTransaction,
} from './import-transaction';
import { DebouncedWriter } from './storage/json-store';
import { Note } from './storage/models';
import {
  collectExport,
  detectConflicts,
  envelopeCounts,
  ExportDataResult,
  ExportEnvelope,
  ExportScope,
  ImportApplyResult,
  ImportInspectResult,
  ImportStrategy,
  remapAsCopies,
  referencedImageIds,
  validateEnvelope,
} from './transfer-core';

const FILE_FILTERS = [{ name: 'Glacier Notes export', extensions: ['glacier.json', 'json'] }];

function requireSmokeMode(filePath: unknown): string | undefined {
  if (filePath === undefined) return undefined;
  if (process.env['GLACIER_SMOKE'] !== '1') {
    throw new Error('filePath override is only allowed in smoke mode');
  }
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new Error('Invalid filePath');
  }
  return filePath;
}

export function registerTransferIpc(
  repos: Repos,
  writer: DebouncedWriter,
  getMainWindow: () => BrowserWindow | null,
  baseDir: string,
): void {
  let pendingImport: { envelope: ExportEnvelope; senderId: number } | null = null;

  ipcMain.handle(
    'transfer:exportData',
    async (_e, scope: unknown, filePath?: unknown): Promise<ExportDataResult> => {
      const exportScope = scope as ExportScope;
      if (
        !exportScope ||
        (exportScope.kind === 'notebook' && !repos.notebooks.exists(exportScope.notebookId)) ||
        (exportScope.kind === 'note' &&
          !allNotes(repos).some((note) => note.id === exportScope.noteId)) ||
        !['all', 'notebook', 'note'].includes(exportScope.kind)
      ) {
        throw new Error('Invalid export scope');
      }

      let target = requireSmokeMode(filePath);
      if (target === undefined) {
        const win = getMainWindow();
        const defaultName = `glacier-export-${new Date().toISOString().slice(0, 10)}.glacier.json`;
        const options = { defaultPath: defaultName, filters: FILE_FILTERS };
        const result = win
          ? await dialog.showSaveDialog(win, options)
          : await dialog.showSaveDialog(options);
        if (result.canceled || !result.filePath) {
          return { status: 'canceled' };
        }
        target = result.filePath;
      }

      const envelope = collectExport(exportScope, {
        notebooks: repos.notebooks.list(),
        notes: allNotes(repos),
        labels: repos.labels.list(),
        defaultNotebookId: repos.notebooks.getDefaultId(),
        readImage: (id) => {
          if (!repos.images.has(id)) return null;
          const { path: imagePath, mimeType, fileName } = repos.images.getFileInfo(id);
          return {
            mimeType,
            ...(fileName ? { fileName } : {}),
            base64: fs.readFileSync(imagePath).toString('base64'),
          };
        },
      });
      fs.writeFileSync(target, JSON.stringify(envelope, null, 2));
      return { status: 'saved' };
    },
  );

  ipcMain.handle(
    'transfer:importInspect',
    async (event, filePath?: unknown): Promise<ImportInspectResult> => {
      if (pendingImport && pendingImport.senderId !== event.sender.id) {
        throw new Error('Another window has a pending import');
      }
      pendingImport = null;

      let source = requireSmokeMode(filePath);
      if (source === undefined) {
        const win = getMainWindow();
        const options = { filters: FILE_FILTERS, properties: ['openFile' as const] };
        const result = win
          ? await dialog.showOpenDialog(win, options)
          : await dialog.showOpenDialog(options);
        if (result.canceled || result.filePaths.length === 0) {
          return { status: 'canceled' };
        }
        source = result.filePaths[0];
      }

      let raw: unknown;
      try {
        raw = JSON.parse(fs.readFileSync(source, 'utf-8'));
      } catch (err) {
        return {
          status: 'invalid',
          errors: [`Could not read file: ${err instanceof Error ? err.message : err}`],
        };
      }
      const validated = validateEnvelope(raw);
      if (!validated.ok) {
        return { status: 'invalid', errors: validated.errors };
      }

      pendingImport = { envelope: validated.envelope, senderId: event.sender.id };
      const hasConflicts = detectConflicts(validated.envelope, {
        notebookIds: new Set(repos.notebooks.list().map((n) => n.id)),
        noteIds: new Set(allNotes(repos).map((n) => n.id)),
        labelIds: new Set(repos.labels.list().map((l) => l.id)),
        imageIds: new Set(repos.images.list().map((image) => image.id)),
      });
      return { status: 'ready', hasConflicts, counts: envelopeCounts(validated.envelope) };
    },
  );

  ipcMain.handle('transfer:importApply', (event, strategy: unknown): ImportApplyResult => {
    if (strategy !== 'copy' && strategy !== 'replace' && strategy !== 'preserve') {
      throw new Error('Invalid import strategy');
    }
    if (!pendingImport || pendingImport.senderId !== event.sender.id) {
      throw new Error('No pending import');
    }
    const result = applyImportEnvelope(
      repos,
      writer,
      baseDir,
      pendingImport.envelope,
      strategy as ImportStrategy,
    );
    pendingImport = null;
    return result;
  });

  ipcMain.handle('transfer:importCancel', (event) => {
    if (pendingImport?.senderId === event.sender.id) pendingImport = null;
  });
}

export function applyImportEnvelope(
  repos: Repos,
  writer: DebouncedWriter,
  baseDir: string,
  sourceEnvelope: ExportEnvelope,
  strategy: ImportStrategy,
): ImportApplyResult {
  const envelope = strategy === 'copy' ? remapAsCopies(sourceEnvelope) : sourceEnvelope;
  const pristine =
    repos.notebooks.list().length === 1 &&
    allNotes(repos).length === 0 &&
    repos.labels.list().length === 0 &&
    repos.images.list().length === 0;
  const exactRestore =
    strategy === 'preserve' &&
    pristine &&
    envelope.scope?.kind === 'all' &&
    typeof envelope.defaultNotebookId === 'string';
  const priorImageIds: string[] = [];
  if (strategy === 'replace') {
    const existingNotes = new Map(allNotes(repos).map((note) => [note.id, note]));
    for (const note of envelope.notes) {
      const prior = existingNotes.get(note.id);
      if (prior) priorImageIds.push(...referencedImageIds(prior));
    }
  }

  writer.flush();
  beginImportTransaction(baseDir);
  try {
    if (exactRestore) repos.notebooks.replaceAll(envelope.notebooks, envelope.defaultNotebookId!);
    else for (const notebook of envelope.notebooks) repos.notebooks.insert(notebook);
    for (const label of envelope.labels) repos.labels.insert(label);
    for (const image of envelope.images) {
      repos.images.addWithId(
        image.id,
        Buffer.from(image.base64, 'base64'),
        image.mimeType,
        image.fileName,
      );
    }
    for (const note of envelope.notes) repos.notes.insert(note);
    gcImages(repos, priorImageIds);
    writer.flush();
    commitImportTransaction(baseDir);
  } catch (error) {
    writer.discard();
    recoverImportTransaction(baseDir);
    repos.notebooks.init();
    repos.notes.init();
    repos.labels.init();
    repos.images.init();
    throw error;
  }
  return { status: 'done', counts: envelopeCounts(envelope) };
}

function allNotes(repos: Repos): Note[] {
  return [
    ...repos.notes.list({}),
    ...repos.notes.list({ archived: true }),
    ...repos.notes.list({ trashed: true }),
  ];
}
