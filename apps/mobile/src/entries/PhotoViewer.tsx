import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Animated, FlatList, Image, Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { createStyles, theme } from '../theme';

export type ViewerPhoto = {
  key: string;
  /** The original: a saved Photo's signed url, or a staged photo's local copy. */
  uri: string;
  /** A saved Photo's thumbnail, shown beneath the original until it loads. */
  thumbUri?: string;
};

type Props = {
  photos: ViewerPhoto[];
  /** The photo that was tapped. */
  startIndex: number;
  onClose: () => void;
};

// How far a downward drag has to travel before letting go closes the viewer;
// short of it the photo springs back.
const DISMISS_DISTANCE = 120;

// The full-screen photo viewer (#114), shared by the Entry form and the Entry
// view: on black like the Photos app, one photo per page, nothing that edits.
export function PhotoViewer({ photos, startIndex, onClose }: Props) {
  const strings = useStrings();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(startIndex);
  // The photo follows a downward drag while the black thins out, the way
  // the Photos app lets you pull a photo away.
  const [dragY] = useState(() => new Animated.Value(0));
  const backdropOpacity = dragY.interpolate({
    inputRange: [0, height],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Vertical only: a horizontal swipe fails this and pages the list instead.
  const dismiss = Gesture.Pan()
    .runOnJS(true)
    .withTestId('photo-viewer-dismiss')
    .activeOffsetY(15)
    .failOffsetX([-15, 15])
    .onUpdate((e) => dragY.setValue(Math.max(0, e.translationY)))
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE) {
        onClose();
      } else {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
      }
    });

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      {/* A Modal is its own root: gestures inside need their own handler root. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]} />
        <GestureDetector gesture={dismiss}>
          <Animated.View style={[styles.root, { transform: [{ translateY: dragY }] }]}>
            <FlatList
              testID="photo-viewer-pager"
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={startIndex}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
              keyExtractor={(photo) => photo.key}
              renderItem={({ item }) => (
                <View style={{ width, height }}>
                  {item.thumbUri ? (
                    <Image
                      testID="photo-viewer-thumb"
                      source={{ uri: item.thumbUri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="contain"
                    />
                  ) : null}
                  <Image
                    testID="photo-viewer-original"
                    source={{ uri: item.uri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="contain"
                  />
                </View>
              )}
            />
          </Animated.View>
        </GestureDetector>
        <SafeAreaView edges={['top']} style={styles.bar} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={strings.photos.close}
            style={styles.close}
            onPress={onClose}
          >
            <X size={24} color={theme.colors.textOnDark} strokeWidth={2} />
          </Pressable>
          {photos.length > 1 ? (
            // Spans the bar to centre on the screen, so it must not take the ✕'s taps.
            <View style={styles.counterHolder} pointerEvents="none">
              <Text style={styles.counter}>{`${index + 1} / ${photos.length}`}</Text>
            </View>
          ) : null}
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = createStyles((t) => ({
  root: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: t.colors.surfacePhoto,
  },
  // Over the photo, not above it: the photo keeps the whole screen.
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: t.spacing.screenGutter,
  },
  close: {
    width: t.spacing.hitMin,
    height: t.spacing.hitMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Centred on the screen rather than in the space beside the ✕.
  counterHolder: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: t.spacing.hitMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    ...t.typography.sectionHeader,
    color: t.colors.textOnDark,
  },
}));
