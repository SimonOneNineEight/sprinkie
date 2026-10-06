import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { installMockApi, type MockApi } from '../testing/mockApi';
import { ColorDrawer } from './ColorDrawer';

let api: MockApi;

beforeEach(() => {
  api = installMockApi();
});

afterEach(() => {
  api.restore();
});

async function renderDrawer() {
  const onConfirm = jest.fn();
  render(
    <ColorDrawer
      accessToken="tok"
      initialColor="#73B062"
      existingColors={['#4A93C4']}
      onCancel={jest.fn()}
      onConfirm={onConfirm}
    />,
  );
  await act(async () => {});
  return onConfirm;
}

describe('tappable hex readout (#29)', () => {
  it('jumps the picker to a typed or pasted hex, with or without #', async () => {
    const onConfirm = await renderDrawer();

    fireEvent.press(screen.getByText('#73B062'));
    fireEvent.changeText(screen.getByTestId('hex-input'), '4A90D9');
    expect(screen.getAllByTestId('preview-dot-chosen')[0]).toHaveStyle({
      backgroundColor: '#4A90D9',
    });

    fireEvent.changeText(screen.getByTestId('hex-input'), '#D35400');
    expect(screen.getAllByTestId('preview-dot-chosen')[0]).toHaveStyle({
      backgroundColor: '#D35400',
    });

    fireEvent.press(screen.getByText('完成'));
    expect(onConfirm).toHaveBeenCalledWith('#D35400');
  });

  it('leaves state untouched for invalid strings', async () => {
    await renderDrawer();

    fireEvent.press(screen.getByText('#73B062'));
    fireEvent.changeText(screen.getByTestId('hex-input'), 'zzzzzz');
    fireEvent.changeText(screen.getByTestId('hex-input'), '4A90');
    expect(screen.getAllByTestId('preview-dot-chosen')[0]).toHaveStyle({
      backgroundColor: '#73B062',
    });
  });

  it('stops the field at a length a hex can still be', async () => {
    await renderDrawer();

    fireEvent.press(screen.getByText('#73B062'));
    // Six digits plus the optional #. Past that every character can only fail
    // the match, so the field would silently stop responding instead.
    expect(screen.getByTestId('hex-input').props.maxLength).toBe(7);
  });
});
