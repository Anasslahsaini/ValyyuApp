import { useClerk } from '@clerk/expo';
import { tooYoung } from '@workspace/domain/onboarding';
import { Button, Card, Text, TextField } from '@workspace/ui';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StepScreen } from '../../src/components/StepScreen';
import { useDraft } from '../../src/first-launch/DraftProvider';

/** O1 · prénom et âge, O1b · moins de 15 ans (nothing is saved; the account can be erased right away). */
export default function You() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signOut } = useClerk();
  const { draft, update } = useDraft();
  const ageText = draft.age ? String(draft.age) : '';
  const young = tooYoung(draft.age);
  const valid =
    !!draft.firstName?.trim() && typeof draft.age === 'number' && draft.age >= 15 && draft.age <= 110;
  return (
    <StepScreen
      step={1}
      title={t('onboarding.you.title')}
      primary={{
        label: t('common.continue'),
        disabled: !valid,
        onPress: () => {
          router.push('/health');
        },
      }}
      {...(young
        ? {
            secondary: (
              <Button
                kind="tertiary"
                label={t('onboarding.you.quit')}
                onPress={() => {
                  void signOut();
                }}
              />
            ),
          }
        : {})}
    >
      <TextField
        label={t('onboarding.you.firstName')}
        value={draft.firstName ?? ''}
        onChangeText={(firstName) => {
          update({ firstName });
        }}
        testID="onboarding-name"
      />
      <TextField
        label={t('onboarding.you.age')}
        value={ageText}
        unit={t('onboarding.units.years')}
        keyboardType="number-pad"
        onChangeText={(value) => {
          const n = Number(value.replace(/\D/g, '').slice(0, 3));
          update(n ? { age: n } : { age: undefined });
        }}
        {...(young ? {} : { help: t('onboarding.you.ageHelp') })}
        testID="onboarding-age"
      />
      {young ? (
        <Card>
          <Text variant="headline">{t('onboarding.you.tooYoungTitle')}</Text>
          <Text tone="secondary">{t('onboarding.you.tooYoungMessage')}</Text>
        </Card>
      ) : null}
    </StepScreen>
  );
}
