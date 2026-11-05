import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import { expectSingleLineField } from '../testing/expectSingleLineField';
import { installMockApi, type MockApi } from '../testing/mockApi';
import { theme } from '../theme';

import { CategoryEditorSheet } from './CategoryEditorSheet';

const sport = { id: 'c-sport', name: '運動', color: '#73B062', icon: 'dumbbell', position: 1 };

function renderEditor(
  parentChoices: (typeof sport)[] = [],
  editing: Pick<React.ComponentProps<typeof CategoryEditorSheet>, 'target' | 'parent'> = {},
) {
  return render(
    <CategoryEditorSheet
      accessToken="tok"
      {...editing}
      parentChoices={parentChoices}
      childrenOfTarget={[]}
      onOpen={jest.fn()}
      onClose={jest.fn()}
      onCategoriesChanged={jest.fn()}
    />,
  );
}

/** The color the cell's glyph renders in, as the swatch suite reads its dot. */
function glyphColorOf(cell: { children: (string | { props?: { color?: string } })[] }) {
  const glyph = cell.children[0];
  return typeof glyph === 'string' ? undefined : glyph.props?.color;
}

describe('parent list accordion', () => {
  it('swaps the summary row for the option list while open', () => {
    renderEditor([sport]);

    // Closed: the summary row with its hint.
    expect(screen.getByText('獨立類別')).toBeTruthy();
    fireEvent.press(screen.getByText('無'));

    // Open: the options replace the summary — nothing shows twice.
    expect(screen.queryByText('獨立類別')).toBeNull();
    fireEvent.press(screen.getByText('運動'));

    // Picked and collapsed: the summary carries the choice, hint flips.
    expect(screen.getByText('運動')).toBeTruthy();
    expect(screen.getByText('子類別')).toBeTruthy();
    expect(screen.queryByText('無')).toBeNull();
  });
});

describe('keyboard dismissal (#31)', () => {
  it('dismisses on name-field submit', () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    renderEditor();

    fireEvent(screen.getByPlaceholderText('名稱'), 'submitEditing');
    expect(dismiss).toHaveBeenCalled();
    dismiss.mockRestore();
  });

  it('dismisses on a tap outside the field', () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    renderEditor();

    fireEvent.press(screen.getByTestId('editor-body'));
    expect(dismiss).toHaveBeenCalled();
    dismiss.mockRestore();
  });
});

describe('single-line fields (#42)', () => {
  it('sizes the name field for CJK, at the hit target', () => {
    renderEditor();

    expectSingleLineField('名稱');
  });
});

describe('the chosen icon (#46)', () => {
  it('fills the selected cell with the chosen Category color', () => {
    renderEditor();

    fireEvent.press(screen.getByLabelText('blue'));
    fireEvent.press(screen.getByLabelText('bike'));

    expect(screen.getByLabelText('bike')).toHaveStyle({ backgroundColor: '#4A93C4' });
    expect(glyphColorOf(screen.getByLabelText('bike'))).toBe('#FFFFFF');

    // Every other cell keeps the plain treatment.
    expect(screen.getByLabelText('dumbbell')).toHaveStyle({
      backgroundColor: theme.colors.surfaceFill,
    });
    expect(glyphColorOf(screen.getByLabelText('dumbbell'))).toBe(theme.colors.iconDefault);
  });

  it('restyles the selected cell when the color changes, with no re-selection', () => {
    renderEditor();

    fireEvent.press(screen.getByLabelText('bike'));
    fireEvent.press(screen.getByLabelText('violet'));

    expect(screen.getByLabelText('bike')).toHaveStyle({ backgroundColor: '#A26FBD' });
  });

  it("fills the inherited icon in the parent's color while the block is disabled", () => {
    renderEditor([sport]);

    fireEvent.press(screen.getByText('無'));
    fireEvent.press(screen.getByText('運動'));

    // A Subcategory inherits 運動's dumbbell and its green, and the dimmed
    // appearance block still has to say which glyph that is.
    expect(screen.getByText('子類別沿用上層分類的圖示與顏色。')).toBeTruthy();
    expect(screen.getByLabelText('dumbbell')).toHaveStyle({ backgroundColor: '#73B062' });
  });
});

// The manual pass's cases that need no device (#109).
describe('the manual pass, without a device (#109)', () => {
  let api: MockApi;
  beforeEach(() => {
    api = installMockApi();
  });
  afterEach(() => {
    api.restore();
  });

  const save = () => screen.getByRole('button', { name: '儲存' });
  const categoryPosts = () =>
    api.calls().filter(([u, init]) => String(u).includes('/categories') && init?.method === 'POST');

  // CE.3
  it('disables 儲存 while the name is empty', async () => {
    renderEditor();

    expect(save()).toBeDisabled();
    fireEvent.changeText(screen.getByPlaceholderText('名稱'), '   ');
    expect(save()).toBeDisabled();
    await act(async () => {
      fireEvent.press(save());
    });
    expect(categoryPosts()).toEqual([]);

    fireEvent.changeText(screen.getByPlaceholderText('名稱'), '園藝');
    expect(save()).toBeEnabled();
  });

  // CE.6
  it('collapses back to an independent Category when 無 is picked', async () => {
    renderEditor([sport]);
    fireEvent.changeText(screen.getByPlaceholderText('名稱'), '園藝');
    fireEvent.press(screen.getByText('無'));
    fireEvent.press(screen.getByText('運動'));
    expect(screen.getByText('子類別沿用上層分類的圖示與顏色。')).toBeTruthy();

    fireEvent.press(screen.getByText('運動'));
    fireEvent.press(screen.getByText('無'));

    // Collapsed to the summary row, which reads as a top-level Category again.
    expect(screen.getByText('無')).toBeTruthy();
    expect(screen.getByText('獨立類別')).toBeTruthy();
    expect(screen.queryByText('運動')).toBeNull();
    expect(screen.queryByText('子類別沿用上層分類的圖示與顏色。')).toBeNull();
    await act(async () => {
      fireEvent.press(save());
    });
    const body = JSON.parse(categoryPosts()[0]?.[1]?.body ?? '{}');
    expect(body.parentId).toBeUndefined();
    expect(body.icon).toBe('tag');
  });

  // CE.8
  it.each([
    ['a top-level Category', { ...sport }, undefined, '無'],
    [
      'a Subcategory',
      { id: 'c-gym', name: '健身房', color: '#73B062', icon: 'tag', position: 1, parentId: 'c-sport' },
      sport,
      '運動',
    ],
  ])('keeps the parent row untappable while editing %s', (_, target, parent, shown) => {
    renderEditor(
      [sport, { id: 'c-food', name: '美食', color: '#D3AE40', icon: 'utensils', position: 2 }],
      { target, parent },
    );

    const row = screen.getByRole('button', { name: new RegExp(`^${shown}`) });
    expect(row).toBeDisabled();
    fireEvent.press(row);
    // No option list: 美食 is offered only when the list opens.
    expect(screen.queryByText('美食')).toBeNull();
    expect(screen.getByText(shown)).toBeTruthy();
  });
});
