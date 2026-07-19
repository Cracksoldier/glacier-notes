import { TestBed } from '@angular/core/testing';
import { installGlacierApiStub } from '../../testing/glacier-api-stub';
import { QuickNote } from './quick-note';

describe('QuickNote', () => {
  it('saves once from Ctrl+Enter and cancels with Escape', async () => {
    const state = installGlacierApiStub();
    await TestBed.configureTestingModule({ imports: [QuickNote] }).compileComponents();
    const fixture = TestBed.createComponent(QuickNote);
    await fixture.whenStable();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;

    input.value = 'Captured thought';
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
    );
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
    );
    await fixture.whenStable();
    expect(state.quickNotes).toEqual(['Captured thought']);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(state.quickNoteCanceled).toBe(true);
  });
});
