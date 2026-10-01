// The files of build/downloads/, named once: the build writes them, the
// Resources page links them, the participant kit packs them.

export const downloadNames = (slug) => ({
  slides: `${slug}-slides.pdf`,
  handbook: `${slug}-workshops.pdf`,
  solutions: `${slug}-solutions.zip`,
  kit: `${slug}-participants.zip`,
});

/** The two ZIPs of one workshop, relative to build/downloads/: its starter and its solution. */
export const workshopDownloadNames = (workshopSlug) => ({
  starter: `tp/${workshopSlug}-starter.zip`,
  solution: `tp/${workshopSlug}-solution.zip`,
});
