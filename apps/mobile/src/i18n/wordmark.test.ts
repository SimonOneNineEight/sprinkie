import { catalogFor } from './appLanguage';

// The Wordmark is one Latin string in every App Language (CONTEXT.md §
// Language, ratified 2026-09-29): a brand name does not translate. Every
// other catalog entry differs between languages, so this is the one a
// translation pass must leave alone — hence a test rather than a comment.
it('spells the Wordmark Sprinkie in both App Languages', () => {
  expect(catalogFor('zh-TW').signIn.wordmark).toBe('Sprinkie');
  expect(catalogFor('en').signIn.wordmark).toBe('Sprinkie');
});
