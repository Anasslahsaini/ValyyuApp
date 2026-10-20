import { app } from '@workspace/config';
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: app.name,
  slug: app.slug,
  scheme: app.scheme,
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: { bundleIdentifier: app.iosBundleId, supportsTablet: false },
  android: { package: app.androidPackage },
  plugins: ['expo-router', 'expo-localization'],
};

export default config;
