import { useSSO } from '@clerk/expo/experimental';
import { layout, space } from '@workspace/tokens';
import { Banner, Button, Text } from '@workspace/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { authErrorKind } from '../../src/auth/email-code';
import { AUTH_ERROR_KEY } from '../../src/auth/messages';
import { Logo } from '../../src/components/Logo';

/** C1 · Bienvenue. Apple waits for the native build (Expo Go cannot sign in with Apple). */
export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();
  const { startSSOFlow } = useSSO();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const google = async () => {
    setBusy(true);
    setError(null);
    try {
      await startSSOFlow({ strategy: 'oauth_google' });
    } catch (e) {
      const kind = authErrorKind(e);
      if ((e as { code?: string }).code !== 'ERR_REQUEST_CANCELED')
        setError(t(AUTH_ERROR_KEY[kind === 'unknown' ? 'network' : kind]));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Logo />
      <View style={styles.hero}>
        <Text variant="largeTitle" accessibilityRole="header">
          {t('auth.welcome.title')}
        </Text>
        <Text tone="secondary">{t('auth.welcome.subtitle')}</Text>
      </View>
      {error ? <Banner tone="danger" title={error} /> : null}
      <View style={styles.actions}>
        <Button
          kind="primary"
          label={t('auth.welcome.apple')}
          onPress={() => undefined}
          disabled
          testID="auth-apple"
        />
        <Text variant="footnote" tone="secondary">
          {t('auth.welcome.appleSoon')}
        </Text>
        <Button
          kind="secondary"
          label={t('auth.welcome.google')}
          onPress={() => void google()}
          loading={busy}
          testID="auth-google"
        />
        <Button
          kind="secondary"
          label={t('auth.welcome.email')}
          onPress={() => {
            router.push('/email');
          }}
          testID="auth-email"
        />
        <Button kind="tertiary" label={t('auth.welcome.phoneLater')} onPress={() => undefined} disabled />
      </View>
      <Text variant="footnote" tone="secondary" align="center">
        {t('auth.welcome.legal')}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: layout.margin, paddingTop: space[12], gap: layout.gapSection, flexGrow: 1 },
  hero: { gap: space[3], marginTop: space[10] },
  actions: { gap: space[3], marginTop: 'auto' },
});
