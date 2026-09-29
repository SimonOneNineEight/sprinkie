import { catalogFor } from './appLanguage';

// The Wordmark is one Latin string in every App Language (CONTEXT.md §
// Language, ratified 2026-09-29): a brand name does not translate. Every
// other catalog entry differs between languages, so this is the one a
// translation pass must leave alone — hence a test rather than a comment.
it('spells the Wordmark Sprinkie in both App Languages', () => {
  expect(catalogFor('zh-TW').signIn.wordmark).toBe('Sprinkie');
  // Against zh-TW's, not the literal again: the invariant is that the two
  // agree, so a translated wordmark fails here even if someone changes both.
  expect(catalogFor('en').signIn.wordmark).toBe(catalogFor('zh-TW').signIn.wordmark);
});
