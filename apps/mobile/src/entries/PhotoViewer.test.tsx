// The viewer holds its own gesture root inside the Modal; that root asks the
// native module to install, which jest only has once the library's setup runs.
import 'react-native-gesture-handler/jestSetup';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { PhotoViewer } from './PhotoViewer';

// Its own SafeAreaProvider too, which waits on native metrics jest never
// sends; the library's mock hands them over at once.
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

const { width } = Dimensions.get('window');

const saved = (n: number) => ({
  key: `photo:p${n}`,
  uri: `https://storage.example/p${n}.jpg`,
  thumbUri: `https://storage.example/p${n}-thumb.jpg`,
});

it('opens on the photo that was tapped', () => {
  render(<PhotoViewer photos={[saved(1), saved(2), saved(3)]} startIndex={1} onClose={jest.fn()} />);

  expect(screen.getByText('2 / 3')).toBeTruthy();
  expect(screen.getByTestId('photo-viewer-pager').props.initialScrollIndex).toBe(1);
});

it('counts along as the pager settles on another photo', () => {
  render(<PhotoViewer photos={[saved(1), saved(2), saved(3)]} startIndex={0} onClose={jest.fn()} />);

  fireEvent(screen.getByTestId('photo-viewer-pager'), 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x: 2 * width } },
  });

  expect(screen.getByText('3 / 3')).toBeTruthy();
});

it('shows no counter for a lone photo', () => {
  render(<PhotoViewer photos={[saved(1)]} startIndex={0} onClose={jest.fn()} />);

  expect(screen.queryByText('1 / 1')).toBeNull();
});

it('closes from the ✕', () => {
  const onClose = jest.fn();
  render(<PhotoViewer photos={[saved(1)]} startIndex={0} onClose={onClose} />);

  fireEvent.press(screen.getByLabelText('關閉'));

  expect(onClose).toHaveBeenCalled();
});

const swipeDown = (translationY: number) =>
  fireGestureHandler(getByGestureTestId('photo-viewer-dismiss'), [
    { state: State.BEGAN, translationY: 0 },
    { state: State.ACTIVE, translationY },
    { state: State.END, translationY },
  ]);

it('closes on a swipe down that travels far enough', () => {
  const onClose = jest.fn();
  render(<PhotoViewer photos={[saved(1)]} startIndex={0} onClose={onClose} />);

  swipeDown(200);

  expect(onClose).toHaveBeenCalled();
});

it('stays open after a short swipe down', () => {
  const onClose = jest.fn();
  render(<PhotoViewer photos={[saved(1)]} startIndex={0} onClose={onClose} />);

  swipeDown(40);

  expect(onClose).not.toHaveBeenCalled();
});

it('lays the original over its thumbnail, so the thumbnail shows until it loads', () => {
  render(<PhotoViewer photos={[saved(1)]} startIndex={0} onClose={jest.fn()} />);

  expect(screen.getByTestId('photo-viewer-thumb').props.source).toEqual({ uri: saved(1).thumbUri });
  expect(screen.getByTestId('photo-viewer-original').props.source).toEqual({ uri: saved(1).uri });
});

it('shows a staged photo from its local copy alone', () => {
  const staged = { key: 'staged:0', uri: 'file:///tmp/staged-0.jpg' };
  render(<PhotoViewer photos={[staged]} startIndex={0} onClose={jest.fn()} />);

  expect(screen.queryByTestId('photo-viewer-thumb')).toBeNull();
  expect(screen.getByTestId('photo-viewer-original').props.source).toEqual({ uri: staged.uri });
});
