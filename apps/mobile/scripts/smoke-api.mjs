// The post-deploy smoke run (#108): after every `gcloud run deploy`, exercise
// the hosted API as a real User and fail loudly when the revision serving
// traffic lacks something the app relies on. An old revision answers an
// unknown field or query parameter with a 2xx while doing nothing, so every
// check here reads its effect back rather than trusting the status.
//
// It runs as a dedicated smoke User, never the standing test User or a real
// Journal (ADR-0007). Sign one up in the app by email, once, with an address
// containing "smoke" (e.g. you+smoke@…), then, from an up-to-date main:
//   SMOKE_EMAIL=... SMOKE_PASSWORD=... pnpm smoke:api
//
// Everything it makes is marked: Entries carry `"smoke"` in their content and
// live in SMOKE_YEAR, Categories are named `smoke …`, saved colours come from
// SMOKE_COLORS. Before any request that writes, it refuses an account whose
// email lacks "smoke", and then one holding any Entry without the mark from
// SMOKE_YEAR to next year. It sweeps marked leftovers before and after the
// checks, so a run that died halfway is cleaned up by the next one.
//
// Exit codes: 0 every check passed, 1 a check failed, 2 refused the account.

import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SMOKE_YEAR = 2000;
const MARK = 'sprinkie-smoke';
const PREFIX = 'smoke ';
export const SMOKE_COLORS = ['#5A0C01', '#5A0C02', '#5A0C03'];

export function smokeContent(title) {
  return JSON.stringify({ v: 1, title, note: '', smoke: MARK });
}

function isSmokeEntry(entry) {
  try {
    return JSON.parse(entry.content).smoke === MARK;
  } catch {
    return false;
  }
}

const isSmokeCategory = (category) => category.name.startsWith(PREFIX);

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function ok(res, what) {
  if (res.status < 200 || res.status > 299) throw new Error(`${what} answered ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const day = async (api, date) => ok(await api('GET', `/entries?date=${date}`), `GET /entries?date=${date}`).entries;

async function smokeYearEntries(api) {
  const year = ok(await api('GET', `/years/${SMOKE_YEAR}`), `GET /years/${SMOKE_YEAR}`);
  return (await Promise.all(year.days.map(({ date }) => day(api, date)))).flat();
}

// ADR-0007: refuse any account holding an Entry this script did not make.
async function foreignEntries(api, untilYear) {
  const years = [];
  for (let y = SMOKE_YEAR; y <= untilYear; y++) years.push(y);
  const totals = await Promise.all(years.map(async (y) => ok(await api('GET', `/years/${y}`), `GET /years/${y}`).totalEntries));
  const found = [];
  years.forEach((y, i) => {
    if (y !== SMOKE_YEAR && totals[i] > 0) found.push({ year: y, count: totals[i] });
  });
  const unmarked = (await smokeYearEntries(api)).filter((e) => !isSmokeEntry(e)).length;
  if (unmarked > 0) found.push({ year: SMOKE_YEAR, count: unmarked });
  return found;
}

const smokeEntries = async (api) => (await smokeYearEntries(api)).filter(isSmokeEntry);
const smokeCategories = async (api) => ok(await api('POST', '/me'), 'POST /me').categories.filter(isSmokeCategory);
const smokeColors = async (api) =>
  ok(await api('GET', '/color-recents'), 'GET /color-recents').colors.filter((c) => SMOKE_COLORS.includes(c));

// Deletes everything marked as the smoke run's: Entries (their Photos go
// with them), then Subcategories before their parents, then saved colours.
// Each kind is read only once the one before it is gone.
async function sweep(api) {
  const entries = await smokeEntries(api);
  for (const e of entries) ok(await api('DELETE', `/entries/${e.id}`), `DELETE /entries/${e.id}`);
  const categories = (await smokeCategories(api)).sort((a, b) => Number(!a.parentId) - Number(!b.parentId));
  for (const c of categories) ok(await api('DELETE', `/categories/${c.id}`), `DELETE /categories/${c.id}`);
  const colors = await smokeColors(api);
  for (const c of colors) ok(await api('DELETE', `/color-recents/${c.slice(1)}`), `DELETE /color-recents/${c.slice(1)}`);
  return { entries: entries.length, categories: categories.length, colors: colors.length };
}

async function leftovers(api) {
  const [entries, categories, colors] = await Promise.all([smokeEntries(api), smokeCategories(api), smokeColors(api)]);
  return { entries: entries.length, categories: categories.length, colors: colors.length };
}

const describe = ({ entries, categories, colors }) =>
  `${plural(entries, 'Entry', 'Entries')}, ${plural(categories, 'Category', 'Categories')} and ${plural(colors, 'saved colour', 'saved colours')}`;

export async function run({ api, checks, log, upload, email, untilYear = new Date().getFullYear() + 1 }) {
  // A failing /health is the /health check's FAIL below; here it only means
  // the revision cannot be named.
  const health = await api('GET', '/health');
  if (health.status !== 200) log(`Revision: unknown — /health answered ${health.status} ${JSON.stringify(health.body)}`);
  else log(`Revision: ${health.body.revision ?? 'unknown (/health does not name it, so it predates #108)'}`);

  // The Entry check below only sees SMOKE_YEAR to next year, and the sweep
  // deletes whatever is named like the smoke run's, so the account itself
  // must say what it is before anything writes.
  if (!/smoke/i.test(email ?? '')) {
    log(
      `Refusing: ${email} is not a smoke account. Sign one up whose email contains "smoke" (e.g. you+smoke@…) and set SMOKE_EMAIL to it.`,
    );
    return 2;
  }

  // Provision first, as the app does on every launch: an account that has
  // never been provisioned has no Journal, and /years answers it 500.
  ok(await api('POST', '/me'), 'POST /me');
  const foreign = await foreignEntries(api, untilYear);
  if (foreign.length > 0) {
    const count = foreign.reduce((n, f) => n + f.count, 0);
    const where = foreign.map((f) => `${f.count} in ${f.year}`).join(', ');
    log(`Refusing: this account holds ${plural(count, 'Entry', 'Entries')} it did not make (${where}). Use the dedicated smoke User.`);
    return 2;
  }

  const swept = await sweep(api);
  if (swept.entries + swept.categories + swept.colors > 0) log(`Swept ${describe(swept)} left by an earlier run`);

  const ctx = {
    api,
    upload,
    category: async (label, extra = {}) =>
      ok(await api('POST', '/categories', { name: PREFIX + label, color: SMOKE_COLORS[0], ...extra }), 'POST /categories'),
  };
  const failed = [];
  const report = (name, evidence, error) => {
    if (error) failed.push(name);
    log(`${error ? 'FAIL' : 'PASS'}  ${name} — ${error ? error.message : evidence}`);
  };
  try {
    for (const check of checks) {
      try {
        report(check.name, await check.run(ctx));
      } catch (error) {
        report(check.name, null, error);
      }
    }
  } finally {
    const name = 'leaves the smoke User as it found it';
    try {
      await sweep(api);
      const left = await leftovers(api);
      expect(left.entries + left.categories + left.colors === 0, `still holds ${describe(left)}`);
      report(name, `no smoke Entries, Categories or saved colours remain`);
    } catch (error) {
      report(name, null, error);
    }
  }

  const total = checks.length + 1;
  log(failed.length ? `${failed.length} of ${total} checks failed: ${failed.join('; ')}` : `All ${total} checks passed`);
  return failed.length ? 1 : 0;
}

// --- The checks. Each one is something an older revision answers with a
// 2xx while doing nothing; the case ids are the manual ones it stands in for.

async function entry(api, categoryId, date, title, extra = {}) {
  return ok(await api('POST', '/entries', { date, categoryId, content: smokeContent(title), ...extra }), 'POST /entries');
}

function newestMigration() {
  const dir = new URL('../../../supabase/migrations/', import.meta.url);
  const newest = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().at(-1);
  return { file: newest, version: Number(newest.split('_')[0]) };
}

export const CHECKS = [
  {
    name: '/health reports the newest migration',
    async run({ api }) {
      const health = ok(await api('GET', '/health'), 'GET /health');
      const { file, version } = newestMigration();
      expect(health.schemaVersion === version, `schemaVersion is ${health.schemaVersion}, want ${version} (${file})`);
      return `schemaVersion ${health.schemaVersion}`;
    },
  },
  {
    name: 'an Entry PATCHed to another date moves (EF.33)',
    async run({ api, category }) {
      const c = await category('move');
      const e = await entry(api, c.id, `${SMOKE_YEAR}-04-10`, 'move me');
      const moved = ok(await api('PATCH', `/entries/${e.id}`, { categoryId: c.id, content: e.content, date: `${SMOKE_YEAR}-05-02` }), 'PATCH /entries');
      expect(moved.date === `${SMOKE_YEAR}-05-02`, `PATCH answered date ${moved.date}, want ${SMOKE_YEAR}-05-02`);
      const april = ok(await api('GET', `/months/${SMOKE_YEAR}-04`), `GET /months/${SMOKE_YEAR}-04`);
      expect(!april.days.some((d) => d.date === `${SMOKE_YEAR}-04-10`), `/months/${SMOKE_YEAR}-04 still shows ${SMOKE_YEAR}-04-10: ${JSON.stringify(april.days)}`);
      const may = ok(await api('GET', `/months/${SMOKE_YEAR}-05`), `GET /months/${SMOKE_YEAR}-05`);
      const target = may.days.find((d) => d.date === `${SMOKE_YEAR}-05-02`);
      expect(target?.categoryIds.includes(c.id), `/months/${SMOKE_YEAR}-05 has no dot on ${SMOKE_YEAR}-05-02: ${JSON.stringify(may.days)}`);
      return `PATCH answered ${moved.date}; /months/${SMOKE_YEAR}-04 dropped 04-10, /months/${SMOKE_YEAR}-05 shows 05-02`;
    },
  },
  {
    name: 'a hidden Category drops from month and year (VI.1, VI.4)',
    async run({ api, category }) {
      const shown = await category('shown');
      const hidden = await category('hidden');
      await entry(api, hidden.id, `${SMOKE_YEAR}-03-05`, 'hidden first');
      await entry(api, shown.id, `${SMOKE_YEAR}-03-05`, 'shown second');
      await entry(api, hidden.id, `${SMOKE_YEAR}-03-06`, 'hidden alone');
      const q = `?hiddenCategories=${hidden.id}`;
      const month = ok(await api('GET', `/months/${SMOKE_YEAR}-03${q}`), 'GET /months (hidden)');
      const d5 = month.days.find((d) => d.date === `${SMOKE_YEAR}-03-05`);
      expect(JSON.stringify(d5?.categoryIds) === JSON.stringify([shown.id]), `month dots on ${SMOKE_YEAR}-03-05 are ${JSON.stringify(d5?.categoryIds)}, want only the shown Category`);
      expect(!month.days.some((d) => d.date === `${SMOKE_YEAR}-03-06`), `month still dots ${SMOKE_YEAR}-03-06, which holds only the hidden Category`);
      const all = ok(await api('GET', `/years/${SMOKE_YEAR}`), 'GET /years');
      const year = ok(await api('GET', `/years/${SMOKE_YEAR}${q}`), 'GET /years (hidden)');
      expect(year.totalEntries === all.totalEntries - 2, `year count is ${year.totalEntries} hidden, ${all.totalEntries} not; want 2 fewer`);
      const box = year.days.find((d) => d.date === `${SMOKE_YEAR}-03-05`);
      expect(box?.categoryId === shown.id, `year box on ${SMOKE_YEAR}-03-05 wears ${box?.categoryId}, want the shown Category`);
      expect(!year.days.some((d) => d.date === `${SMOKE_YEAR}-03-06`), `year still boxes ${SMOKE_YEAR}-03-06`);
      return `month keeps only the shown dot, year count ${all.totalEntries} → ${year.totalEntries}, 03-06 gone from both`;
    },
  },
  {
    name: 'forgetting a saved colour keeps it on its Category (CD.18–CD.20)',
    async run({ api, category }) {
      const hex = SMOKE_COLORS[1];
      const saved = ok(await api('PUT', '/color-recents', { color: hex }), 'PUT /color-recents');
      expect(saved.colors.includes(hex), `PUT /color-recents answered ${JSON.stringify(saved.colors)}, without ${hex}`);
      const c = await category('colour', { color: hex });
      const res = await api('DELETE', `/color-recents/${hex.slice(1)}`);
      expect(res.status === 204, `DELETE /color-recents/${hex.slice(1)} answered ${res.status} ${JSON.stringify(res.body)}`);
      const after = ok(await api('GET', '/color-recents'), 'GET /color-recents');
      expect(!after.colors.includes(hex), `${hex} is still saved: ${JSON.stringify(after.colors)}`);
      const worn = ok(await api('POST', '/me'), 'POST /me').categories.find((x) => x.id === c.id);
      expect(worn?.color === hex, `the Category wearing ${hex} now wears ${worn?.color}`);
      return `DELETE answered 204, ${hex} gone from the saved row, the Category still wears it`;
    },
  },
  {
    name: 'a day reorder persists (DA.4)',
    async run({ api, category }) {
      const c = await category('order');
      const a = await entry(api, c.id, `${SMOKE_YEAR}-06-07`, 'first');
      const b = await entry(api, c.id, `${SMOKE_YEAR}-06-07`, 'second');
      ok(await api('PUT', `/days/${SMOKE_YEAR}-06-07/order`, { entryIds: [b.id, a.id] }), 'PUT /days/order');
      const ids = (await day(api, `${SMOKE_YEAR}-06-07`)).map((e) => e.id);
      expect(JSON.stringify(ids) === JSON.stringify([b.id, a.id]), `the day reads back ${JSON.stringify(ids)}, want [second, first]`);
      return 'the day reads back in the new order';
    },
  },
  {
    name: 'a replayed create returns the original Entry',
    async run({ api, category }) {
      const c = await category('replay');
      const key = `smoke:${randomUUID()}`;
      const first = await entry(api, c.id, `${SMOKE_YEAR}-07-08`, 'once', { idempotencyKey: key });
      const again = await entry(api, c.id, `${SMOKE_YEAR}-07-08`, 'once', { idempotencyKey: key });
      expect(again.id === first.id, `the replay answered a new Entry ${again.id}, want ${first.id}`);
      const held = (await day(api, `${SMOKE_YEAR}-07-08`)).length;
      expect(held === 1, `the day holds ${held} Entries, want 1`);
      return `both creates answered ${first.id}; the day holds one Entry`;
    },
  },
  {
    // A create stores whatever colour it is sent, so what the server does for
    // a Subcategory's colour is carry a parent's recolour down to it.
    name: 'recolouring a parent carries its Subcategories, and a Subcategory refines an Entry',
    async run({ api, category }) {
      const parent = await category('parent');
      const child = await category('child', { parentId: parent.id, color: parent.color });
      ok(await api('PATCH', `/categories/${parent.id}`, { color: SMOKE_COLORS[2] }), 'PATCH /categories');
      const stored = ok(await api('POST', '/me'), 'POST /me').categories.find((x) => x.id === child.id);
      expect(stored?.color === SMOKE_COLORS[2], `the Subcategory wears ${stored?.color} after its parent became ${SMOKE_COLORS[2]}`);
      const e = await entry(api, parent.id, `${SMOKE_YEAR}-08-09`, 'refined', { subcategoryId: child.id });
      const read = (await day(api, `${SMOKE_YEAR}-08-09`)).find((x) => x.id === e.id);
      expect(read?.subcategoryId === child.id, `the Entry reads back with subcategoryId ${read?.subcategoryId}`);
      return `the Subcategory took ${SMOKE_COLORS[2]} with its parent; the Entry reads back refined`;
    },
  },
  {
    name: 'a 72-character title reads back intact (EF.45)',
    async run({ api, category }) {
      const c = await category('long');
      const title = '和大學同學約在台北車站附近吃飯聊到很晚'.repeat(4).slice(0, 72);
      const e = await entry(api, c.id, `${SMOKE_YEAR}-09-10`, title);
      const read = (await day(api, `${SMOKE_YEAR}-09-10`)).find((x) => x.id === e.id);
      const back = read && JSON.parse(read.content).title;
      expect(back === title, `the title reads back as ${JSON.stringify(back)} (${back?.length} characters)`);
      return `${[...back].length} characters back`;
    },
  },
  {
    name: 'Photos upload, register, and a fourth is refused',
    async run({ api, category, upload }) {
      const c = await category('photos');
      const e = await entry(api, c.id, `${SMOKE_YEAR}-10-11`, 'three photos');
      const { uploads } = ok(await api('POST', `/entries/${e.id}/photos/presign`, { count: 3 }), 'POST /photos/presign');
      expect(uploads.length === 3, `presign answered ${uploads.length} uploads, want 3`);
      await Promise.all(uploads.flatMap((u) => [upload(u.uploadUrl), upload(u.thumbUploadUrl)]));
      const photos = uploads.map((u) => ({ objectPath: u.objectPath, thumbPath: u.thumbPath }));
      const registered = ok(await api('POST', `/entries/${e.id}/photos`, { photos }), 'POST /photos');
      expect(registered.photos.length === 3, `register answered ${registered.photos.length} Photos, want 3`);
      const fourth = await api('POST', `/entries/${e.id}/photos/presign`, { count: 1 });
      expect(fourth.status === 400, `presigning a fourth answered ${fourth.status} ${JSON.stringify(fourth.body)}, want 400`);
      return `3 presigned, uploaded and registered; a fourth answered 400 ${JSON.stringify(fourth.body)}`;
    },
  },
];

// --- Signing in and the real network, when run as a script.

async function main() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;
  if (!supabaseUrl || !supabaseKey || !apiUrl) throw new Error('Run through `pnpm smoke:api`, which loads .env.hosted');
  if (!email || !password) throw new Error('Set SMOKE_EMAIL and SMOKE_PASSWORD to the smoke User you signed up in the app');

  const auth = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!auth.ok) throw new Error(`Sign-in failed: ${auth.status} ${await auth.text()}`);
  const { access_token: token, user } = await auth.json();

  async function api(method, path, body) {
    const res = await fetch(`${apiUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': 'application/json' }) },
      body: body && JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = text;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {}
    return { status: res.status, body: parsed };
  }

  // The bytes are never decoded; the bucket checks only the media type.
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  async function upload(url) {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: jpeg });
    if (!res.ok) throw new Error(`upload to Storage answered ${res.status} ${await res.text()}`);
  }

  console.log(`Smoke run as ${email} against ${apiUrl}`);
  process.exitCode = await run({ api, checks: CHECKS, log: console.log, upload, email: user.email });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
