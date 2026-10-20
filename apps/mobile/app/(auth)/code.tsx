import { layout, space } from '@workspace/tokens';
import { Button, CodeInput, Text } from '@workspace/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { sendEmailCode, verifyEmailCode, type AuthErrorKind, type AuthFlow } from '../../src/auth/email-code';
import { AUTH_ERROR_KEY } from '../../src/auth/messages';
import { useEmailCodeClient } from '../../src/auth/useEmailCodeClient';

const RESEND_AFTER_S = 45;

/** C3 · Code, C4 · Vérification, C5 · Code faux. The session opens as soon as the 6th digit is right. */
export default function CodeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const client = useEmailCodeClient();
  const { email = '', flow = 'signIn' } = useLocalSearchParams<{ email?: string; flow?: AuthFlow }>();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<AuthErrorKind | null>(null);
  const [wait, setWait] = useState(RESEND_AFTER_S);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => {
      setWait((s) => s - 1);
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [wait]);

  const onChange = (digits: string) => {
    setCode(digits);
    setError(null);
    if (digits.length === 6) {
      setVerifying(true);
      void verifyEmailCode(client, flow, digits).then((result) => {
        setVerifying(false);
        if (!result.ok) {
          setError(result.kind);
          setCode('');
        }
      });
    }
  };

  const resend = async () => {
    setWait(RESEND_AFTER_S);
    setError(null);
    const result = await sendEmailCode(client, email);
    if (!result.ok) setError(result.kind);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      <Text variant="largeTitle" accessibilityRole="header">
        {t('auth.code.title')}
      </Text>
      <Text tone="secondary">{t('auth.code.sentTo', { email })}</Text>
      <View style={styles.start}>
        <Button
          kind="tertiary"
          label={t('auth.code.changeEmail')}
          onPress={() => {
            router.back();
          }}
          disabled={verifying}
        />
      </View>
      <CodeInput
        label={t('auth.code.label')}
        value={code}
        onChangeText={onChange}
        disabled={verifying}
        autoFocus
        {...(error ? { error: t(AUTH_ERROR_KEY[error]) } : {})}
      />
      {verifying ? (
        <View
          style={styles.row}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={t('auth.code.verifying')}
        >
          <ActivityIndicator />
          <Text>{t('auth.code.verifying')}</Text>
        </View>
      ) : (
        <>
          {!error ? (
            <Text variant="footnote" tone="secondary">
              {t('auth.code.spam')}
            </Text>
          ) : null}
          <View style={styles.start}>
            <Button
              kind="tertiary"
              label={wait > 0 ? t('auth.code.resendIn', { seconds: wait }) : t('auth.code.resend')}
              onPress={() => void resend()}
              disabled={wait > 0}
              testID="auth-resend"
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: layout.margin, gap: space[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  start: { alignSelf: 'flex-start' },
});
