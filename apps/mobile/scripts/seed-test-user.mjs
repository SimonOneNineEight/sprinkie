// Seeds the manual pass's standing test User (docs/manual-tests.md, "Before
// you start") through the hosted API, as that User: a year of Entries across
// the five starters, two Categories with Subcategories, crowded days, and a
// long title. Today stays empty, since DA.2 needs it to be.
//
// Sign the User up in the app first, then:
//   SEED_EMAIL=... SEED_PASSWORD=... pnpm seed:test-user
//
// Every Entry carries a `seed1:` idempotency key, so a rerun after a failure
// fills in what is missing rather than doubling it.

const { EXPO_PUBLIC_SUPABASE_URL: supabaseUrl, EXPO_PUBLIC_SUPABASE_KEY: supabaseKey, EXPO_PUBLIC_API_URL: apiUrl } =
  process.env;
const { SEED_EMAIL: email, SEED_PASSWORD: password, SEED_AGAIN: again } = process.env;
if (!supabaseUrl || !supabaseKey || !apiUrl) throw new Error('Run through `pnpm seed:test-user`, which loads .env.hosted');
if (!email || !password) throw new Error('Set SEED_EMAIL and SEED_PASSWORD to the test User you signed up in the app');

const auth = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!auth.ok) throw new Error(`Sign-in failed: ${auth.status} ${await auth.text()}`);
const { access_token: token } = await auth.json();

async function api(method, path, body) {
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ADR-0007: real Journals are durable. Refuse anything that already holds
// Entries, unless this is a rerun of the seed itself.
const today = new Date();
const year = today.getFullYear();
const held = (await api('GET', `/years/${year}`)).totalEntries + (await api('GET', `/years/${year - 1}`)).totalEntries;
if (held > 0 && again !== '1') {
  throw new Error(`${email} already holds ${held} Entries. Rerun with SEED_AGAIN=1 only if they came from this script.`);
}

const me = await api('POST', '/me', { language: 'zh-TW' });
const byName = Object.fromEntries(me.categories.filter((c) => !c.parentId).map((c) => [c.name, c]));
const starters = ['工作', '運動', '美食', '旅遊', '個人'];
for (const name of starters) if (!byName[name]) throw new Error(`No starter Category ${name}; was the User signed up in Chinese?`);

const children = { 運動: ['跑步', '重訓', '游泳'], 美食: ['早午餐', '自己煮'] };
const subs = {};
for (const [parent, names] of Object.entries(children)) {
  const parentId = byName[parent].id;
  subs[parent] = [];
  for (const name of names) {
    const found = me.categories.find((c) => c.parentId === parentId && c.name === name);
    subs[parent].push(found ?? (await api('POST', '/categories', { name, color: byName[parent].color, parentId })));
  }
}

const titles = {
  工作: ['週會', '整理季報', '和客戶開會', '寫提案', '專案上線', '面試新人', '加班趕簡報'],
  運動: ['河濱慢跑', '健身房', '晨泳', '爬象山', '騎腳踏車', '瑜珈課'],
  美食: ['巷口牛肉麵', '週末早午餐', '自己煮咖哩', '新開的拉麵店', '夜市', '手沖咖啡'],
  旅遊: ['台南兩天一夜', '花蓮', '九份老街', '墾丁', '宜蘭泡湯'],
  個人: ['讀完一本書', '整理房間', '和家人吃飯', '看電影', '寫日記', '練吉他'],
};
const notes = ['', '', '天氣很好，心情也不錯。', '比預期的還要累，但很值得。', '下次想再來一次。\n記得早點出門。'];
// EF.45: a title past the old 40-character cap, short of the 80 one.
const longTitle = '和大學同學約在台北車站附近吃飯，聊到很晚才回家，大家都變了好多，但相處起來還是跟以前一樣輕鬆自在，下次要更常見面';

// A seeded generator, so every run plans the same Journal and the keys line up.
let state = 49;
function random() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];

const yesterday = new Date(year, today.getMonth(), today.getDate() - 1);
const crowded = {
  [ymd(new Date(year, today.getMonth() - 1, 10))]: 8, // MO.26: more than the panel fits
  [ymd(new Date(year, today.getMonth(), today.getDate() - 3))]: 5, // MO.7: the + overflow
};
const days = [];
for (let d = new Date(year - 1, 10, 1); d <= yesterday; d.setDate(d.getDate() + 1)) {
  const date = ymd(d);
  const count = crowded[date] ?? (random() < 0.3 ? 0 : 1 + Math.floor(random() * 3));
  const entries = [];
  for (let i = 0; i < count; i++) {
    const category = pick(starters);
    const sub = subs[category] && random() < 0.6 ? pick(subs[category]) : undefined;
    const title = date === ymd(yesterday) && i === 0 ? longTitle : pick(titles[category]);
    entries.push({
      date,
      categoryId: byName[category].id,
      subcategoryId: sub?.id,
      content: JSON.stringify({ v: 1, title, note: pick(notes) }),
      idempotencyKey: `seed1:${date}:${i}`,
    });
  }
  if (entries.length) days.push(entries);
}

// Days run in parallel; a day's Entries go one at a time, so their order holds.
let done = 0;
const total = days.reduce((n, entries) => n + entries.length, 0);
const queue = [...days];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (let entries = queue.shift(); entries; entries = queue.shift()) {
      for (const entry of entries) {
        await api('POST', '/entries', entry);
        if (++done % 50 === 0) console.log(`${done}/${total}`);
      }
    }
  }),
);
console.log(`Seeded ${email}: ${total} Entries across ${days.length} days, ${days[0][0].date} to ${ymd(yesterday)}`);
