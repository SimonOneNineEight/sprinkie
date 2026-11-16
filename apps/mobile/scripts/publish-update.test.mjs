// The publish guard's own logic, against a stand-in for eas-cli: it publishes
// only when this checkout's fingerprint matches the latest production build,
// and a refusal names the native sources that differ. `pnpm publish:update`
// is how it runs for real; `pnpm test:scripts` runs this file.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { run } from './publish-update.mjs';

const BUILD = { id: 'build-8', appVersion: '0.10.0', appBuildVersion: '8', gitCommitHash: '7f1c3e9625213e1c', fingerprint: { hash: 'aaa' } };

const source = (filePath, hash) => ({ type: 'file', filePath, hash });

// eas-cli prints an environment banner on stdout ahead of its JSON.
const banner = (json) => `Environment variables loaded from "production".\n\n${JSON.stringify(json)}`;

function fakeEas({ builds = [BUILD], local = { hash: 'aaa', sources: [source('package.json', 'p1')] }, built = local } = {}) {
  const calls = [];
  const eas = async (args) => {
    calls.push(args.join(' '));
    if (args[0] === 'build:list') return banner(builds);
    if (args[0] === 'fingerprint:compare') return banner({ fingerprint1: built, fingerprint2: local });
    if (args[0] === 'update') return '';
    throw new Error(`unexpected eas ${args[0]}`);
  };
  return { eas, calls };
}

const quiet = () => {};

test('publishes when the checkout matches the latest production build', async () => {
  const { eas, calls } = fakeEas();
  await run({ eas, message: 'The Filter', log: quiet });
  assert.ok(calls.some((c) => c.startsWith('fingerprint:compare --build-id build-8')));
  assert.ok(calls.includes('update --branch production --environment production --message The Filter --non-interactive'));
});

test('refuses on a mismatch, names what differs, and never publishes', async () => {
  const built = { hash: 'aaa', sources: [source('package.json', 'p1'), source('app.json', 'a1')] };
  const local = { hash: 'bbb', sources: [source('package.json', 'p2'), source('app.json', 'a1'), source('ios/Podfile', 'x')] };
  const { eas, calls } = fakeEas({ built, local });
  const lines = [];
  await assert.rejects(run({ eas, message: 'm', log: (l) => lines.push(l) }), /build 8/);
  assert.ok(!calls.some((c) => c.startsWith('update')));
  const out = lines.join('\n');
  assert.match(out, /changed\s+package\.json/);
  assert.match(out, /added\s+ios\/Podfile/);
  assert.doesNotMatch(out, /app\.json/);
});

test('refuses when there is no finished production build to compare with', async () => {
  const { eas, calls } = fakeEas({ builds: [] });
  await assert.rejects(run({ eas, message: 'm', log: quiet }), /no finished production build/);
  assert.ok(!calls.some((c) => c.startsWith('update')));
});
