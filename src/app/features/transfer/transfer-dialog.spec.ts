import { TestBed } from '@angular/core/testing';
import { installGlacierApiStub } from '../../testing/glacier-api-stub';
import { TransferDialog } from './transfer-dialog';

type Stub = ReturnType<typeof installGlacierApiStub>;

describe('TransferDialog', () => {
  let stub: Stub;

  beforeEach(async () => {
    // jsdom does not implement <dialog> showModal/close
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.open = false;
    };
    stub = installGlacierApiStub();
    await TestBed.configureTestingModule({ imports: [TransferDialog] }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(TransferDialog);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function click(fixture: Awaited<ReturnType<typeof render>>, selector: string): void {
    const el = fixture.nativeElement.querySelector(selector) as HTMLElement | null;
    if (!el) throw new Error(`No element matches ${selector}`);
    el.click();
  }

  async function settle(fixture: Awaited<ReturnType<typeof render>>): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('exports everything by default', async () => {
    const fixture = await render();
    click(fixture, '.transfer__actions .transfer__button--primary');
    await settle(fixture);
    expect(stub.transfer.exportCalls).toEqual([{ kind: 'all' }]);
    expect(fixture.nativeElement.querySelector('.transfer__saved')).toBeTruthy();
  });

  it('applies a conflict-free import immediately while preserving ids', async () => {
    stub.transfer.inspectResult = {
      status: 'ready',
      hasConflicts: false,
      counts: { notebooks: 1, notes: 2, labels: 0, images: 0 },
    };
    const fixture = await render();
    const buttons = fixture.nativeElement.querySelectorAll('.transfer__button--primary');
    (buttons[1] as HTMLElement).click();
    await settle(fixture);
    expect(stub.transfer.appliedStrategies).toEqual(['preserve']);
    expect(fixture.nativeElement.textContent).toContain('Import complete');
  });

  it('shows the conflict step and applies the chosen strategy', async () => {
    stub.transfer.inspectResult = {
      status: 'ready',
      hasConflicts: true,
      counts: { notebooks: 1, notes: 1, labels: 0, images: 0 },
    };
    const fixture = await render();
    const buttons = fixture.nativeElement.querySelectorAll('.transfer__button--primary');
    (buttons[1] as HTMLElement).click();
    await settle(fixture);
    expect(stub.transfer.appliedStrategies).toEqual([]);
    const choices = fixture.nativeElement.querySelectorAll('.transfer__choice');
    expect(choices).toHaveLength(2);
    (choices[1] as HTMLElement).click();
    await settle(fixture);
    expect(stub.transfer.appliedStrategies).toEqual(['replace']);
  });

  it('cancels a pending import from the conflict step', async () => {
    stub.transfer.inspectResult = {
      status: 'ready',
      hasConflicts: true,
      counts: { notebooks: 0, notes: 1, labels: 0, images: 0 },
    };
    const fixture = await render();
    const buttons = fixture.nativeElement.querySelectorAll('.transfer__button--primary');
    (buttons[1] as HTMLElement).click();
    await settle(fixture);
    click(fixture, '.transfer__actions .transfer__button:not(.transfer__button--primary)');
    await settle(fixture);
    expect(stub.transfer.importCanceled).toBe(true);
    expect(fixture.nativeElement.querySelector('.transfer__choice')).toBeNull();
  });

  it('shows validation errors', async () => {
    stub.transfer.inspectResult = { status: 'invalid', errors: ['bad format'] };
    const fixture = await render();
    const buttons = fixture.nativeElement.querySelectorAll('.transfer__button--primary');
    (buttons[1] as HTMLElement).click();
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('.transfer__errors')?.textContent).toContain(
      'bad format',
    );
  });
});
