// The case ids in docs/manual-tests.md are cited by issues, so they hold
// three promises: each id names one case, each **[auto]** tag is backed by a
// row in Automated coverage (and each row by a tag), and an id never goes
// away, so it is never reused. RM.40–RM.43 were renumbered after being
// pushed and RM.40 then reused, and RM.48 carried an [auto] it didn't earn
// (#135 retro). `pnpm test:scripts` runs this file.
//
// The never-removed check reads the base version from git: MANUAL_TESTS_BASE
// (default origin/main). Without that ref it is skipped with a note.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const DOC = 'docs/manual-tests.md';
const repoRoot = new URL('../../../', import.meta.url);
const COVERAGE = '## Automated coverage';
const ROW_ID = /^\| ([A-Z][A-Z0-9]*\.\d+) \|/;

/** The cases above Automated coverage, and the ids of the rows in it. */
function parse(markdown) {
  const at = markdown.indexOf(COVERAGE);
  assert.notEqual(at, -1, `${DOC} has no "${COVERAGE}" section`);
  const rowIds = (text) =>
    text.split('\n').flatMap((line) => {
      const m = line.match(ROW_ID);
      return m ? [{ id: m[1], line }] : [];
    });
  const cases = rowIds(markdown.slice(0, at)).map(({ id, line }) => ({ id, auto: line.includes('**[auto]**') }));
  const covered = rowIds(markdown.slice(at)).map(({ id }) => id);
  return { cases, covered };
}

const duplicates = (ids) => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];

const current = parse(readFileSync(new URL(DOC, repoRoot), 'utf8'));

test('every case id names one case', () => {
  assert.deepEqual(duplicates(current.cases.map((c) => c.id)), []);
});

test('every Automated coverage row names one case', () => {
  assert.deepEqual(duplicates(current.covered), []);
});

test('every [auto] case has an Automated coverage row', () => {
  const covered = new Set(current.covered);
  assert.deepEqual(current.cases.filter((c) => c.auto && !covered.has(c.id)).map((c) => c.id), []);
});

test('every Automated coverage row names an [auto] case', () => {
  const auto = new Set(current.cases.filter((c) => c.auto).map((c) => c.id));
  assert.deepEqual(current.covered.filter((id) => !auto.has(id)), []);
});

test('no case id on the base branch has gone away', (t) => {
  const base = process.env.MANUAL_TESTS_BASE || 'origin/main';
  let markdown;
  try {
    markdown = execFileSync('git', ['show', `${base}:${DOC}`], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    t.diagnostic(`${base} does not resolve here, so ids are not compared against it`);
    t.skip(`${base} not available`);
    return;
  }
  const ids = new Set(current.cases.map((c) => c.id));
  assert.deepEqual(parse(markdown).cases.map((c) => c.id).filter((id) => !ids.has(id)), []);
});
