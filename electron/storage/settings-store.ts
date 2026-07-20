import * as path from 'path';
import { readJsonFile, StorageRecoveryWarning, writeJsonAtomic } from './json-store';
import { defaultSettings, SCHEMA_VERSION, Settings } from './models';

type StoredSettings = Settings & { schemaVersion: number };

export class SettingsStore {
  private readonly file: string;
  private settings: Settings;

  constructor(
    baseDir: string,
    osLocale: string,
    private readonly onCorrupt?: (warning: StorageRecoveryWarning) => void,
  ) {
    this.file = path.join(baseDir, 'settings.json');
    this.settings = defaultSettings(osLocale);
  }

  init(): void {
    const raw = readJsonFile<StoredSettings>(this.file, {
      action: 'reset',
      onCorrupt: this.onCorrupt,
    });
    if (raw) {
      const { schemaVersion: _v, ...stored } = raw;
      this.settings = { ...this.settings, ...stored };
    }
  }

  get(): Settings {
    return { ...this.settings };
  }

  set(patch: Partial<Settings>): Settings {
    this.settings = { ...this.settings, ...patch };
    writeJsonAtomic(this.file, { schemaVersion: SCHEMA_VERSION, ...this.settings });
    return this.get();
  }
}
