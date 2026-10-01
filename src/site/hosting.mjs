// The two files of build/ that tell the host (Netlify, or anything that reads
// the same format) how to serve the training.

/**
 * A Slidev deck is a single-page app with history routing: /slides/12 is a
 * client-side route, not a file. Without this, a reload on slide 12 is a 404.
 * The rule is not forced, so real files (assets, chunks) still win.
 */
export function renderRedirects() {
  return '/slides/*  /slides/index.html  200\n';
}

/**
 * The online editor runs Node.js on SharedArrayBuffer, which the browser only
 * grants to a cross-origin isolated page. Scoped to the workshop pages, the only
 * ones that embed it: the headers make a page refuse any cross-origin resource
 * that does not opt in — the deck's web fonts, say — and no other page needs
 * that risk.
 */
export function renderHeaders(config) {
  if (!config.playground) return null;
  return '/workshops/*\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp\n';
}
