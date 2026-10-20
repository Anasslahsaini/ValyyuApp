import { layout, space } from '@workspace/tokens';
import { Banner, Button } from '@workspace/ui';
import { Stack, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseButton } from '../navigation/CloseButton';

type Props = {
  title: string;
  children: ReactNode;
  saveLabel?: string;
  onSave: () => Promise<boolean>;
  /** Shown for an existing record; asks before deleting (system alert). */
  onDelete?: () => Promise<boolean>;
  busy?: boolean;
  error?: string | null;
  testID?: string;
};

/** A modal form: title and visible Close at the top, fields, one primary Save at the bottom, optional Delete. */
export function FormScreen({
  title,
  children,
  saveLabel,
  onSave,
  onDelete,
  busy = false,
  error,
  testID,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const close = () => {
    router.back();
  };
  return (
    <>
      <Stack.Screen options={{ title, headerRight: () => <CloseButton onPress={close} /> }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[6] }]}
        testID={testID}
      >
        {error ? <Banner tone="danger" title={error} /> : null}
        {children}
        <View style={styles.actions}>
          <Button
            label={saveLabel ?? t('common.save')}
            loading={busy}
            onPress={() => {
              void onSave().then((ok) => {
                if (ok) close();
              });
            }}
            testID="form-save"
          />
          {onDelete ? (
            <Button
              kind="destructive"
              label={t('common.delete')}
              onPress={() => {
                Alert.alert(t('common.deleteConfirm'), undefined, [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => {
                      void onDelete().then((ok) => {
                        if (ok) close();
                      });
                    },
                  },
                ]);
              }}
              testID="form-delete"
            />
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: layout.margin, gap: space[4] },
  actions: { gap: space[3], paddingTop: space[2] },
});
