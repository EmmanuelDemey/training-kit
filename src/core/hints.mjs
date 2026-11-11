// Hint blocks of a workshop README: help a learner opens only when stuck.
//
//   :::hint[Stuck on the router?]
//   Use `useRoute()`.
//   :::
//
// The site folds them into a <details>; the printed handbook leaves them out,
// since paper cannot hide an answer.

const OPEN = /^:::hint(?:\[(.*)\])?\s*$/;
const CLOSE = /^:::\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})/;

/** Replaces each hint block outside code fences with `onHint({ title, lines })`; keeps every other line. */
function mapHints(markdown, onHint) {
  const out = [];
  let fence = null;
  let hint = null;

  for (const line of markdown.split('\n')) {
    if (hint) {
      if (CLOSE.test(line)) {
        out.push(...onHint(hint));
        hint = null;
      } else {
        hint.lines.push(line);
      }
      continue;
    }
    const marker = line.match(FENCE)?.[1];
    if (marker && (!fence || marker.startsWith(fence))) fence = fence ? null : marker;
    const open = !fence && line.match(OPEN);
    if (open) hint = { title: open[1]?.trim() || 'Hint', lines: [] };
    else out.push(line);
  }
  // An unclosed hint keeps its text: silently losing instructions is worse.
  if (hint) out.push(`:::hint[${hint.title}]`, ...hint.lines);
  return out.join('\n');
}

const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** Each hint as a collapsed <details>; blank lines around its body so Markdown still renders inside. */
export const hintsToDetails = (markdown) =>
  mapHints(markdown, ({ title, lines }) => [
    '<details class="hint">',
    `<summary>${escapeHtml(title)}</summary>`,
    '',
    ...lines,
    '',
    '</details>',
  ]);

/** The Markdown without its hints. */
export const stripHints = (markdown) => mapHints(markdown, () => []).replace(/\n{3,}/g, '\n\n');
