import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { encodeContent } from '../entries/content';
import { cat } from '../testing/fixtures';
import { installMockApi, type MockApi, type MockEntry } from '../testing/mockApi';
import { DayScreen } from './DayScreen';

const categories = [
  { ...cat.sport, position: 1 },
  { ...cat.food, position: 2 },
  cat.gym,
];

let api: MockApi;
// The day's entries, mirrored into the mock world; tests reference rows
// directly (drag simulation) so the local name stays.
let listedEntries: MockEntry[] = [];

beforeEach(() => {
  listedEntries = [];
  api = installMockApi();
});

afterEach(() => {
  api.restore();
});

it('renders the day entries with decoded titles, in order', async () => {
  listedEntries = api.world.entries['2026-08-19'] = [
    { id: 'e1', date: '2026-08-19', position: 1, categoryId: 'c-sport', subcategoryId: 'c-gym', authorId: 'u1', content: encodeContent({ title: '晨跑', note: '' }) },
    { id: 'e2', date: '2026-08-19', position: 2, categoryId: 'c-food', authorId: 'u1', content: encodeContent({ title: '午餐吃了拉麵', note: '' }) },
  ];
  render(<DayScreen accessToken="tok" categories={categories} date="2026-08-19" />);

  expect(await screen.findByText('晨跑')).toBeTruthy();
  expect(screen.getByText('午餐吃了拉麵')).toBeTruthy();
  // The card's category line carries the refinement: 分類 · 子分類.
  expect(screen.getByText('運動 · 健身房')).toBeTruthy();
});

it('says 今天還沒有紀錄 when today has no entries', async () => {
  render(
    <DayScreen
      accessToken="tok"
      categories={categories}
      date="2026-08-19"
      today={new Date(2026, 7, 19)}
    />,
  );

  expect(await screen.findByText('今天還沒有紀錄')).toBeTruthy();
});

it('says 這天沒有紀錄 when another day has no entries (#83)', async () => {
  render(
    <DayScreen
      accessToken="tok"
      categories={categories}
      date="2026-08-19"
      today={new Date(2026, 7, 20)}
    />,
  );

  expect(await screen.findByText('這天沒有紀錄')).toBeTruthy();
  expect(screen.queryByText('今天還沒有紀錄')).toBeNull();
});

it('swipes to the neighboring dates (#26)', async () => {
  const onChangeDate = jest.fn();
  render(
    <DayScreen
      accessToken="tok"
      categories={categories}
      date="2026-08-19"
      onChangeDate={onChangeDate}
    />,
  );
  await screen.findByText('這天沒有紀錄');

  fireGestureHandler(getByGestureTestId('day-fling-next'), [
    { state: State.BEGAN },
    { state: State.ACTIVE },
    { state: State.END },
  ]);
  expect(onChangeDate).toHaveBeenCalledWith('2026-08-20');

  fireGestureHandler(getByGestureTestId('day-fling-prev'), [
    { state: State.BEGAN },
    { state: State.ACTIVE },
    { state: State.END },
  ]);
  expect(onChangeDate).toHaveBeenCalledWith('2026-08-18');
});

it('does not save until a category is picked and a title is typed', async () => {
  render(<DayScreen accessToken="tok" categories={categories} date="2026-08-19" />);
  fireEvent.press(await screen.findByLabelText('新增紀錄'));

  fireEvent.press(screen.getByText('儲存'));
  const posts = () =>
    (globalThis.fetch as jest.Mock).mock.calls.filter(([, init]) => init?.method === 'POST');
  expect(posts()).toHaveLength(0);

  fireEvent.press(screen.getByText('運動'));
  fireEvent.press(screen.getByText('儲存'));
  expect(posts()).toHaveLength(0);
});

it('saves an entry as an encoded blob and returns to the list', async () => {
  render(<DayScreen accessToken="tok" categories={categories} date="2026-08-19" />);
  fireEvent.press(await screen.findByLabelText('新增紀錄'));

  fireEvent.press(screen.getByText('運動'));
  fireEvent.changeText(screen.getByPlaceholderText('標題'), '晚上打籃球');
  fireEvent.changeText(screen.getByPlaceholderText('備註（選填）'), '和同事');
  await act(async () => {
    fireEvent.press(screen.getByText('儲存'));
  });

  const post = (globalThis.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'POST');
  expect(post).toBeTruthy();
  const body = JSON.parse(post?.[1]?.body ?? '{}');
  expect(body.categoryId).toBe('c-sport');
  expect(JSON.parse(body.content)).toEqual({ v: 1, title: '晚上打籃球', note: '和同事' });

  // Back on the list: the form's placeholder is gone.
  expect(screen.queryByPlaceholderText('標題')).toBeNull();
});

it('filters the category picker by search', async () => {
  render(<DayScreen accessToken="tok" categories={categories} date="2026-08-19" />);
  fireEvent.press(await screen.findByLabelText('新增紀錄'));

  fireEvent.changeText(screen.getByPlaceholderText('類別'), '美');
  expect(screen.queryByText('運動')).toBeNull();
  expect(screen.getByText('美食')).toBeTruthy();
});

const dayEntriesFixture = () => [
  { id: 'e1', date: '2026-08-19', position: 1, categoryId: 'c-sport', authorId: 'u1', content: encodeContent({ title: '晨跑', note: '河濱' }) },
  { id: 'e2', date: '2026-08-19', position: 2, categoryId: 'c-food', authorId: 'u1', content: encodeContent({ title: '午餐', note: '' }) },
];

it('persists a drag reorder through the API', async () => {
  listedEntries = api.world.entries['2026-08-19'] = dayEntriesFixture();
  render(<DayScreen accessToken="tok" categories={categories} date="2026-08-19" />);
  await screen.findByText('晨跑');

  const mockDragState = (globalThis as { __mockDragState?: { onDragEnd?: (p: { data: object[] }) => void } })
    .__mockDragState!;
  expect(typeof mockDragState.onDragEnd).toBe('function');
  await act(async () => {
    mockDragState.onDragEnd?.({ data: [listedEntries[1], listedEntries[0]] });
  });

  const put = (globalThis.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'PUT');
  expect(put).toBeTruthy();
  expect(String(put?.[0])).toContain('/days/2026-08-19/order');
  expect(JSON.parse(put?.[1]?.body ?? '{}').entryIds).toEqual(['e2', 'e1']);
});

it('opens an entry for editing, prefilled, and saves via PATCH', async () => {
  listedEntries = api.world.entries['2026-08-19'] = dayEntriesFixture();
  render(<DayScreen accessToken="tok" categories={categories} date="2026-08-19" />);

  const card = await screen.findByText('晨跑');
  await act(async () => {
    fireEvent.press(card);
  });
  expect(screen.getByPlaceholderText('標題').props.value).toBe('晨跑');
  expect(screen.getByPlaceholderText('備註（選填）').props.value).toBe('河濱');

  fireEvent.changeText(screen.getByPlaceholderText('標題'), '夜跑');
  await act(async () => {
    fireEvent.press(screen.getByText('儲存'));
  });

  const patch = (globalThis.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'PATCH');
  expect(patch).toBeTruthy();
  expect(String(patch?.[0])).toContain('/entries/e1');
  const body = JSON.parse(patch?.[1]?.body ?? '{}');
  expect(body.categoryId).toBe('c-sport');
  expect(JSON.parse(body.content)).toEqual({ v: 1, title: '夜跑', note: '河濱' });
});

it('deletes an entry after confirmation', async () => {
  listedEntries = api.world.entries['2026-08-19'] = dayEntriesFixture();
  const alertSpy = jest.spyOn(Alert, 'alert');
  render(<DayScreen accessToken="tok" categories={categories} date="2026-08-19" />);

  const card = await screen.findByText('晨跑');
  await act(async () => {
    fireEvent.press(card);
  });
  await act(async () => {
    fireEvent.press(screen.getByText('刪除紀錄'));
  });

  expect(alertSpy).toHaveBeenCalled();
  const buttons = alertSpy.mock.calls[0][2] ?? [];
  const destructive = buttons.find((b) => b.style === 'destructive');
  expect(destructive).toBeTruthy();
  await act(async () => {
    destructive?.onPress?.();
  });

  const del = (globalThis.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'DELETE');
  expect(del).toBeTruthy();
  expect(String(del?.[0])).toContain('/entries/e1');
  alertSpy.mockRestore();
});

it('keeps the picker to top-level categories', async () => {
  render(<DayScreen accessToken="tok" categories={categories} date="2026-08-19" />);
  fireEvent.press(await screen.findByLabelText('新增紀錄'));

  expect(screen.getByText('運動')).toBeTruthy();
  expect(screen.queryByText('健身房')).toBeNull();
});

it('creates a category inline from an unmatched search', async () => {
  render(<DayScreen accessToken="tok" categories={categories} date="2026-08-19" />);
  fireEvent.press(await screen.findByLabelText('新增紀錄'));

  fireEvent.changeText(screen.getByPlaceholderText('類別'), '園藝');
  await act(async () => {
    fireEvent.press(screen.getByText('建立「園藝」'));
  });
  // The full category editor sheet opens, name prefilled (ratified
  // 2026-09-10, replacing the in-form quick step).
  const sheet = within(screen.getByTestId('category-editor-sheet'));
  expect(sheet.getByDisplayValue('園藝')).toBeTruthy();
  await act(async () => {
    fireEvent.press(sheet.getByText('儲存'));
  });

  const post = (globalThis.fetch as jest.Mock).mock.calls.find(
    ([url, init]) => String(url).includes('/categories') && init?.method === 'POST',
  );
  expect(post).toBeTruthy();
  const body = JSON.parse(post?.[1]?.body ?? '{}');
  expect(body.name).toBe('園藝');
  expect(typeof body.color).toBe('string');
  expect(body.parentId).toBeUndefined();

  // The new category is selected: the title field is available.
  expect(screen.getByPlaceholderText('標題')).toBeTruthy();
  expect(screen.getByText('園藝')).toBeTruthy();
});

it('links an optional subcategory into the saved entry', async () => {
  render(<DayScreen accessToken="tok" categories={categories} date="2026-08-19" />);
  fireEvent.press(await screen.findByLabelText('新增紀錄'));

  fireEvent.press(screen.getByText('運動'));
  fireEvent.press(screen.getByText('健身房'));
  fireEvent.changeText(screen.getByPlaceholderText('標題'), '腿日');
  await act(async () => {
    fireEvent.press(screen.getByText('儲存'));
  });

  const post = (globalThis.fetch as jest.Mock).mock.calls.find(
    ([url, init]) => String(url).includes('/entries') && init?.method === 'POST',
  );
  const body = JSON.parse(post?.[1]?.body ?? '{}');
  expect(body.subcategoryId).toBe('c-gym');
});

it('creates a subcategory inline under the picked category', async () => {
  render(<DayScreen accessToken="tok" categories={categories} date="2026-08-19" />);
  fireEvent.press(await screen.findByLabelText('新增紀錄'));

  fireEvent.press(screen.getByText('運動'));
  fireEvent.press(screen.getByLabelText('新增子類別'));
  fireEvent.changeText(screen.getByPlaceholderText('子類別'), '晨跑');
  await act(async () => {
    fireEvent.press(screen.getByText('建立'));
  });

  const post = (globalThis.fetch as jest.Mock).mock.calls.find(
    ([url, init]) => String(url).includes('/categories') && init?.method === 'POST',
  );
  const body = JSON.parse(post?.[1]?.body ?? '{}');
  expect(body.name).toBe('晨跑');
  expect(body.parentId).toBe('c-sport');
  expect(body.color).toBe('#73B062');
});

it('rolls back and reports when persisting a reorder fails', async () => {
  listedEntries = api.world.entries['2026-08-19'] = dayEntriesFixture();
  const okFetch = globalThis.fetch as jest.Mock;
  globalThis.fetch = jest.fn(async (url: unknown, init?: { method?: string; body?: string }) => {
    if (init?.method === 'PUT') {
      return { ok: false, status: 500, json: async () => ({ message: 'boom' }) };
    }
    return okFetch(url, init);
  }) as jest.Mock;

  render(<DayScreen accessToken="tok" categories={categories} date="2026-08-19" />);
  await screen.findByText('晨跑');
  const gets = () =>
    (globalThis.fetch as jest.Mock).mock.calls.filter(
      ([u, init]) => (init?.method ?? 'GET') === 'GET' && String(u).includes('/entries'),
    ).length;
  const before = gets();

  const mockDragState = (globalThis as { __mockDragState?: { onDragEnd?: (p: { data: object[] }) => void } })
    .__mockDragState!;
  await act(async () => {
    mockDragState.onDragEnd?.({ data: [listedEntries[1], listedEntries[0]] });
  });

  expect(await screen.findByText('排序失敗，請再試一次')).toBeTruthy();
  expect(gets()).toBeGreaterThan(before); // rolled back to server truth
});

it('shows existing photos in edit mode and hides the add tile at the cap', async () => {
  // Ten: an Entry saved under the old cap, which keeps every one of them
  // and can only fail to gain more (#44).
  const tenPhotos = Array.from({ length: 10 }, (_, i) => ({
    id: `p${i}`,
    position: i + 1,
    url: `https://signed/full${i}`,
    thumbUrl: `https://signed/thumb${i}`,
  }));
  listedEntries = api.world.entries['2026-08-19'] = [
    {
      id: 'e1', date: '2026-08-19', position: 1, categoryId: 'c-sport', authorId: 'u1',
      content: encodeContent({ title: '滿照片', note: '' }), photos: tenPhotos,
    },
    {
      id: 'e2', date: '2026-08-19', position: 2, categoryId: 'c-food', authorId: 'u1',
      content: encodeContent({ title: '兩張', note: '' }), photos: tenPhotos.slice(0, 2),
    },
  ];
  render(<DayScreen accessToken="tok" categories={categories} date="2026-08-19" />);

  // Past the cap: all ten tiles, no add tile.
  const fullCard = await screen.findByText('滿照片');
  await act(async () => {
    fireEvent.press(fullCard);
  });
  expect(screen.queryByTestId('grid-item-__add__')).toBeNull();
  expect(screen.getByTestId('grid-item-photo:p9')).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByText('取消'));
  });

  // Two photos: add tile present with the counter.
  const partialCard = await screen.findByText('兩張');
  await act(async () => {
    fireEvent.press(partialCard);
  });
  expect(screen.getByTestId('grid-item-__add__')).toBeTruthy();
  expect(screen.getByText('2/3')).toBeTruthy();
});

it('returns the day view to today (#40 item 11)', async () => {
  const onChangeDate = jest.fn();
  render(
    <DayScreen
      accessToken="tok"
      categories={categories}
      date="2026-08-19"
      today={new Date(2026, 7, 17)}
      onChangeDate={onChangeDate}
    />,
  );
  await screen.findByText('這天沒有紀錄');

  fireEvent.press(screen.getByLabelText('今天'));
  expect(onChangeDate).toHaveBeenCalledWith('2026-08-17');
});

it('opens the full 類別 sheet from the day header (#41)', async () => {
  render(
    <DayScreen
      accessToken="tok"
      categories={categories}
      date="2026-08-19"
      onChangeHidden={jest.fn()}
    />,
  );
  await screen.findByText('這天沒有紀錄');

  fireEvent.press(screen.getByLabelText('類別'));

  // The same sheet the month and year views open, not a thinner read-only
  // twin: the header toggle, the two-level tree and 新增類別 all come with it
  // (DESIGN.md §9, ratified 2026-09-12).
  expect(screen.getByText('全部隱藏')).toBeTruthy();
  expect(screen.getByText('運動')).toBeTruthy();
  expect(screen.getByText('健身房')).toBeTruthy();
  expect(screen.getByText('新增類別')).toBeTruthy();
});
