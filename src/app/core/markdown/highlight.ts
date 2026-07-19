export interface TextSegment {
  text: string;
  match: boolean;
}

// Case-insensitive segmentation of plain text into match / non-match runs.
export function splitText(text: string, query: string): TextSegment[] {
  const q = query.trim();
  if (!q || !text) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const segments: TextSegment[] = [];
  let pos = 0;
  for (let idx = lower.indexOf(needle, pos); idx !== -1; idx = lower.indexOf(needle, pos)) {
    if (idx > pos) segments.push({ text: text.slice(pos, idx), match: false });
    segments.push({ text: text.slice(idx, idx + needle.length), match: true });
    pos = idx + needle.length;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos), match: false });
  return segments.length ? segments : [{ text, match: false }];
}

// Wraps query matches in already-sanitized HTML with <mark>. Operates on text
// nodes only, so existing tags/attributes are never altered and the query
// string itself never becomes markup — safe to run after DOMPurify.
export function highlightHtml(html: string, query: string): string {
  const q = query.trim();
  if (!q) return html;
  const template = document.createElement('template');
  template.innerHTML = html;

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    textNodes.push(node as Text);
  }

  for (const node of textNodes) {
    const segments = splitText(node.data, q);
    if (!segments.some((s) => s.match)) continue;
    const fragment = document.createDocumentFragment();
    for (const segment of segments) {
      if (segment.match) {
        const mark = document.createElement('mark');
        mark.textContent = segment.text;
        fragment.append(mark);
      } else {
        fragment.append(document.createTextNode(segment.text));
      }
    }
    node.replaceWith(fragment);
  }
  return template.innerHTML;
}
