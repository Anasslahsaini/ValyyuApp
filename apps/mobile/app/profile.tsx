import { useClerk, useUser } from '@clerk/expo';
import { color, layout, radius } from '@workspace/tokens';
import { Banner, Button, ListRow } from '@workspace/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { isDevBuild } from '../src/env';

/** Account: email, sign out, and in-app account deletion (App Store rule 5.1.1(v)). */
export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteAccount = () => {
    Alert.alert(t('profile.delete.title'), t('profile.delete.message'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.delete.confirm'),
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          setError(null);
          void (user?.delete() ?? Promise.resolve())
            .then(() => signOut())
            .catch(() => {
              setError(t('profile.delete.failed'));
            })
            .finally(() => {
              setBusy(false);
            });
        },
      },
    ]);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.root}
      contentContainerStyle={styles.content}
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      <View style={styles.group}>
        <ListRow title={t('profile.account')} value={user?.primaryEmailAddress?.emailAddress ?? ''} />
      </View>
      <Button
        kind="secondary"
        label={t('profile.signOut')}
        loading={busy}
        onPress={() => {
          void signOut();
        }}
        testID="profile-sign-out"
      />
      <View style={styles.group}>
        <ListRow
          title={t('profile.delete.row')}
          onPress={deleteAccount}
          destructive
          testID="profile-delete"
        />
      </View>
      {isDevBuild() ? (
        <View style={styles.group}>
          <ListRow
            title={t('profile.catalog')}
            onPress={() => {
              router.push('/dev/catalog');
            }}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: color.bg.paper },
  content: { padding: layout.margin, gap: layout.gapCards },
  group: { borderRadius: radius.field, overflow: 'hidden' },
});
