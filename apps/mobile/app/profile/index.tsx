import { useClerk, useUser } from '@clerk/expo';
import { color, layout, radius, space } from '@workspace/tokens';
import { Banner, Button, ListRow, Text } from '@workspace/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useLife } from '../../src/data/LifeProvider';
import { isDevBuild } from '../../src/env';
import { GOALS } from '../../src/first-launch/options';

/**
 * Profil: my answers, health data (consent given or withdrawn), the data on this phone, the account
 * (sign out, in-app deletion: App Store rule 5.1.1(v)).
 */
export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { state, erase } = useLife();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = state.settings;
  const goal = GOALS.find((g) => g.value === s.mainGoal);

  const eraseData = () => {
    Alert.alert(t('profile.erase.title'), t('profile.erase.message'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.erase.confirm'),
        style: 'destructive',
        onPress: () => {
          void erase().catch(() => {
            setError(t('today.saveFailed'));
          });
        },
      },
    ]);
  };

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
            .then(() => erase())
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

      <View style={styles.section}>
        <Text variant="subhead" tone="secondary" accessibilityRole="header">
          {t('profile.me')}
        </Text>
        <View style={styles.group}>
          <ListRow
            title={t('profile.info.title')}
            value={[s.firstName, goal ? t(goal.label) : null].filter(Boolean).join(' · ')}
            onPress={() => {
              router.push('/profile/info');
            }}
            testID="profile-info"
          />
          <ListRow
            title={t('profile.health.title')}
            value={s.healthConsentAt ? t('profile.health.on') : t('profile.health.off')}
            onPress={() => {
              router.push('/profile/health');
            }}
            testID="profile-health"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="subhead" tone="secondary" accessibilityRole="header">
          {t('profile.data')}
        </Text>
        <Text variant="footnote" tone="secondary">
          {t('profile.dataWhere')}
        </Text>
        <View style={styles.group}>
          <ListRow title={t('profile.erase.row')} onPress={eraseData} destructive testID="profile-erase" />
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="subhead" tone="secondary" accessibilityRole="header">
          {t('profile.account')}
        </Text>
        <View style={styles.group}>
          <ListRow title={t('profile.email')} value={user?.primaryEmailAddress?.emailAddress ?? ''} />
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
  content: { padding: layout.margin, gap: layout.gapSection, paddingBottom: space[12] },
  section: { gap: space[2] },
  group: { borderRadius: radius.field, overflow: 'hidden' },
});
