// The workshops as one printable PDF handbook: a cover, the contents, the
// workshops README, then one workshop per page. The source of truth stays the
// READMEs the learners work from; this only lays them out for print.

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { marked } from 'marked';

const escape = (text) => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const anchorOf = (workshop) => `tp-${workshop.slug}`;

marked.setOptions({ gfm: true, breaks: false });

const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font: 10.5pt/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #1b1b1f;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3, h4 { line-height: 1.25; break-after: avoid; margin: 1.4em 0 0.5em; }
  h1 { font-size: 19pt; }
  h2 { font-size: 13pt; border-bottom: 1px solid #e3e3e8; padding-bottom: 0.25em; }
  h3 { font-size: 11.5pt; }
  p, ul, ol, table, pre, blockquote { break-inside: avoid; }
  ul, ol { padding-left: 1.4em; }
  li { margin: 0.25em 0; }
  a { color: #1f5fbf; text-decoration: none; }
  code {
    font-family: ui-monospace, "SFMono-Regular", "Cascadia Code", Consolas, monospace;
    font-size: 0.88em;
    background: #f2f2f6;
    border-radius: 3px;
    padding: 0.1em 0.32em;
  }
  pre {
    background: #f7f7fa;
    border: 1px solid #e6e6ec;
    border-left: 3px solid #b9c4d4;
    border-radius: 4px;
    padding: 0.7em 0.9em;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  pre code { background: none; padding: 0; font-size: 0.85em; }
  blockquote { margin: 1em 0; padding: 0.1em 1em; border-left: 3px solid #b9c4d4; color: #4a4a55; font-style: italic; }
  table { border-collapse: collapse; width: 100%; font-size: 0.92em; margin: 1em 0; }
  th, td { border: 1px solid #e0e0e6; padding: 0.4em 0.6em; text-align: left; vertical-align: top; }
  th { background: #f4f4f8; }
  hr { border: none; border-top: 1px solid #e3e3e8; margin: 1.6em 0; }

  .page { padding: 0 4mm; }
  .cover { break-after: page; padding-top: 55mm; text-align: center; }
  .cover .kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 9pt; color: #6b6b78; }
  .cover h1 { font-size: 34pt; margin: 0.35em 0 0.15em; }
  .cover .sub { font-size: 12pt; color: #4a4a55; }
  .cover .meta { margin-top: 14mm; font-size: 9.5pt; color: #6b6b78; }

  .toc { break-after: page; }
  .toc ol { list-style: none; padding: 0; }
  .toc a { display: flex; gap: 0.7em; align-items: baseline; padding: 0.42em 0; border-bottom: 1px dotted #dedee4; color: inherit; }
  .toc .n { width: 1.6em; color: #8a8a96; font-variant-numeric: tabular-nums; }
  .toc .t { flex: 1; }
  .toc code { color: #6b6b78; background: none; }

  .intro h1 { font-size: 16pt; }
  .workshop { break-before: page; }
  .workshop > h1 { margin-top: 0; padding-bottom: 0.3em; border-bottom: 2px solid #1b1b1f; }
  .workshop > .folder { margin: 0.4em 0 1.4em; font-family: ui-monospace, Consolas, monospace; font-size: 9pt; color: #6b6b78; }
`;

/** The handbook as one HTML document, ready to print. */
export function renderHandbook({ title, author, workshops, overview }) {
  const contents = workshops
    .map(
      (workshop) =>
        `<li><a href="#${anchorOf(workshop)}"><span class="n">${workshop.order}</span>` +
        `<span class="t">${escape(workshop.title)}</span><code>${escape(workshop.name)}</code></a></li>`,
    )
    .join('\n');

  const pages = workshops
    .map(
      (workshop) => `<section class="page workshop" id="${anchorOf(workshop)}">
    <h1>${escape(workshop.title)}</h1>
    <p class="folder">${escape(workshop.name)}/</p>
    ${marked.parse(workshop.body)}
  </section>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escape(title)} — workshops</title>
<style>${STYLE}</style>
</head>
<body>
  <section class="cover">
    <div class="kicker">Hands-on workshops</div>
    <h1>${escape(title)}</h1>
    <div class="sub">Workshop handbook — ${workshops.length} workshops</div>
    ${author ? `<div class="meta">${escape(author)}</div>` : ''}
  </section>

  <section class="page toc">
    <h1>Contents</h1>
    <ol>${contents}</ol>
  </section>

  ${overview ? `<section class="page intro"><h1>About these workshops</h1>${marked.parse(overview.body)}</section>` : ''}

  ${pages}
</body>
</html>`;
}

/** Prints the handbook to `outFile` with Chromium. */
export async function printHandbook({ html, title, outFile, executablePath }) {
  const { chromium } = await import('playwright-chromium');
  await mkdir(dirname(outFile), { recursive: true });

  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: outFile,
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;padding:0 14mm;font:8pt system-ui,sans-serif;color:#8a8a96;display:flex;justify-content:space-between;">
        <span>${escape(title)} — workshops</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
    });
  } finally {
    await browser.close();
  }
}
