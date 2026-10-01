// `training-kit list`: what the numbering picked up, in order, and what it left
// out and why — the first thing to run when a chapter is missing from the deck.

const number = (order) => String(order).padStart(4);
const warning = (name, reason) => `   ⚠  ${name}: ${reason}`;

export function renderList({
  slidesDir,
  workshopsDir,
  chapters,
  ignoredChapters,
  workshops,
  ignoredWorkshops,
  withoutReadme,
}) {
  return [
    `Slides — ${slidesDir}/`,
    ...(chapters.length ? [] : ['   (nothing numbered yet: add 1-introduction.md)']),
    ...chapters.map((chapter) => `${number(chapter.order)}  ${chapter.name}`),
    ...ignoredChapters.map((entry) => warning(entry.name, entry.reason)),
    '',
    `Workshops — ${workshopsDir}/`,
    ...(workshops.length ? [] : ['   (nothing numbered yet: add 1-first-steps/README.md)']),
    ...workshops.map((workshop) => `${number(workshop.order)}  ${workshop.name}  ${workshop.title}`),
    ...ignoredWorkshops.map((entry) => warning(entry.name, entry.reason)),
    ...withoutReadme.map((name) => warning(name, 'no README.md, so no page and no handbook chapter')),
    '',
  ].join('\n');
}
