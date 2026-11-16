// The over-the-air publish (#151). An update reaches only builds whose native
// fingerprint matches the one computed here, and a mismatch errors nowhere:
// the update lands on no phone. So before `eas update`, compare this checkout
// with the latest finished production iOS build and refuse, naming the native
// sources that differ, unless they match. A refusal means the change needs
// `eas build`, not an update. From apps/mobile:
//   pnpm publish:update                    # message: the last commit's subject
//   pnpm publish:update "<message>"
//
// Exit codes: 0 published, 1 refused or failed.

import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// eas-cli prints an environment banner on stdout ahead of its --json output.
function parseJson(stdout) {
  return JSON.parse(stdout.slice(stdout.search(/[[{]/)));
}

function diffSources(built, local) {
  const key = (s) => `${s.type}:${s.filePath}`;
  const before = new Map(built.sources.map((s) => [key(s), s]));
  const after = new Map(local.sources.map((s) => [key(s), s]));
  const lines = [];
  for (const [k, s] of after) {
    if (!before.has(k)) lines.push(`  added    ${s.filePath}`);
    else if (before.get(k).hash !== s.hash) lines.push(`  changed  ${s.filePath}`);
  }
  for (const [k, s] of before) if (!after.has(k)) lines.push(`  removed  ${s.filePath}`);
  return lines;
}

export async function run({ eas, message, log }) {
  const [build] = parseJson(
    await eas(['build:list', '--platform', 'ios', '--buildProfile', 'production', '--status', 'finished', '--limit', '1', '--json', '--non-interactive']),
  );
  if (!build) throw new Error('refused: no finished production build to compare with');
  const name = `build ${build.appBuildVersion} (${build.appVersion}, ${build.gitCommitHash?.slice(0, 7)})`;

  const { fingerprint1: built, fingerprint2: local } = parseJson(
    await eas(['fingerprint:compare', '--build-id', build.id, '--environment', 'production', '--json', '--non-interactive']),
  );
  if (built.hash !== local.hash) {
    log(`This checkout's native fingerprint differs from ${name}:`);
    for (const line of diffSources(built, local)) log(line);
    throw new Error(`refused: an update would reach no phone on ${name}; this change needs eas build`);
  }

  log(`Fingerprint matches ${name}. Publishing "${message}".`);
  await eas(['update', '--branch', 'production', '--environment', 'production', '--message', message, '--non-interactive'], { stream: true });
}

function eas(args, { stream = false } = {}) {
  const cmd = ['dlx', 'eas-cli@latest', ...args];
  if (stream) {
    const { status } = spawnSync('pnpm', cmd, { stdio: 'inherit' });
    if (status !== 0) throw new Error(`eas ${args[0]} exited ${status}`);
    return '';
  }
  return execFileSync('pnpm', cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 });
}

async function main() {
  const message = process.argv.slice(2).join(' ') || execFileSync('git', ['log', '-1', '--format=%s'], { encoding: 'utf8' }).trim();
  try {
    await run({ eas, message, log: console.log });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
