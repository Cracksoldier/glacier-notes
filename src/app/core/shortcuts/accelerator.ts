const DEFAULT_ACCELERATOR = 'CommandOrControl+Alt+G';

export { DEFAULT_ACCELERATOR };

/** Convert a captured key chord into Electron's portable accelerator syntax. */
export function acceleratorFromEvent(event: KeyboardEvent): string | null {
  if (!(event.ctrlKey || event.metaKey || event.altKey)) return null;

  let key: string | null = null;
  if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3);
  else if (/^Digit[0-9]$/.test(event.code)) key = event.code.slice(5);
  else if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(event.code)) key = event.code;
  if (!key) return null;

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('CommandOrControl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
}

export function displayAccelerator(
  accelerator: string,
  isMac = navigator.platform.startsWith('Mac'),
): string {
  return accelerator
    .replace('CommandOrControl', isMac ? '⌘' : 'Ctrl')
    .replaceAll('+Alt', isMac ? '+⌥' : '+Alt')
    .replaceAll('+Shift', isMac ? '+⇧' : '+Shift');
}
