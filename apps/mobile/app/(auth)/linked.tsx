import { useSSO } from '@clerk/expo/experimental';
import { layout, space } from '@workspace/tokens';
import { Button, Card, Text } from '@workspace/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

/** C7 · Compte existant: this address signs in with Google. */
export default function Linked() {
  const { t } = useTranslation();
  const router = useRouter();
  const { startSSOFlow } = useSSO();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [busy, setBusy] = useState(false);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Text variant="largeTitle" accessibilityRole="header">
        {t('auth.linked.title')}
      </Text>
      <Text tone="secondary">{t('auth.linked.message', { email })}</Text>
      <Card>
        <Text variant="headline">{email}</Text>
        <Text variant="footnote" tone="secondary">
          {t('auth.linked.viaGoogle')}
        </Text>
      </Card>
      <Button
        label={t('auth.welcome.google')}
        loading={busy}
        onPress={() => {
          setBusy(true);
          void startSSOFlow({ strategy: 'oauth_google', oidcLoginHint: email })
            .catch(() => undefined)
            .finally(() => {
              setBusy(false);
            });
        }}
      />
      <Button
        kind="tertiary"
        label={t('auth.linked.useEmail')}
        onPress={() => {
          router.back();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: layout.margin, gap: space[4] } });
