import { TestBed } from '@angular/core/testing';
import { installGlacierApiStub } from '../../testing/glacier-api-stub';
import { SettingsStore } from '../store/settings-store';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  let settings: SettingsStore;
  let i18n: I18nService;

  beforeEach(() => {
    installGlacierApiStub();
    settings = TestBed.inject(SettingsStore);
    i18n = TestBed.inject(I18nService);
  });

  it('translates in English by default', () => {
    expect(i18n.t('sidebar.notebooks')).toBe('Notebooks');
  });

  it('switches to German when the language setting changes', async () => {
    await settings.setLanguage('de');
    expect(i18n.t('sidebar.notebooks')).toBe('Notizbücher');
    expect(i18n.t('sidebar.trash')).toBe('Papierkorb');
  });

  it('interpolates parameters', () => {
    expect(i18n.t('card.more', { count: 3 })).toBe('+3 more');
    expect(i18n.t('notebook.deleteTitle', { name: 'Work' })).toBe('Delete notebook "Work"?');
  });

  it('formats dates per locale', async () => {
    const iso = '2026-07-04T15:30:00.000Z';
    const enDate = i18n.formatDate(iso);
    await settings.setLanguage('de');
    const deDate = i18n.formatDate(iso);
    expect(enDate).toContain('Jul');
    expect(deDate).toMatch(/04\.07\.2026/);
    expect(enDate).not.toBe(deDate);
  });
});
