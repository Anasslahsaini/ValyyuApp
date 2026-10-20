import { layout, space } from '@workspace/tokens';
import { Banner, Button, Text, TextField } from '@workspace/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { sendEmailCode, type AuthErrorKind } from '../../src/auth/email-code';
import { AUTH_ERROR_KEY } from '../../src/auth/messages';
import { useEmailCodeClient } from '../../src/auth/useEmailCodeClient';

/** C2 · Saisie de l'e-mail, C6 · Pas de réseau, and the hand-off to C7 (account linked to Google). */
export default function EmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const client = useEmailCodeClient();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorKind | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await sendEmailCode(client, email);
    setBusy(false);
    if (result.ok) {
      router.push({ pathname: '/code', params: { email: email.trim().toLowerCase(), flow: result.flow } });
    } else if (result.kind === 'linked_google') {
      router.push({ pathname: '/linked', params: { email: email.trim().toLowerCase() } });
    } else {
      setError(result.kind);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      {error === 'network' ? (
        <Banner tone="danger" title={t('auth.offline.title')} message={t('auth.offline.message')} />
      ) : null}
      <Text variant="largeTitle" accessibilityRole="header">
        {t('auth.email.title')}
      </Text>
      <Text tone="secondary">{t('auth.email.subtitle')}</Text>
      <TextField
        label={t('auth.email.label')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        textContentType="emailAddress"
        {...(error && error !== 'network' ? { error: t(AUTH_ERROR_KEY[error]) } : {})}
        testID="auth-email-input"
      />
      <Button
        label={error === 'network' ? t('auth.offline.retry') : t('auth.email.submit')}
        onPress={() => void submit()}
        loading={busy}
        disabled={email.trim() === ''}
        testID="auth-email-submit"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: layout.margin, gap: space[4] } });
