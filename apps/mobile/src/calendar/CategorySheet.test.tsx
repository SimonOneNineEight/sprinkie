import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, StyleSheet } from 'react-native';

import { cat } from '../testing/fixtures';
import { installMockApi, type MockApi } from '../testing/mockApi';
import { CategorySheet } from './CategorySheet';
import { nothingHidden } from './hidden';

const categories = [
  { ...cat.work, inUse: true, hasChildren: false },
  { ...cat.sport, inUse: false, hasChildren: true },
  { ...cat.gym, inUse: false, hasChildren: false },
  { ...cat.food, inUse: false, hasChildren: false },
];

let api: MockApi;

beforeEach(() => {
  api = installMockApi({ colorRecents: ['#123456'] });
});

afterEach(() => {
  api.restore();
});

function renderSheet(overrides: Partial<React.ComponentProps<typeof CategorySheet>> = {}) {
  const onChange = jest.fn();
  const onCategoriesChanged = jest.fn();
  render(
    <CategorySheet
      accessToken="tok"
      categories={categories}
      hidden={nothingHidden}
      onChange={onChange}
      onCategoriesChanged={onCategoriesChanged}
      onClose={jest.fn()}
      {...overrides}
    />,
  );
  return { onChange, onCategoriesChanged };
}

it('splits each row into a visibility zone and an edit zone (#30)', () => {
  const { onChange } = renderSheet();

  // Tapping a parent row is the family master switch: the whole family
  // hides together. Tapping ✎ opens the editor instead.
  fireEvent.press(screen.getByText('運動'));
  expect(onChange).toHaveBeenCalledWith({
    categoryIds: ['c-sport'],
    subcategoryIds: ['c-gym'],
  });

  fireEvent.press(screen.getAllByLabelText('編輯類別')[1]);
  expect(screen.getByDisplayValue('運動')).toBeTruthy();
  expect(onChange).toHaveBeenCalledTimes(1);
});

it('a subcategory row toggles only itself (#30)', () => {
  const { onChange } = renderSheet();

  fireEvent.press(screen.getByText('健身房'));
  expect(onChange).toHaveBeenCalledWith({ categoryIds: [], subcategoryIds: ['c-gym'] });
});

it('the header toggle flips between 全部隱藏 and 全部顯示 (#30)', () => {
  const { onChange } = renderSheet();

  fireEvent.press(screen.getByText('全部隱藏'));
  expect(onChange).toHaveBeenCalledWith({
    categoryIds: ['c-work', 'c-sport', 'c-food'],
    subcategoryIds: ['c-gym'],
  });

  render(
    <CategorySheet
      accessToken="tok"
      categories={categories}
      hidden={{ categoryIds: ['c-work', 'c-sport', 'c-food'], subcategoryIds: ['c-gym'] }}
      onChange={onChange}
      onCategoriesChanged={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  fireEvent.press(screen.getByText('全部顯示'));
  expect(onChange).toHaveBeenLastCalledWith(nothingHidden);
});

it('renames a category through the row editor', async () => {
  const { onCategoriesChanged } = renderSheet();

  fireEvent.press(screen.getAllByLabelText('編輯類別')[1]);
  fireEvent.changeText(screen.getByDisplayValue('運動'), '健身');
  await act(async () => {
    fireEvent.press(screen.getByText('儲存'));
  });

  const patch = (globalThis.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'PATCH');
  expect(String(patch?.[0])).toContain('/categories/c-sport');
  expect(JSON.parse(patch?.[1]?.body ?? '{}')).toEqual({ name: '健身' });
  expect(onCategoriesChanged).toHaveBeenCalled();
});

it('edits a subcategory from its expanded row with sections disabled', () => {
  renderSheet();

  // Subcategories are always visible (Apple's always-expanded list); the
  // 健身房 row sits right under 運動.
  const editButtons = screen.getAllByLabelText('編輯類別');
  fireEvent.press(editButtons[2]);
  expect(screen.getByDisplayValue('健身房')).toBeTruthy();
  expect(screen.getByText('子類別沿用上層分類的圖示與顏色。')).toBeTruthy();
});

it('deletes an unused category after confirmation', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert');
  renderSheet();

  const editButtons = screen.getAllByLabelText('編輯類別');
  fireEvent.press(editButtons[editButtons.length - 1]); // 美食
  fireEvent.press(screen.getByText('刪除類別'));
  const buttons = alertSpy.mock.calls[0][2] ?? [];
  const destructive = buttons.find((b) => b.style === 'destructive');
  await act(async () => {
    destructive?.onPress?.();
  });

  const del = (globalThis.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'DELETE');
  expect(String(del?.[0])).toContain('/categories/c-food');
  alertSpy.mockRestore();
});

it('creates from the 新增類別 row with the icon in one call', async () => {
  renderSheet();

  fireEvent.press(screen.getByText('新增類別'));
  fireEvent.changeText(screen.getByPlaceholderText('名稱'), '園藝');
  await act(async () => {
    fireEvent.press(screen.getByText('儲存'));
  });

  const post = (globalThis.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'POST');
  const body = JSON.parse(post?.[1]?.body ?? '{}');
  expect(body.name).toBe('園藝');
  expect(body.icon).toBe('tag');
});

it('saves a custom color to the recents only once the category persists', async () => {
  renderSheet();

  const editButtons = screen.getAllByLabelText('編輯類別');
  fireEvent.press(editButtons[editButtons.length - 1]); // 美食
  fireEvent.press(screen.getByLabelText('自訂顏色'));
  fireEvent.press(await screen.findByLabelText('#123456'));
  await act(async () => {
    // The sheet's own 完成 is also on screen; the drawer's renders last.
    const confirms = screen.getAllByText('完成');
    fireEvent.press(confirms[confirms.length - 1]);
  });
  expect(
    (globalThis.fetch as jest.Mock).mock.calls.find(
      ([url, init]) => String(url).includes('/color-recents') && init?.method === 'PUT',
    ),
  ).toBeUndefined();

  await act(async () => {
    fireEvent.press(screen.getByText('儲存'));
  });
  const put = (globalThis.fetch as jest.Mock).mock.calls.find(
    ([url, init]) => String(url).includes('/color-recents') && init?.method === 'PUT',
  );
  expect(JSON.parse(put?.[1]?.body ?? '{}')).toEqual({ color: '#123456' });
});

it('creates a subcategory by picking a parent in the editor', async () => {
  renderSheet();

  fireEvent.press(screen.getByText('新增類別'));
  fireEvent.changeText(screen.getByPlaceholderText('名稱'), '游泳');
  fireEvent.press(screen.getByText('無'));
  const options = screen.getAllByText('運動');
  fireEvent.press(options[options.length - 1]);
  await act(async () => {
    fireEvent.press(screen.getByText('儲存'));
  });

  const post = (globalThis.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'POST');
  expect(JSON.parse(post?.[1]?.body ?? '{}')).toEqual({
    name: '游泳',
    color: '#73B062',
    parentId: 'c-sport',
  });
});

it('forgetting a Saved Color leaves the Category wearing it alone (#47)', async () => {
  // 工作 wears a custom color that 已存的顏色 also remembers.
  api.world.colorRecents = ['#AABB0C'];
  renderSheet({ categories: [{ ...cat.work, color: '#AABB0C', inUse: true, hasChildren: false }] });

  fireEvent.press(screen.getByLabelText('編輯類別'));
  fireEvent.press(screen.getByLabelText('自訂顏色'));
  await act(async () => {});
  const alertSpy = jest.spyOn(Alert, 'alert');
  fireEvent(screen.getByLabelText('#AABB0C'), 'longPress');
  const buttons = alertSpy.mock.calls[0][2] ?? [];
  await act(async () => {
    buttons.find((b) => b.style === 'destructive')?.onPress?.();
  });
  alertSpy.mockRestore();
  // The whole row leaves with the last color it held.
  expect(screen.queryByText('已存的顏色')).toBeNull();

  // Leaving the drawer with 完成 — the drawer's, not the sheet's — the
  // Category is still the color it was. A Saved Color is a memory of use,
  // not a possession (GLOSSARY.md, 2026-09-12): tidying the picker never
  // recolors the Journal.
  const dones = screen.getAllByText('完成');
  fireEvent.press(dones[dones.length - 1]);
  // The custom swatch paints the color the editor holds for the Category.
  const swatch = screen.getByLabelText('自訂顏色').children[0] as { props: { style?: unknown } };
  expect((StyleSheet.flatten(swatch.props.style) as { backgroundColor?: string }).backgroundColor).toBe(
    '#AABB0C',
  );
  const patch = (globalThis.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'PATCH');
  expect(patch).toBeUndefined();
});

// Search over both levels (#48). The sheet manages Subcategories, so a
// search that only saw top-level names could not find one by name.
describe('searching the sheet (#48)', () => {
  const yoga = { id: 'c-yoga', name: '瑜伽', color: '#73B062', icon: 'tag', position: 2, parentId: 'c-sport' };
  const withTwoChildren = [...categories, yoga];

  it('filters to a matching Category and drops the rest', () => {
    renderSheet();

    fireEvent.changeText(screen.getByPlaceholderText('搜尋類別'), '美食');

    expect(screen.getByText('美食')).toBeTruthy();
    expect(screen.queryByText('工作')).toBeNull();
    expect(screen.queryByText('運動')).toBeNull();
    expect(screen.queryByText('健身房')).toBeNull();
  });

  it('keeps a matched Subcategory under its parent, and drops its siblings', () => {
    renderSheet({ categories: withTwoChildren });

    fireEvent.changeText(screen.getByPlaceholderText('搜尋類別'), '健身');

    // 運動 stays as context even though its own name does not match.
    expect(screen.getByText('運動')).toBeTruthy();
    expect(screen.getByText('健身房')).toBeTruthy();
    expect(screen.queryByText('瑜伽')).toBeNull();
    expect(screen.queryByText('工作')).toBeNull();
  });

  it('still switches the whole family, including members the search hid', () => {
    const { onChange } = renderSheet({ categories: withTwoChildren });

    fireEvent.changeText(screen.getByPlaceholderText('搜尋類別'), '健身');
    fireEvent.press(screen.getByText('運動'));

    // 瑜伽 is off screen but still in the family: a master switch that only
    // acted on what the filter shows would leave it visible.
    expect(onChange).toHaveBeenCalledWith({
      categoryIds: ['c-sport'],
      subcategoryIds: ['c-gym', 'c-yoga'],
    });
  });

  it('does not carry the search text into a Subcategory raised from the editor', () => {
    renderSheet();

    fireEvent.changeText(screen.getByPlaceholderText('搜尋類別'), '運動');
    fireEvent.press(screen.getAllByLabelText('編輯類別')[0]);
    fireEvent.press(screen.getByText('新增子類別'));

    // A create raised inside the editor belongs to 運動, not to what was
    // typed into the sheet's search field.
    expect(screen.getByPlaceholderText('名稱').props.value).toBe('');
  });

  it('carries the typed name into 新增類別', () => {
    renderSheet();

    fireEvent.changeText(screen.getByPlaceholderText('搜尋類別'), '游泳');
    fireEvent.press(screen.getByText('新增類別'));

    // The editor's own name field, not the search field still holding it.
    expect(screen.getByPlaceholderText('名稱').props.value).toBe('游泳');
  });
});
