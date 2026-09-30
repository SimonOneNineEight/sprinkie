// The published privacy policy and terms (#60). They live on the repo's
// gh-pages branch rather than inside the app: App Store Connect needs a public
// URL for the policy, and Beta App Review expects one from an app that collects
// journal content, so the document has to exist off the phone either way.
//
// zh-Hant only for now, which is what #60 requires. #37 adds the English
// documents; until then an English UI opens a Chinese one, and that is the gap
// to close — the row labels already translate. When the English documents
// exist, these move into the string catalogs, where per-language values live.
const site = 'https://simononenineeight.github.io/sprinkie';

export const legalUrls = {
  privacy: `${site}/privacy/`,
  terms: `${site}/terms/`,
};
