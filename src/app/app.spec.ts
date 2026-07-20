import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { installGlacierApiStub } from './testing/glacier-api-stub';

describe('App', () => {
  beforeEach(async () => {
    installGlacierApiStub();
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the app shell', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.header__title')?.textContent).toContain('Glacier Notes');
    expect(compiled.querySelector('.empty-state__title')?.textContent).toContain('No notes yet');
  });

  it('shows startup storage recovery warnings', async () => {
    const stub = installGlacierApiStub();
    stub.startupWarnings.push({
      storageFile: 'notes/bad.json',
      backupPath: '/data/notes/bad.json.corrupt-2026',
      action: 'skipped',
    });
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.open = false;
    };

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.recovery')?.textContent).toContain(
      'notes/bad.json',
    );
    expect(fixture.nativeElement.querySelector('.recovery')?.textContent).toContain(
      'bad.json.corrupt-2026',
    );
  });
});
