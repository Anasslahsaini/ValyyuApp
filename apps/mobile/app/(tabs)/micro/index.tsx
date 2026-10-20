import { examplesForArea } from '@workspace/domain/constants/voice-strings';
import { executeIntent, hasChanges, type ExecResult, type Patch } from '@workspace/domain/voice/execute';
import { parseCommand } from '@workspace/domain/voice/intents';
import { color, layout, radius, size, space } from '@workspace/tokens';
import { Banner, Button, Card, Chip, Text, TextField } from '@workspace/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Icon } from '../../../src/components/Icon';
import { useLife } from '../../../src/data/LifeProvider';
import { useRun } from '../../../src/data/useRun';
import { appRoute } from '../../../src/micro/route';

/**
 * Micro: say (soon) or type what you want. The phone understands the command itself, does it, and offers Annuler.
 * Voice needs the server (next lots); typing works offline today.
 */
export default function Micro() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { state, apply, updateSettings } = useLife();
  const { busy, failed, run } = useRun<'run' | 'undo'>();
  const [text, setText] = useState('');
  const [last, setLast] = useState<{ said: string; result: ExecResult } | null>(null);
  const lang = i18n.language;
  const examples = examplesForArea(lang, 'general');

  const write = async (patch: Patch) => {
    if (patch.upserts.length || patch.deletes.length)
      await apply({ upserts: patch.upserts, deletes: patch.deletes });
    if (patch.settings && Object.keys(patch.settings).length) await updateSettings(patch.settings);
  };

  const send = (said: string, confirmed = false, pending?: ExecResult['pending']) => {
    const words = said.trim();
    if (!words) return;
    const intent = pending ?? parseCommand(words, { lang, now: new Date() });
    const result = executeIntent(intent, state, new Date(), { lang, confirmed });
    void run('run', async () => {
      if (hasChanges(result.changes)) await write(result.changes);
      setLast({ said: words, result });
      setText('');
      if (result.kind === 'navigate' && result.navigate) router.navigate(appRoute(result.navigate));
    });
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      <View style={styles.mic}>
        <View
          style={styles.micButton}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon sf="mic.fill" md="mic" color={color.ink.primary} size={32} />
        </View>
        <Text variant="footnote" tone="secondary" align="center">
          {t('micro.voiceSoon')}
        </Text>
      </View>

      <TextField
        label={t('micro.typeLabel')}
        help={t('micro.typeHelp')}
        value={text}
        onChangeText={setText}
        testID="micro-input"
      />
      <Button
        kind="decision"
        label={t('micro.send')}
        onPress={() => {
          send(text);
        }}
        disabled={!text.trim()}
        loading={busy === 'run'}
        testID="micro-send"
      />
      {failed ? <Banner tone="danger" title={t('today.saveFailed')} /> : null}

      {last ? (
        <Animated.View key={last.said + last.result.kind} entering={FadeInDown.duration(240)}>
          <Card>
            <Text variant="footnote" tone="secondary">
              {t('micro.youSaid', { text: last.said })}
            </Text>
            <Text variant="headline" accessibilityRole="header">
              {last.result.message}
            </Text>
            {last.result.kind === 'confirm' && last.result.pending ? (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button
                    kind="secondary"
                    label={t('micro.no')}
                    onPress={() => {
                      setLast(null);
                    }}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    kind="decision"
                    label={t('micro.yes')}
                    onPress={() => {
                      send(last.said, true, last.result.pending);
                    }}
                  />
                </View>
              </View>
            ) : null}
            {last.result.kind === 'unknown' && last.result.examples?.length ? (
              <Text tone="secondary">{t('micro.tryExamples')}</Text>
            ) : null}
            {last.result.undo ? (
              <Button
                kind="tertiary"
                label={t('micro.undo')}
                loading={busy === 'undo'}
                onPress={() => {
                  const undo = last.result.undo;
                  if (!undo) return;
                  void run('undo', async () => {
                    await write(undo);
                    setLast(null);
                  });
                }}
                testID="micro-undo"
              />
            ) : null}
          </Card>
        </Animated.View>
      ) : null}

      <View style={styles.group}>
        <Text variant="subhead" tone="secondary" accessibilityRole="header">
          {t('micro.examples')}
        </Text>
        <View style={styles.chips}>
          {(last?.result.kind === 'unknown' && last.result.examples?.length
            ? last.result.examples
            : examples
          ).map((e) => (
            <Chip
              key={e}
              label={e}
              action={t('micro.useExample', { text: e })}
              onPress={() => {
                setText(e);
              }}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: layout.margin, gap: space[4], paddingBottom: space[12] },
  mic: { alignItems: 'center', gap: space[2], paddingVertical: space[4] },
  micButton: {
    width: size.touchMin * 2,
    height: size.touchMin * 2,
    borderRadius: radius.pill,
    backgroundColor: color.accent.lime,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  row: { flexDirection: 'row', gap: space[3], flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 120 },
  group: { gap: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
