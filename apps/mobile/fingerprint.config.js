// What the native fingerprint, and so runtimeVersion, may hash (#154).
// An update reaches only builds with the same fingerprint, so anything
// hashed here that is not native code strands updates for no reason.
// - ExpoConfigVersions: expo.version follows semver on every publish
//   (docs/release.md); the default hashes it, so each bump needed a build.
// - PackageJsonScriptsAll: the scripts are dev tooling (no postinstall, no
//   patches); #151 adding publish:update cut build 8 off from updates.
// - ios/ and android/ are prebuild output, gitignored (CNG). eas update
//   already ignores them; `eas fingerprint:compare`, which publish:update
//   uses, did not, so a local prebuild failed the check.
const { SourceSkips } = require('expo/fingerprint');

/** @type {import('expo/fingerprint').Config} */
module.exports = {
  sourceSkips: SourceSkips.ExpoConfigVersions | SourceSkips.PackageJsonScriptsAll,
  ignorePaths: ['ios/**/*', 'android/**/*'],
};
