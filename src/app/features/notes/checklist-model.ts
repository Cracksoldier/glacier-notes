import type { ChecklistItem } from '../../../../electron/api';

export function newItem(text: string, sortOrder: number): ChecklistItem {
  return { id: crypto.randomUUID(), text, checked: false, sortOrder };
}

export function displayOrder(
  items: ChecklistItem[],
  moveCheckedToBottom: boolean,
): ChecklistItem[] {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  if (!moveCheckedToBottom) return sorted;
  return [...sorted.filter((i) => !i.checked), ...sorted.filter((i) => i.checked)];
}

export function resequence(items: ChecklistItem[]): ChecklistItem[] {
  return items.map((item, index) => ({ ...item, sortOrder: index }));
}

// from/to are indices into the displayed list; to is the insertion index after removal.
export function reorderItems(
  items: ChecklistItem[],
  fromIndex: number,
  toIndex: number,
  moveCheckedToBottom: boolean,
): ChecklistItem[] {
  const display = displayOrder(items, moveCheckedToBottom);
  const [moved] = display.splice(fromIndex, 1);
  display.splice(toIndex, 0, moved);
  return resequence(display);
}

export function textToChecklist(content: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const rawLine of content.split('\n')) {
    let line = rawLine.trim().replace(/^(?:[-*+]|\d+\.)\s+/, '');
    let checked = false;
    const task = /^\[( |x|X)\]\s*(.*)$/.exec(line);
    if (task) {
      checked = task[1].toLowerCase() === 'x';
      line = task[2];
    }
    if (!line) continue;
    items.push({ id: crypto.randomUUID(), text: line, checked, sortOrder: items.length });
  }
  return items;
}

export function checklistToText(items: ChecklistItem[]): string {
  return [...items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => `- [${i.checked ? 'x' : ' '}] ${i.text}`)
    .join('\n');
}
