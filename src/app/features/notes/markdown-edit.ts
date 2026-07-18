// Pure text-manipulation helpers for the markdown toolbar. All functions take
// the textarea value + selection and return the new value + selection.

export interface EditResult {
  value: string;
  selStart: number;
  selEnd: number;
}

export function wrapSelection(value: string, selStart: number, selEnd: number, marker: string): EditResult {
  const before = value.slice(0, selStart);
  const selected = value.slice(selStart, selEnd);
  const after = value.slice(selEnd);
  if (before.endsWith(marker) && after.startsWith(marker)) {
    return {
      value: before.slice(0, before.length - marker.length) + selected + after.slice(marker.length),
      selStart: selStart - marker.length,
      selEnd: selEnd - marker.length,
    };
  }
  return {
    value: before + marker + selected + marker + after,
    selStart: selStart + marker.length,
    selEnd: selEnd + marker.length,
  };
}

export function prefixLines(value: string, selStart: number, selEnd: number, prefix: string): EditResult {
  const segmentStart = value.lastIndexOf('\n', selStart - 1) + 1;
  const segment = value.slice(segmentStart, selEnd);
  const lines = segment.split('\n');
  const allPrefixed = lines.every((line) => line.startsWith(prefix));
  const updated = lines.map((line) => (allPrefixed ? line.slice(prefix.length) : prefix + line)).join('\n');
  const firstLineDelta = allPrefixed ? -prefix.length : prefix.length;
  return {
    value: value.slice(0, segmentStart) + updated + value.slice(selEnd),
    selStart: Math.max(segmentStart, selStart + firstLineDelta),
    selEnd: selEnd + (updated.length - segment.length),
  };
}

export function orderedList(value: string, selStart: number, selEnd: number): EditResult {
  const segmentStart = value.lastIndexOf('\n', selStart - 1) + 1;
  const segment = value.slice(segmentStart, selEnd);
  const lines = segment.split('\n');
  const numbered = /^\d+\. /;
  const allNumbered = lines.every((line) => numbered.test(line));
  const updated = lines
    .map((line, i) => (allNumbered ? line.replace(numbered, '') : `${i + 1}. ${line}`))
    .join('\n');
  return {
    value: value.slice(0, segmentStart) + updated + value.slice(selEnd),
    selStart: segmentStart,
    selEnd: selEnd + (updated.length - segment.length),
  };
}

export function insertLink(value: string, selStart: number, selEnd: number): EditResult {
  const selected = value.slice(selStart, selEnd) || 'link';
  const placeholder = 'https://';
  const urlStart = selStart + selected.length + 3; // "[" + text + "]("
  return {
    value: `${value.slice(0, selStart)}[${selected}](${placeholder})${value.slice(selEnd)}`,
    selStart: urlStart,
    selEnd: urlStart + placeholder.length,
  };
}

export function toggleCode(value: string, selStart: number, selEnd: number): EditResult {
  const selected = value.slice(selStart, selEnd);
  if (selected.includes('\n')) {
    const inserted = '```\n' + selected + '\n```';
    return {
      value: value.slice(0, selStart) + inserted + value.slice(selEnd),
      selStart: selStart + 4,
      selEnd: selStart + 4 + selected.length,
    };
  }
  return wrapSelection(value, selStart, selEnd, '`');
}
