import { TestBed } from '@angular/core/testing';
import { installGlacierApiStub } from '../../testing/glacier-api-stub';
import { SettingsStore } from './settings-store';

describe('SettingsStore', () => {
  let state: ReturnType<typeof installGlacierApiStub>;
  let store: SettingsStore;

  beforeEach(() => {
    state = installGlacierApiStub();
    store = TestBed.inject(SettingsStore);
  });

  it('loads persisted settings on init', async () => {
    state.settings.theme = 'light';
    state.settings.language = 'de';
    state.settings.moveCheckedToBottom = true;
    state.settings.trashAutoPurgeDays = 7;

    await store.init();

    expect(store.theme()).toBe('light');
    expect(store.language()).toBe('de');
    expect(store.moveCheckedToBottom()).toBe(true);
    expect(store.trashAutoPurgeDays()).toBe(7);
  });

  it('persists theme changes', async () => {
    await store.setTheme('light');
    expect(store.theme()).toBe('light');
    expect(state.settings.theme).toBe('light');
  });

  it('persists language changes', async () => {
    await store.setLanguage('de');
    expect(store.language()).toBe('de');
    expect(state.settings.language).toBe('de');
  });

  it('persists trash auto-purge days', async () => {
    await store.setTrashAutoPurgeDays(0);
    expect(store.trashAutoPurgeDays()).toBe(0);
    expect(state.settings.trashAutoPurgeDays).toBe(0);
  });
});
