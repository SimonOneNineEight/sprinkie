import { installMockApi, type MockApi } from './mockApi';

// The mock server's own contract: replay memory, failure switches, world
// mutability, and teardown. The suites rely on these without re-testing them.

let api: MockApi;

afterEach(() => {
  api.restore();
});

const post = (body: object) =>
  globalThis.fetch('https://api/entries', { method: 'POST', body: JSON.stringify(body) });

it('replays the first 201 for a key verbatim, like the real InsertEntry (#17)', async () => {
  api = installMockApi();
  const first = await (
    await post({ date: '2026-08-19', categoryId: 'c-sport', content: 'once', idempotencyKey: 'd-1' })
  ).json();
  const replay = await (
    await post({ date: '2026-08-19', categoryId: 'c-sport', content: 'edited', idempotencyKey: 'd-1' })
  ).json();
  const other = await (
    await post({ date: '2026-08-19', categoryId: 'c-sport', content: 'two', idempotencyKey: 'd-2' })
  ).json();

  expect(replay).toEqual(first);
  expect(other.id).not.toBe(first.id);
});

it('a seeded replay plays "the create landed but the response was lost"', async () => {
  api = installMockApi();
  api.seedReplay('d-lost', {
    id: 'e-orig',
    date: '2026-08-19',
    position: 1,
    categoryId: 'c-sport',
    authorId: 'u1',
    content: 'original',
  });
  const replay = await (
    await post({ date: '2026-08-19', categoryId: 'c-sport', content: 'retry', idempotencyKey: 'd-lost' })
  ).json();
  expect(replay.id).toBe('e-orig');
});

it('failure switches flip mid-test and back', async () => {
  api = installMockApi();
  api.failures.entryWrites = true;
  await expect(post({ date: '2026-08-19' })).rejects.toThrow('Network request failed');
  api.failures.entryWrites = false;
  expect((await post({ date: '2026-08-19', categoryId: 'c', content: 'x' })).ok).toBe(true);
});

it('fails the month, year and day reads as airplane mode does, each on its own switch (#109)', async () => {
  api = installMockApi();
  const month = () => globalThis.fetch('https://api/months/2026-08');
  const year = () => globalThis.fetch('https://api/years/2026');
  const day = () => globalThis.fetch('https://api/entries?date=2026-08-19');

  api.failures.monthReads = true;
  await expect(month()).rejects.toThrow('Network request failed');
  expect((await year()).ok).toBe(true);
  expect((await day()).ok).toBe(true);
  api.failures.monthReads = false;

  api.failures.yearReads = true;
  await expect(year()).rejects.toThrow('Network request failed');
  expect((await month()).ok).toBe(true);
  api.failures.yearReads = false;

  api.failures.dayReads = true;
  await expect(day()).rejects.toThrow('Network request failed');
  expect((await month()).ok).toBe(true);
});

it('fails Category create and edit as network throws on categoryWrites (#109)', async () => {
  api = installMockApi();
  api.failures.categoryWrites = true;
  const create = () =>
    globalThis.fetch('https://api/categories', { method: 'POST', body: JSON.stringify({ name: '園藝' }) });
  const edit = () =>
    globalThis.fetch('https://api/categories/c-food', { method: 'PATCH', body: JSON.stringify({ name: '吃' }) });
  await expect(create()).rejects.toThrow('Network request failed');
  await expect(edit()).rejects.toThrow('Network request failed');
  api.failures.categoryWrites = false;
  expect((await create()).ok).toBe(true);
  expect((await edit()).ok).toBe(true);
});

it('world state is live: reassigning a day feeds the list arm', async () => {
  api = installMockApi();
  api.world.entries['2026-08-19'] = [
    { id: 'e1', date: '2026-08-19', position: 1, categoryId: 'c', authorId: 'u1', content: 'x' },
  ];
  const listed = await (await globalThis.fetch('https://api/entries?date=2026-08-19')).json();
  expect(listed.entries).toHaveLength(1);
});

it('unmatched URLs throw, and restore puts the real fetch back', async () => {
  const before = globalThis.fetch;
  api = installMockApi();
  await expect(globalThis.fetch('https://api/nope')).rejects.toThrow('unexpected fetch');
  api.restore();
  expect(globalThis.fetch).toBe(before);
  api = installMockApi(); // so afterEach's restore has something to tear down
});
