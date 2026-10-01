// The public API of training-kit. Most projects only need `defineConfig`, in
// training.config.mjs; the rest is what the CLI is built on.

export { CONFIG_FILE, defineConfig, loadConfig, resolveConfig } from './config.mjs';
export { listNumbered, orderOf, slugOf } from './numbering.mjs';
export { DECK_FILE, renderDeck, writeDeck } from './deck.mjs';
export { labelOf, parseReadme, readWorkshops } from './workshops.mjs';
export { writeSite } from './site.mjs';
export { renderHandbook } from './handbook.mjs';
export { build } from './build.mjs';
