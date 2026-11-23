// react-native-keyboard-controller is a native module (#42): jest cannot load
// its TurboModule specs, so the library's own mock stands in. It renders
// KeyboardAwareScrollView as a plain ScrollView and KeyboardAvoidingView as a
// View, which is the honest shape — no test in this repo can see the keyboard.
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
// Page 4 folds its month with the keyboard through reanimated (#158), which
// jest cannot load. Its door, src/onboarding/reanimated.ts, runs here as plain
// values: no keyboard, nothing folds, as with the keyboard library above.
jest.mock('./src/onboarding/reanimated', () => {
  const { View } = require('react-native');
  return {
    Animated: { View },
    useSharedValue: (initial) => {
      let value = initial;
      return { get: () => value, set: (next) => (value = next) };
    },
    useAnimatedStyle: (style) => style(),
  };
});
