import { acceleratorFromEvent, displayAccelerator } from './accelerator';

function key(code: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { code, ...init });
}

describe('acceleratorFromEvent', () => {
  it('normalizes Ctrl and Cmd to a portable accelerator', () => {
    expect(acceleratorFromEvent(key('KeyG', { ctrlKey: true, altKey: true }))).toBe(
      'CommandOrControl+Alt+G',
    );
    expect(acceleratorFromEvent(key('KeyK', { metaKey: true, shiftKey: true }))).toBe(
      'CommandOrControl+Shift+K',
    );
  });

  it('supports digits and function keys', () => {
    expect(acceleratorFromEvent(key('Digit7', { altKey: true }))).toBe('Alt+7');
    expect(acceleratorFromEvent(key('F12', { ctrlKey: true }))).toBe('CommandOrControl+F12');
  });

  it('rejects unmodified and unsupported terminal keys', () => {
    expect(acceleratorFromEvent(key('KeyG'))).toBeNull();
    expect(acceleratorFromEvent(key('Space', { ctrlKey: true }))).toBeNull();
  });
});

describe('displayAccelerator', () => {
  it('uses platform-friendly modifier labels', () => {
    expect(displayAccelerator('CommandOrControl+Alt+G', false)).toBe('Ctrl+Alt+G');
    expect(displayAccelerator('CommandOrControl+Alt+G', true)).toBe('⌘+⌥+G');
  });
});
