import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { encodeContent } from '../entries/content';
import { cat } from '../testing/fixtures';
import { expectSingleLineField } from '../testing/expectSingleLineField';
import { installMockApi, type MockApi } from '../testing/mockApi';
import { EntryFormScreen } from './EntryFormScreen';

const categories = [{ ...cat.sport, position: 1 }];

let api: MockApi;

beforeEach(() => {
  api = installMockApi();
});

afterEach(() => {
  api.restore();
});

// Assertion views over the recorded wire calls, replacing the old mock's
// capture variables.
const lastBody = (call?: [string, { body?: unknown } | undefined]) =>
  call ? JSON.parse(typeof call[1]?.body === 'string' ? call[1].body : '{}') : null;
const postedEntry = () => lastBody(api.entryPosts().at(-1));
const patchedEntry = () => lastBody(api.find('PATCH', '/entries/'));
const categoryPosts = () =>
  api
    .calls()
    .filter(([u, init]) => String(u).includes('/categories') && init?.method === 'POST')
    .map((call) => lastBody(call));

function renderForm(overrides: Partial<React.ComponentProps<typeof EntryFormScreen>> = {}) {
  return render(
    <EntryFormScreen
      accessToken="tok"
      date="2026-08-17"
      categories={categories}
      onDone={jest.fn()}
      {...overrides}
    />,
  );
}

async function fillAndSave() {
  fireEvent.press(screen.getByText('運動'));
  fireEvent.changeText(screen.getByPlaceholderText('標題'), '晨跑');
  await act(async () => {
    fireEvent.press(screen.getByText('儲存'));
  });
}

describe('date row (#24)', () => {
  it('shows the opened-for date and saves onto it untouched', async () => {
    const onDone = jest.fn();
    renderForm({ onDone });

    expect(screen.getByText('日期')).toBeTruthy();
    expect(screen.getAllByText('8月17日 星期一').length).toBeGreaterThan(0);
    await fillAndSave();
    expect(postedEntry()?.date).toBe('2026-08-17');
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('saves onto the date picked in the compact picker', async () => {
    renderForm();

    fireEvent.press(screen.getByText('日期'));
    const sheet = within(screen.getByTestId('date-picker-sheet'));
    // '20' also exists as a neighboring outside cell; the first is August's.
    await act(async () => {
      fireEvent.press(sheet.getAllByText('20')[0]);
    });
    expect(screen.getAllByText('8月20日 星期四').length).toBeGreaterThan(0);

    await fillAndSave();
    expect(postedEntry()?.date).toBe('2026-08-20');
  });

  it('steps the picker to a neighboring month before picking', async () => {
    renderForm();

    fireEvent.press(screen.getByText('日期'));
    fireEvent.press(screen.getByLabelText('下個月'));
    const sheet = within(screen.getByTestId('date-picker-sheet'));
    await act(async () => {
      fireEvent.press(sheet.getAllByText('2')[0]);
    });

    await fillAndSave();
    expect(postedEntry()?.date).toBe('2026-09-02');
  });

  it("edit mode shows the entry's date and picking a new one drives the move (#25)", async () => {
    renderForm({
      entry: {
        id: 'e1',
        date: '2026-08-10',
        position: 1,
        categoryId: 'c-sport',
        authorId: 'u1',
        content: encodeContent({ title: '晨跑', note: '' }),
      },
    });

    expect(screen.getAllByText('8月10日 星期一').length).toBeGreaterThan(0);
    fireEvent.press(screen.getByText('日期'));
    const sheet = within(screen.getByTestId('date-picker-sheet'));
    await act(async () => {
      fireEvent.press(sheet.getAllByText('12')[0]);
    });

    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });
    expect(patchedEntry()?.date).toBe('2026-08-12');
  });
});

describe('category step (#28)', () => {
  it('creates a typed-but-unconfirmed subcategory together with the entry at 儲存', async () => {
    renderForm();
    fireEvent.press(screen.getByText('運動'));
    fireEvent.press(screen.getByLabelText('新增子類別'));
    fireEvent.changeText(screen.getByPlaceholderText('子類別'), '夜跑');
    fireEvent(screen.getByPlaceholderText('子類別'), 'blur');

    // The pending name renders in the category line like a confirmed pick.
    expect(screen.getByText('夜跑')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('標題'), '晨跑');
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });

    expect(categoryPosts()).toEqual([{ name: '夜跑', color: '#73B062', parentId: 'c-sport' }]);
    expect(postedEntry()?.subcategoryId).toBe('c-new-1');
  });

  it('creates nothing when the subcategory field is whitespace or cleared', async () => {
    renderForm();
    fireEvent.press(screen.getByText('運動'));
    fireEvent.press(screen.getByLabelText('新增子類別'));
    fireEvent.changeText(screen.getByPlaceholderText('子類別'), '   ');
    fireEvent(screen.getByPlaceholderText('子類別'), 'blur');

    fireEvent.changeText(screen.getByPlaceholderText('標題'), '晨跑');
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });
    expect(categoryPosts()).toEqual([]);
    expect(postedEntry()?.subcategoryId).toBeUndefined();
  });

  it('renders the save failure when the subcategory create fails', async () => {
    // The branching itself (no entry write, the Draft keeping the typed
    // name) is unit-tested at the pipeline's interface in entries/save.test;
    // the screen's job is mapping subcategoryFailed onto the error line.
    api.failures.categoryPost = true;
    const onDone = jest.fn();
    renderForm({ onDone });
    fireEvent.press(screen.getByText('運動'));
    fireEvent.press(screen.getByLabelText('新增子類別'));
    fireEvent.changeText(screen.getByPlaceholderText('子類別'), '夜跑');
    fireEvent.changeText(screen.getByPlaceholderText('標題'), '晨跑');
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });

    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText('儲存失敗，請再試一次')).toBeTruthy();
  });

  it('restores a draft with a pending subcategory and creates it on retry', async () => {
    renderForm({
      draft: {
        id: 'd-restore',
        date: '2026-08-17',
        categoryId: 'c-sport',
        pendingSubcategoryName: '夜跑',
        content: encodeContent({ title: '晨跑', note: '' }),
        photos: [],
        savedAt: '2026-09-10T12:00:00.000Z',
      },
    });

    // The pending name comes back as the same pick-shaped pill.
    expect(screen.getByText('夜跑')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });
    expect(categoryPosts()).toEqual([{ name: '夜跑', color: '#73B062', parentId: 'c-sport' }]);
    expect(postedEntry()?.subcategoryId).toBe('c-new-1');
  });

  it('pins a 新增類別 row that opens the category editor sheet without typing', async () => {
    renderForm();

    fireEvent.press(screen.getByText('新增類別'));
    const sheet = within(screen.getByTestId('category-editor-sheet'));
    fireEvent.changeText(sheet.getByPlaceholderText('名稱'), '閱讀');
    await act(async () => {
      fireEvent.press(sheet.getByText('儲存'));
    });

    expect(categoryPosts()).toEqual([
      { name: '閱讀', color: expect.any(String), icon: expect.any(String) },
    ]);
    // The sheet closes into the chosen-category state.
    expect(screen.getByText('閱讀')).toBeTruthy();
    expect(screen.getByPlaceholderText('標題')).toBeTruthy();
  });

  it('a subcategory made in the sheet selects its parent and itself', async () => {
    renderForm();

    fireEvent.press(screen.getByText('新增類別'));
    const sheet = within(screen.getByTestId('category-editor-sheet'));
    fireEvent.changeText(sheet.getByPlaceholderText('名稱'), '夜跑');
    fireEvent.press(sheet.getByText('無'));
    fireEvent.press(sheet.getByText('運動'));
    await act(async () => {
      fireEvent.press(sheet.getByText('儲存'));
    });

    expect(categoryPosts()).toEqual([
      { name: '夜跑', color: '#73B062', parentId: 'c-sport' },
    ]);
    // The form lands on 運動 refined by the new 夜跑.
    expect(screen.getByText('運動')).toBeTruthy();
    expect(screen.getByText('夜跑')).toBeTruthy();
    expect(screen.getByPlaceholderText('標題')).toBeTruthy();
  });
});

// PM round 2, item 14: the category search clipped what you typed. A
// typography token spread into a TextInput carries its lineHeight, which
// shifts an iOS input off its baseline and cuts the CJK glyph; a forced
// height top-anchors the placeholder inside it. Same rule as subInput
// (2026-08-19) and now every single-line field (#42).
describe('single-line fields (#42)', () => {
  it('sizes the category search field for CJK, at the hit target', () => {
    renderForm();

    expectSingleLineField('類別');
  });

  it('sizes the title field for CJK, at the hit target', () => {
    renderForm();
    fireEvent.press(screen.getByText('運動'));

    expectSingleLineField('標題');
  });
});

// PM round 2, items 3 and 7. Three Photos per Entry, and a save that says
// it is saving instead of sitting there (#44, ratified 2026-09-12).
describe('photos (#44)', () => {
  const draftWith = (count: number) => ({
    id: 'd-photos',
    date: '2026-08-17',
    categoryId: 'c-sport',
    content: encodeContent({ title: '拍照', note: '' }),
    photos: Array.from({ length: count }, (_, i) => ({
      fullUri: `file:///${i}.jpg`,
      thumbUri: `file:///${i}_t.jpg`,
    })),
    savedAt: '2026-08-17T12:00:00Z',
  });

  const savedPhotos = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      position: i + 1,
      url: `https://store/${i}.jpg`,
      thumbUrl: `https://store/${i}_t.jpg`,
    }));

  it('counts towards three and stops offering the tile at three', () => {
    const { unmount } = renderForm({ draft: draftWith(2) });
    expect(screen.getByText('2/3')).toBeTruthy();
    unmount();

    renderForm({ draft: draftWith(3) });
    expect(screen.queryByTestId('grid-item-__add__')).toBeNull();
  });

  it('keeps every Photo of an Entry saved under the old cap of ten', () => {
    renderForm({
      entry: {
        id: 'e1',
        date: '2026-08-17',
        position: 1,
        categoryId: 'c-sport',
        authorId: 'u1',
        content: encodeContent({ title: '舊紀錄', note: '' }),
        photos: savedPhotos(5),
      },
    });

    // All five are on screen, and the grid simply cannot gain a sixth.
    for (let i = 0; i < 5; i += 1) {
      expect(screen.getByTestId(`grid-item-photo:p${i}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('grid-item-__add__')).toBeNull();
  });

  it('shows a spinner for the whole save and holds the form inert beneath it', async () => {
    const onDone = jest.fn();
    // Storage answers nothing until released: the save stays in flight and
    // the form can be asked what it looks like mid-save.
    const release = api.holdUploads();
    renderForm({ draft: draftWith(1), onDone });

    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });

    expect(screen.getByLabelText('儲存中')).toBeTruthy();
    expect(screen.queryByText('儲存')).toBeNull();
    // Inert beneath it: tapping the chosen category, which normally
    // reopens the picker, changes nothing.
    fireEvent.press(screen.getByText('運動'));
    expect(screen.getByPlaceholderText('標題')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();

    await act(async () => {
      release();
    });
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('saves once when 儲存 is pressed twice inside one render pass', async () => {
    renderForm({ draft: draftWith(1) });

    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
      fireEvent.press(screen.getByText('儲存'));
    });

    expect(api.entryPosts()).toHaveLength(1);
  });
});

describe('title length (#90)', () => {
  it('holds a title longer than the old 40-character cap', () => {
    renderForm();
    fireEvent.press(screen.getByText('運動'));

    // An imported journal carries titles up to 72 characters, because a whole
    // thought gets written as the title. At 40 the field truncates such a
    // title the next time the entry is opened, losing text already saved.
    const title = screen.getByPlaceholderText('標題');
    expect(title.props.maxLength).toBe(80);

    const long = '今天晚餐做了泡菜炒飯，原本都覺得很好吃，但最後吃一吃覺得荷包蛋好像臭掉了…可惡';
    fireEvent.changeText(title, long);
    expect(title.props.maxLength).toBeGreaterThanOrEqual(long.length);
  });
});
