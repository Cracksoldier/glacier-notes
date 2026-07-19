export const NOTE_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

// Guards against stale/unknown stored values: only palette names map to a CSS var.
export function noteColorVar(color: string | undefined): string | null {
  return (NOTE_COLORS as readonly string[]).includes(color ?? '') ? `var(--note-${color})` : null;
}
