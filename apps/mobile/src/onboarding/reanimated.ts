// Page 4's one door to react-native-reanimated (#158). Jest cannot load
// reanimated's native worklets runtime, so jest.setup.js stands this module
// in and leaves reanimated itself unloadable there, as it always was:
// react-native-gesture-handler probes for reanimated and must keep finding it
// absent in tests.
export { default as Animated, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
