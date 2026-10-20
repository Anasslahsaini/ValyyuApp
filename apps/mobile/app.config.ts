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
  plugins: [
    'expo-router',
    'expo-localization',
    [
      'expo-image-picker',
      {
        // System prompts (development and store builds; Expo Go shows its own). Localized per language later.
        cameraPermission: `${app.name} utilise l'appareil photo pour photographier tes vêtements.`,
        photosPermission: `${app.name} utilise tes photos pour ajouter tes vêtements.`,
        microphonePermission: false,
      },
    ],
  ],
};

export default config;
