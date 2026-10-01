// The public API of training-kit. Most projects only need `defineConfig`, in
// training.config.mjs; the rest is what the CLI is built on.

export { CONFIG_FILE, defineConfig, loadConfig, resolveConfig } from './core/config.mjs';
export { listNumbered, orderOf, slugOf } from './core/numbering.mjs';
export { DECK_FILE, renderDeck, writeDeck } from './deck/deck.mjs';
export { labelOf, parseReadme, readWorkshops } from './core/workshops.mjs';
export { writeSite } from './site/site.mjs';
export { renderHandbook } from './downloads/handbook.mjs';
export { build } from './cli/build.mjs';
