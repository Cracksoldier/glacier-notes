import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
}));

import { applyImportEnvelope } from '../../../../electron/export-import';
import {
  beginImportTransaction,
  recoverImportTransaction,
} from '../../../../electron/import-transaction';
import { DebouncedWriter } from '../../../../electron/storage/json-store';
import { ImageStore } from '../../../../electron/storage/image-store';
import { LabelRepo } from '../../../../electron/storage/label-repo';
import type { Note } from '../../../../electron/storage/models';
import { NotebookRepo } from '../../../../electron/storage/notebook-repo';
import { NoteRepo } from '../../../../electron/storage/note-repo';
import { SettingsStore } from '../../../../electron/storage/settings-store';
import { collectExport, validateEnvelope } from '../../../../electron/transfer-core';

const NB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const NOTE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const LABEL = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const IMAGE = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
const now = '2026-07-19T00:00:00.000Z';

function createRepos(baseDir: string) {
  const writer = new DebouncedWriter(60_000);
  const notes = new NoteRepo(baseDir, writer);
  const repos = {
    notebooks: new NotebookRepo(baseDir, writer),
    notes,
    labels: new LabelRepo(baseDir, writer, notes),
    images: new ImageStore(baseDir),
    settings: new SettingsStore(baseDir, 'en'),
  };
  repos.notebooks.init();
  repos.notes.init();
  repos.labels.init();
  repos.images.init();
  repos.settings.init();
  return { repos, writer };
}

describe('M8 repository round trip', () => {
  it('restores an all-data export exactly into pristine storage', () => {
    const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glacier-source-'));
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glacier-target-'));
    try {
      const source = createRepos(sourceDir);
      source.repos.notebooks.replaceAll(
        [{ id: NB, name: 'Notes', createdAt: now, updatedAt: now, sortOrder: 0 }],
        NB,
      );
      source.repos.labels.insert({ id: LABEL, name: 'Work' });
      source.repos.images.addWithId(IMAGE, new Uint8Array([1, 2, 3]), 'image/png', 'chart.png');
      const note: Note = {
        id: NOTE,
        notebookId: NB,
        type: 'text',
        title: 'Backup',
        content: `![chart](glacier-img://${IMAGE})`,
        imageIds: [IMAGE],
        pinned: true,
        archived: false,
        labels: [LABEL],
        createdAt: now,
        updatedAt: now,
      };
      source.repos.notes.insert(note);
      source.writer.flush();

      const envelope = collectExport(
        { kind: 'all' },
        {
          notebooks: source.repos.notebooks.list(),
          notes: [note],
          labels: source.repos.labels.list(),
          defaultNotebookId: NB,
          readImage: (id) => {
            const info = source.repos.images.getFileInfo(id);
            return {
              mimeType: info.mimeType,
              fileName: info.fileName,
              base64: fs.readFileSync(info.path).toString('base64'),
            };
          },
        },
      );
      const validated = validateEnvelope(JSON.parse(JSON.stringify(envelope)));
      expect(validated.ok).toBe(true);
      if (!validated.ok) return;

      const target = createRepos(targetDir);
      applyImportEnvelope(target.repos, target.writer, targetDir, validated.envelope, 'preserve');
      expect(target.repos.notebooks.list()).toEqual(envelope.notebooks);
      expect(target.repos.notebooks.getDefaultId()).toBe(NB);
      expect(target.repos.notes.get(NOTE)).toEqual(note);
      expect(target.repos.labels.list()).toEqual(envelope.labels);
      expect(fs.readFileSync(target.repos.images.getFileInfo(IMAGE).path)).toEqual(
        Buffer.from([1, 2, 3]),
      );
    } finally {
      fs.rmSync(sourceDir, { recursive: true, force: true });
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  });

  it('restores managed files from an interrupted transaction', () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glacier-transaction-'));
    try {
      fs.writeFileSync(path.join(baseDir, 'notebooks.json'), 'before');
      beginImportTransaction(baseDir);
      fs.writeFileSync(path.join(baseDir, 'notebooks.json'), 'after');
      expect(recoverImportTransaction(baseDir)).toBe(true);
      expect(fs.readFileSync(path.join(baseDir, 'notebooks.json'), 'utf-8')).toBe('before');
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });

  it('rolls back repositories when application fails midway', () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glacier-rollback-'));
    try {
      const target = createRepos(baseDir);
      const generatedDefault = target.repos.notebooks.getDefaultId();
      vi.spyOn(target.repos.labels, 'insert').mockImplementation(() => {
        throw new Error('injected failure');
      });
      expect(() =>
        applyImportEnvelope(
          target.repos,
          target.writer,
          baseDir,
          {
            format: 'glacier-notes-export',
            schemaVersion: 1,
            exportedAt: now,
            scope: { kind: 'all' },
            defaultNotebookId: NB,
            notebooks: [{ id: NB, name: 'Imported', createdAt: now, updatedAt: now, sortOrder: 0 }],
            notes: [],
            labels: [{ id: LABEL, name: 'Failure' }],
            images: [],
          },
          'preserve',
        ),
      ).toThrow('injected failure');
      expect(target.repos.notebooks.getDefaultId()).toBe(generatedDefault);
      expect(target.repos.notebooks.list()).toHaveLength(1);
      expect(target.repos.labels.list()).toEqual([]);
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });

  it('rejects unsafe repository ids independently of envelope validation', () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glacier-id-'));
    try {
      const { repos } = createRepos(baseDir);
      expect(() => repos.notes.insert({ id: '../../escape' } as Note)).toThrow('Invalid entity id');
      expect(() =>
        repos.images.addWithId('../../escape', new Uint8Array([1]), 'image/png'),
      ).toThrow('Invalid entity id');
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });
});
