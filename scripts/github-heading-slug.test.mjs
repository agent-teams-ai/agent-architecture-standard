import assert from 'node:assert/strict';
import test from 'node:test';
import { githubHeadingSlug } from './github-heading-slug.mjs';

test('GitHub heading slugs preserve adjacent spaces after punctuation removal', () => {
  assert.equal(githubHeadingSlug('D0 — public naming'), 'd0--public-naming');
});
