// Reanimated 4 needs its native worklets runtime; tests only need the screens, not the motion.
// Mapped from 'react-native-reanimated' (through reanimated-entry.js) and from its '/mock'.
const { ScrollView, Text, View } = require('react-native');

const animation = new Proxy({}, { get: () => () => animation });

module.exports = {
  __esModule: true,
  default: { View, Text, ScrollView, createAnimatedComponent: (component) => component, call: () => {} },
  FadeIn: animation,
  FadeInDown: animation,
  ZoomIn: animation,
  LinearTransition: animation,
};
