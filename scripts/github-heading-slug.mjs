export const githubHeadingSlug = (heading) => heading
  .toLowerCase()
  .trim()
  .replace(/[`*_~]/gu, '')
  .replace(/[^\p{Letter}\p{Number} _-]/gu, '')
  .replace(/\s/gu, '-');
