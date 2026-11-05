// The smoke run's own logic, against an in-memory stand-in for the API: which
// accounts it refuses, that it cleans up after itself and after an earlier
// run that died halfway, and that a failure names its check. The checks
// themselves only mean anything against a real revision; `pnpm smoke:api`
// is how they run. `pnpm test:scripts` runs this file.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SMOKE_COLORS, SMOKE_YEAR, run, smokeContent } from './smoke-api.mjs';

// Just enough of the API for run() itself: the routes its guard and sweep
// use, plus creates for the stand-in checks below.
function fakeApi({ entries = [], categories = [], colors = [] } = {}) {
  const state = { entries: [...entries], categories: [...categories], colors: [...colors], calls: [] };
  let next = 1;
  const reply = (status, body) => ({ status, body });
  state.api = async (method, path, body) => {
    state.calls.push(`${method} ${path}`);
    const [route, query = ''] = path.split('?');
    let m;
    if (method === 'GET' && route === '/health') return reply(200, { status: 'ok', schemaVersion: 1, revision: 'fake-00001' });
    if (method === 'POST' && route === '/me') return reply(200, { categories: state.categories });
    if (method === 'GET' && (m = route.match(/^\/years\/(\d{4})$/))) {
      const held = state.entries.filter((e) => e.date.startsWith(m[1]));
      const days = [...new Set(held.map((e) => e.date))].map((date) => ({ date, categoryId: 'c' }));
      return reply(200, { days, totalEntries: held.length });
    }
    if (method === 'GET' && route === '/entries') {
      const date = new URLSearchParams(query).get('date');
      return reply(200, { entries: state.entries.filter((e) => e.date === date) });
    }
    if (method === 'POST' && route === '/entries') {
      const entry = { id: `e${next++}`, ...body };
      state.entries.push(entry);
      return reply(201, entry);
    }
    if (method === 'DELETE' && (m = route.match(/^\/entries\/(.+)$/))) {
      state.entries = state.entries.filter((e) => e.id !== m[1]);
      return reply(204);
    }
    if (method === 'POST' && route === '/categories') {
      const category = { id: `c${next++}`, ...body };
      state.categories.push(category);
      return reply(201, category);
    }
    if (method === 'DELETE' && (m = route.match(/^\/categories\/(.+)$/))) {
      if (state.categories.some((c) => c.parentId === m[1])) return reply(409, { message: 'category has children' });
      if (state.entries.some((e) => e.categoryId === m[1])) return reply(409, { message: 'category in use' });
      state.categories = state.categories.filter((c) => c.id !== m[1]);
      return reply(204);
    }
    if (method === 'GET' && route === '/color-recents') return reply(200, { colors: state.colors });
    if (method === 'DELETE' && (m = route.match(/^\/color-recents\/(.+)$/))) {
      state.colors = state.colors.filter((c) => c !== `#${m[1]}`);
      return reply(204);
    }
    throw new Error(`fake API has no route for ${method} ${path}`);
  };
  return state;
}

const starter = { id: 's1', name: '工作', color: '#4A90D9', icon: 'briefcase', position: 1 };

function capture() {
  const lines = [];
  return { lines, log: (line) => lines.push(line) };
}

// A stand-in check that leaves an Entry, a Category and a saved colour behind
// before it gets the chance to clean up, the way a real one does.
const makesThings = {
  name: 'makes things',
  async run({ api, category }) {
    const made = await category('a thing');
    await api('POST', '/entries', { date: `${SMOKE_YEAR}-02-03`, categoryId: made.id, content: smokeContent('x') });
    return 'made an Entry';
  },
};

test('refuses an account holding an Entry it did not make, and touches nothing', async () => {
  const fake = fakeApi({ categories: [starter], entries: [{ id: 'mine', date: '2026-10-01', categoryId: 's1', content: '{"v":1,"title":"週會"}' }] });
  const { lines, log } = capture();
  let ran = false;
  const code = await run({ api: fake.api, log, checks: [{ name: 'x', run: async () => (ran = true) }] });
  assert.equal(code, 2);
  assert.equal(ran, false);
  assert.match(lines.join('\n'), /Refusing.*1 Entry it did not make.*2026/);
  assert.equal(fake.entries.length, 1);
  assert.deepEqual(fake.calls.filter((c) => !c.startsWith('GET') && c !== 'POST /me'), []);
});

test('refuses an unmarked Entry even inside the smoke year', async () => {
  const fake = fakeApi({ entries: [{ id: 'mine', date: `${SMOKE_YEAR}-05-05`, categoryId: 's1', content: '{"v":1,"title":"x"}' }] });
  const { lines, log } = capture();
  assert.equal(await run({ api: fake.api, log, checks: [] }), 2);
  assert.match(lines.join('\n'), /Refusing/);
  assert.equal(fake.entries.length, 1);
});

test('sweeps what a run that died halfway left behind, before checking', async () => {
  const fake = fakeApi({
    categories: [
      starter,
      { id: 'p', name: 'smoke parent', color: SMOKE_COLORS[0], position: 6 },
      { id: 'k', name: 'smoke child', color: SMOKE_COLORS[0], parentId: 'p', position: 1 },
    ],
    entries: [{ id: 'left', date: `${SMOKE_YEAR}-03-05`, categoryId: 'p', subcategoryId: 'k', content: smokeContent('left') }],
    colors: [SMOKE_COLORS[1], '#123456'],
  });
  const { lines, log } = capture();
  let seen;
  const look = { name: 'look', run: async () => (seen = { entries: fake.entries.length, categories: fake.categories.length }) && 'looked' };
  assert.equal(await run({ api: fake.api, log, checks: [look] }), 0);
  assert.deepEqual(seen, { entries: 0, categories: 1 });
  assert.match(lines.join('\n'), /Swept 1 Entry, 2 Categories and 1 saved colour/);
  // A saved colour the smoke run did not use is not its to forget.
  assert.deepEqual(fake.colors, ['#123456']);
});

test('names a failing check, still runs the rest, and cleans up after both', async () => {
  const fake = fakeApi({ categories: [starter] });
  const { lines, log } = capture();
  const broken = {
    name: 'an Entry moves to another date (EF.33)',
    async run(ctx) {
      await makesThings.run(ctx);
      throw new Error('PATCH /entries/e9 answered 200 but the Entry is still on 2000-04-10');
    },
  };
  const code = await run({ api: fake.api, log, checks: [broken, makesThings] });
  assert.equal(code, 1);
  const out = lines.join('\n');
  assert.match(out, /^FAIL {2}an Entry moves to another date \(EF\.33\) — PATCH \/entries\/e9 answered 200/m);
  assert.match(out, /^PASS {2}makes things — made an Entry/m);
  assert.match(out, /1 of 3 checks failed: an Entry moves to another date \(EF\.33\)/);
  assert.deepEqual(fake.entries, []);
  assert.deepEqual(fake.categories, [starter]);
});

test('passes with one line per check and the revision that answered', async () => {
  const fake = fakeApi({ categories: [starter] });
  const { lines, log } = capture();
  assert.equal(await run({ api: fake.api, log, checks: [makesThings] }), 0);
  assert.match(lines[0], /Revision: fake-00001/);
  assert.equal(lines.filter((l) => /^(PASS|FAIL) /.test(l)).length, 2);
  assert.match(lines.join('\n'), /^PASS {2}leaves the smoke User as it found it/m);
});
