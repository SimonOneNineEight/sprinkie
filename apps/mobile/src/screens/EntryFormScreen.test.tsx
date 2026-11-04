// A tapped photo opens the viewer (#118), which holds its own gesture root
// and SafeAreaProvider inside its Modal: the gesture library's setup and the
// safe-area mock let both render in jest, as in PhotoViewer.test.tsx.
import 'react-native-gesture-handler/jestSetup';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert, StyleSheet, TextInput, type TextStyle } from 'react-native';

import { encodeContent } from '../entries/content';
import { cat } from '../testing/fixtures';
import { expectSingleLineField } from '../testing/expectSingleLineField';
import { installMockApi, type MockApi } from '../testing/mockApi';
import { processPhoto } from '../photos/processPhoto';
import { EntryFormScreen } from './EntryFormScreen';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));
jest.mock('../photos/processPhoto', () => ({ processPhoto: jest.fn() }));
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

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
    expect(onDone).toHaveBeenCalledWith(true, '2026-08-17');
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

  it('has no 建立: the return key, labeled 完成, turns the name into the selected pending pill (#102)', () => {
    renderForm();
    fireEvent.press(screen.getByText('運動'));
    fireEvent.press(screen.getByLabelText('新增子類別'));
    const field = screen.getByPlaceholderText('子類別');
    expect(field.props.returnKeyType).toBe('done');
    expect(screen.queryByText('建立')).toBeNull();

    fireEvent.changeText(field, '夜跑');
    fireEvent(field, 'submitEditing');

    expect(screen.queryByPlaceholderText('子類別')).toBeNull();
    expect(screen.getByText('夜跑')).toBeTruthy();
    // Nothing is created before 儲存.
    expect(categoryPosts()).toEqual([]);
  });

  it('reopens the field with the name when the pending pill is tapped; emptied, it is gone (#102)', () => {
    renderForm();
    fireEvent.press(screen.getByText('運動'));
    fireEvent.press(screen.getByLabelText('新增子類別'));
    fireEvent.changeText(screen.getByPlaceholderText('子類別'), '夜跑');
    fireEvent(screen.getByPlaceholderText('子類別'), 'blur');

    fireEvent.press(screen.getByText('夜跑'));
    expect(screen.getByPlaceholderText('子類別').props.value).toBe('夜跑');

    fireEvent.changeText(screen.getByPlaceholderText('子類別'), '');
    fireEvent(screen.getByPlaceholderText('子類別'), 'blur');
    expect(screen.queryByText('夜跑')).toBeNull();
    expect(screen.getByLabelText('新增子類別')).toBeTruthy();
  });

  it('selects the existing Subcategory when the typed name matches one (#102)', async () => {
    renderForm({ categories: [...categories, cat.gym] });
    fireEvent.press(screen.getByText('運動'));
    fireEvent.press(screen.getByLabelText('新增子類別'));
    fireEvent.changeText(screen.getByPlaceholderText('子類別'), ' 健身房 ');
    fireEvent(screen.getByPlaceholderText('子類別'), 'blur');

    fireEvent.changeText(screen.getByPlaceholderText('標題'), '晨練');
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });
    expect(categoryPosts()).toEqual([]);
    expect(postedEntry()?.subcategoryId).toBe('c-gym');
  });

  it('a new name typed while a Subcategory is picked replaces the pick (#102)', async () => {
    renderForm({ categories: [...categories, cat.gym] });
    fireEvent.press(screen.getByText('運動'));
    fireEvent.press(screen.getByText('健身房'));
    fireEvent.press(screen.getByLabelText('新增子類別'));
    fireEvent.changeText(screen.getByPlaceholderText('子類別'), '夜跑');
    fireEvent(screen.getByPlaceholderText('子類別'), 'blur');
    expect(screen.getByText('夜跑')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('標題'), '晨跑');
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });
    expect(categoryPosts()).toHaveLength(1);
    expect(postedEntry()?.subcategoryId).not.toBe('c-gym');
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
});

// The title was single-line under #42; a long one scrolled out of sight
// while it was typed (PM round 3). It wraps now, and still never holds a
// newline: Return moves on to the note, and a pasted line break becomes a
// space (#115).
describe('title and note fields (#115)', () => {
  it('wraps the title, still capped at 80 characters', () => {
    renderForm();
    fireEvent.press(screen.getByText('運動'));

    const title = screen.getByPlaceholderText('標題');
    expect(title.props.multiline).toBe(true);
    expect(title.props.maxLength).toBe(80);
  });

  // jest types nothing natively, so the newline Return would insert is
  // ruled out by the submit behaviour rather than by watching for one; the
  // focus is read off the input the form called focus() on. EF.50 and EF.53
  // walk the real key.
  it('moves Return in the title on to the note, with no newline saved', async () => {
    renderForm();
    fireEvent.press(screen.getByText('運動'));
    const focus = jest.mocked(TextInput.prototype.focus);
    focus.mockClear();

    const title = screen.getByPlaceholderText('標題');
    expect(title.props.returnKeyType).toBe('next');
    expect(title.props.submitBehavior).toBe('submit');
    fireEvent.changeText(title, '晨跑');
    fireEvent(title, 'submitEditing');

    expect(focus.mock.contexts.at(-1)?.props.placeholder).toBe('備註（選填）');
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });
    expect(postedEntry()?.content).toBe(encodeContent({ title: '晨跑', note: '' }));
  });

  it('saves a pasted title with spaces where its line breaks were', async () => {
    renderForm();
    fireEvent.press(screen.getByText('運動'));

    fireEvent.changeText(screen.getByPlaceholderText('標題'), '晨跑\n河濱\r\n十公里');
    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
    });

    expect(postedEntry()?.content).toBe(
      encodeContent({ title: '晨跑 河濱 十公里', note: '' }),
    );
  });

  // The two heights below read the field's style rather than the screen,
  // the same departure from #45's testing rule expectSingleLineField makes:
  // jest lays out no text, so nothing here can see a line wrap or a field
  // scroll. A height in lines is the line box times the count, plus the
  // field's own padding. The device checks are EF.22, EF.52 and KB.10.
  const linesTall = (style: TextStyle, lines: number) =>
    lines * Number(style.lineHeight) + Number(style.paddingTop) + Number(style.paddingBottom);

  it('opens the note five lines tall, and it scrolls rather than grows past that', () => {
    renderForm();
    fireEvent.press(screen.getByText('運動'));

    const note = screen.getByPlaceholderText('備註（選填）');
    const style = StyleSheet.flatten(note.props.style);
    expect(style.minHeight).toBe(linesTall(style, 5));
    expect(style.maxHeight).toBe(linesTall(style, 5));
    expect(note.props.scrollEnabled).not.toBe(false);
  });

  it('starts the title at one line, at the hit target, and grows it to three before it scrolls', () => {
    renderForm();
    fireEvent.press(screen.getByText('運動'));

    const title = screen.getByPlaceholderText('標題');
    const style = StyleSheet.flatten(title.props.style);
    expect(style.height).toBeUndefined();
    expect(style.minHeight).toBe(linesTall(style, 1));
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(style.maxHeight).toBe(linesTall(style, 3));
    expect(title.props.scrollEnabled).not.toBe(false);
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

  describe('attaching from the library (#87)', () => {
    // These spies would otherwise outlive their tests: a later add-tile press
    // would silently pick the library, and Alert would stay stubbed.
    afterEach(() => {
      jest.restoreAllMocks();
      jest.mocked(processPhoto).mockReset();
      jest.mocked(ImagePicker.launchImageLibraryAsync).mockReset();
    });

    const pressAddFromLibrary = async () => {
      jest
        .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
        .mockImplementation((_options, choose) => choose(1));
      // A new Entry opens on its category step; the photo grid follows it.
      fireEvent.press(screen.getByText('運動'));
      await act(async () => {
        fireEvent.press(screen.getByTestId('grid-item-__add__'));
      });
    };
    const pickFromLibrary = async (uris: string[]) => {
      jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
        canceled: false,
        assets: uris.map((uri) => ({ uri, width: 6048, height: 8064 })),
      } as ImagePicker.ImagePickerResult);
      await pressAddFromLibrary();
    };

    it('says so when a photo cannot be added, rather than doing nothing', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      jest.mocked(processPhoto).mockRejectedValue(new Error('ImageContextLostException'));
      renderForm();

      await pickFromLibrary(['file:///IMG_3630.HEIC']);

      expect(alert).toHaveBeenCalledWith('無法加入照片');
      expect(screen.getByText('0/3')).toBeTruthy();
    });

    it('still attaches the photos that worked when one in the batch fails', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      jest.mocked(processPhoto).mockImplementation(async (asset) => {
        if (asset.uri.includes('bad')) throw new Error('ImageContextLostException');
        return { fullUri: `${asset.uri}.full`, thumbUri: `${asset.uri}.thumb` };
      });
      renderForm();

      await pickFromLibrary(['file:///good.heic', 'file:///bad.heic']);

      expect(screen.getByText('1/3')).toBeTruthy();
      expect(alert).toHaveBeenCalledWith('無法加入照片');
    });

    it('says so when the picker itself fails', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      jest.mocked(ImagePicker.launchImageLibraryAsync).mockRejectedValue(new Error('picker failed'));
      renderForm();

      await pressAddFromLibrary();

      expect(alert).toHaveBeenCalledWith('無法加入照片');
    });
  });

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
    expect(onDone).toHaveBeenCalledWith(true, '2026-08-17');
  });

  it('saves once when 儲存 is pressed twice inside one render pass', async () => {
    renderForm({ draft: draftWith(1) });

    await act(async () => {
      fireEvent.press(screen.getByText('儲存'));
      fireEvent.press(screen.getByText('儲存'));
    });

    expect(api.entryPosts()).toHaveLength(1);
  });

  // The PM tapped to see which photo they'd picked and lost it: a tap now
  // shows the photo, and only its ✕ removes it (#118).
  describe('tapping and removing (#118)', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const savedEntry = (count: number) => ({
      id: 'e1',
      date: '2026-08-17',
      position: 1,
      categoryId: 'c-sport',
      authorId: 'u1',
      content: encodeContent({ title: '拍照', note: '' }),
      photos: savedPhotos(count),
    });
    // The original the viewer opened on: the pager starts at the tapped index.
    const openedOn = () => {
      const pager = screen.getByTestId('photo-viewer-pager');
      return pager.props.data[pager.props.initialScrollIndex].uri;
    };

    it('opens the viewer on a tapped saved photo and removes nothing', () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      renderForm({ entry: savedEntry(3) });

      fireEvent.press(screen.getByTestId('grid-item-photo:p1'));

      expect(screen.getByLabelText('關閉')).toBeTruthy();
      expect(screen.getByText('2 / 3')).toBeTruthy();
      // The original, not the grid's thumbnail.
      expect(openedOn()).toBe('https://store/1.jpg');
      expect(alert).not.toHaveBeenCalled();
      expect(api.find('DELETE', '/photos/')).toBeUndefined();
      expect(screen.getByTestId('grid-item-photo:p1')).toBeTruthy();
    });

    it('opens the viewer on a tapped staged photo, counted after the saved ones', () => {
      renderForm({ entry: savedEntry(1), draft: { ...draftWith(2), entryId: 'e1' } });

      fireEvent.press(screen.getByTestId('grid-item-staged:1'));

      expect(screen.getByText('3 / 3')).toBeTruthy();
      expect(openedOn()).toBe('file:///1.jpg');
      expect(screen.getByTestId('grid-item-staged:1')).toBeTruthy();
    });

    it('opens the photo on the tapped tile after a drag reorder', async () => {
      renderForm({ draft: draftWith(3) });

      const grid = (globalThis as { __mockGridState?: { onDragRelease?: (data: { key: string }[]) => void } })
        .__mockGridState!;
      await act(async () => {
        grid.onDragRelease!([{ key: 'staged:2' }, { key: 'staged:0' }, { key: 'staged:1' }]);
      });
      // file:///0.jpg now sits second.
      fireEvent.press(screen.getByTestId('grid-item-staged:1'));

      expect(screen.getByText('2 / 3')).toBeTruthy();
      expect(openedOn()).toBe('file:///0.jpg');
    });

    it('removes a saved photo from its ✕ after the confirmation', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      renderForm({ entry: savedEntry(2) });

      fireEvent.press(within(screen.getByTestId('grid-item-photo:p1')).getByLabelText('移除'));

      expect(screen.queryByLabelText('關閉')).toBeNull();
      expect(alert).toHaveBeenCalledWith('移除這張照片？', undefined, expect.any(Array));
      expect(api.find('DELETE', '/photos/')).toBeUndefined();
      const buttons = alert.mock.calls[0][2]!;
      await act(async () => {
        buttons.find((b) => b.text === '移除')!.onPress!();
      });
      expect(api.find('DELETE', '/photos/p1')).toBeTruthy();
      expect(screen.queryByTestId('grid-item-photo:p1')).toBeNull();
      expect(screen.getByTestId('grid-item-photo:p0')).toBeTruthy();
    });

    it('removes a staged photo from its ✕ at once, with no confirmation', () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      renderForm({ draft: draftWith(2) });

      fireEvent.press(within(screen.getByTestId('grid-item-staged:0')).getByLabelText('移除'));

      expect(alert).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('關閉')).toBeNull();
      expect(screen.getByText('1/3')).toBeTruthy();
      // The one left is the second photo.
      fireEvent.press(screen.getByTestId('grid-item-staged:0'));
      expect(openedOn()).toBe('file:///1.jpg');
    });

    // Reads the ✕'s size and slop rather than touching around it, the same
    // departure from #45's testing rule expectSingleLineField makes: jest
    // has no hit-testing, so this only stops the numbers shrinking. Whether
    // a real tap lands is EF.49, on a device.
    it('gives each ✕ a hit target of at least 44pt', () => {
      renderForm({ entry: savedEntry(1), draft: { ...draftWith(1), entryId: 'e1' } });

      const removes = screen.getAllByLabelText('移除');
      expect(removes).toHaveLength(2);
      for (const remove of removes) {
        const { width, height } = StyleSheet.flatten(remove.props.style);
        const slop = remove.props.hitSlop;
        expect(width + slop.left + slop.right).toBeGreaterThanOrEqual(44);
        expect(height + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
      }
    });
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
