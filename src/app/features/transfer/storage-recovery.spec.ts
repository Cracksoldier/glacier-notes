import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  DebouncedWriter,
  readJsonFile,
  StorageRecoveryWarning,
} from '../../../../electron/storage/json-store';
import { NoteRepo } from '../../../../electron/storage/note-repo';
import { NotebookRepo } from '../../../../electron/storage/notebook-repo';

describe('storage recovery', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glacier-recovery-'));
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  it('returns undefined for a missing file without reporting recovery', () => {
    const warnings: unknown[] = [];
    const result = readJsonFile(path.join(baseDir, 'missing.json'), {
      action: 'reset',
      onCorrupt: (warning) => warnings.push(warning),
    });

    expect(result).toBeUndefined();
    expect(warnings).toEqual([]);
  });

  it('loads valid JSON without changing the source file', () => {
    const file = path.join(baseDir, 'settings.json');
    fs.writeFileSync(file, '{"theme":"dark"}', 'utf-8');

    expect(readJsonFile(file, { action: 'reset' })).toEqual({ theme: 'dark' });
    expect(fs.readFileSync(file, 'utf-8')).toBe('{"theme":"dark"}');
  });

  it('quarantines malformed JSON byte-for-byte and reports its backup path', () => {
    const file = path.join(baseDir, 'labels.json');
    const source = '{broken';
    fs.writeFileSync(file, source, 'utf-8');
    const warnings: StorageRecoveryWarning[] = [];

    const result = readJsonFile(file, {
      action: 'reset',
      onCorrupt: (warning) => warnings.push(warning),
    });

    expect(result).toBeUndefined();
    expect(fs.existsSync(file)).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].storageFile).toBe('labels.json');
    expect(warnings[0].action).toBe('reset');
    expect(fs.readFileSync(warnings[0].backupPath, 'utf-8')).toBe(source);
  });

  it('skips only a malformed note while retaining valid notes', () => {
    const notesDir = path.join(baseDir, 'notes');
    fs.mkdirSync(notesDir);
    fs.writeFileSync(path.join(notesDir, 'bad.json'), '{broken', 'utf-8');
    fs.writeFileSync(
      path.join(notesDir, 'good.json'),
      JSON.stringify({
        schemaVersion: 1,
        id: 'good',
        notebookId: 'nb',
        type: 'text',
        title: 'Kept',
        content: '',
        imageIds: [],
        pinned: false,
        archived: false,
        labels: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      'utf-8',
    );
    const warnings: Array<{ storageFile: string; action: string }> = [];
    const repo = new NoteRepo(baseDir, new DebouncedWriter(), (warning) => warnings.push(warning));

    repo.init();

    expect(repo.list().map((note) => note.title)).toEqual(['Kept']);
    expect(warnings).toEqual([
      expect.objectContaining({ storageFile: path.join('notes', 'bad.json'), action: 'skipped' }),
    ]);
  });

  it('creates a safe default notebook after quarantining malformed metadata', () => {
    fs.writeFileSync(path.join(baseDir, 'notebooks.json'), '{broken', 'utf-8');
    const warnings: Array<{ storageFile: string; action: string }> = [];
    const repo = new NotebookRepo(baseDir, new DebouncedWriter(), (warning) =>
      warnings.push(warning),
    );

    repo.init();

    expect(repo.list()).toHaveLength(1);
    expect(repo.list()[0].name).toBe('Notes');
    expect(warnings).toEqual([
      expect.objectContaining({ storageFile: 'notebooks.json', action: 'reset' }),
    ]);
  });
});
