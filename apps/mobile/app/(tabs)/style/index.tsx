import type { WardrobeItem } from '@workspace/domain/life';
import { suggestOutfit, swapPiece } from '@workspace/domain/outfit-engine';
import { wearWrites } from '@workspace/domain/style-writes';
import { inLaundry } from '@workspace/domain/wear';
import { color, layout, radius, space } from '@workspace/tokens';
import { Banner, Button, Card, IconButton, ListRow, SegmentedControl, Text } from '@workspace/ui';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { DomainTag } from '../../../src/components/DomainTag';
import { Icon } from '../../../src/components/Icon';
import { useLife } from '../../../src/data/LifeProvider';
import { useRun } from '../../../src/data/useRun';
import { dayLabel, localDay } from '../../../src/meals/format';
import { CATEGORIES, CATEGORY_KEY, COLUMNS, type Category } from '../../../src/style/categories';
import { PieceTile } from '../../../src/style/PieceTile';

type Tab = 'today' | 'wardrobe' | 'outfits';

/** Style: today's outfit from the wardrobe (change a piece, wear it), the wardrobe by category, worn outfits. */
export default function StyleScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { state, apply } = useLife();
  const { busy, failed, run } = useRun<'wear'>();
  const wardrobe = state.wardrobe;
  // Until the person picks: today's outfit when there are enough clothes, else the wardrobe.
  const [choice, setTab] = useState<Tab | null>(null);
  const tab = choice ?? (wardrobe.length >= 2 ? 'today' : 'wardrobe');
  const [seed, setSeed] = useState(0);
  const [swapped, setSwapped] = useState<string[] | null>(null);
  const today = localDay();
  const byId = useMemo(() => new Map(wardrobe.map((w) => [w.id, w])), [wardrobe]);

  const suggestion = useMemo(
    () =>
      wardrobe.length >= 2 ? suggestOutfit({ wardrobe, outfits: state.outfits, date: today, seed }) : null,
    [wardrobe, state.outfits, today, seed],
  );
  const current = swapped ?? suggestion?.itemIds ?? [];
  const pieces = current.map((id) => byId.get(id)).filter((w): w is WardrobeItem => !!w);
  const wornToday = state.outfits.some((o) => o.wornOn?.includes(today));

  const swap = (category: Category) => {
    setSwapped(swapPiece({ wardrobe, outfits: state.outfits, date: today, current }, category));
  };
  const wear = () => {
    void run('wear', () =>
      apply(wearWrites(state, current, today, t('style.outfitOf', { date: dayLabel(today, i18n.language) }))),
    );
  };

  const outfits = useMemo(
    () =>
      [...state.outfits]
        .filter((o) => o.wornOn?.length)
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    [state.outfits],
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              accessibilityLabel={t('style.addPiece')}
              onPress={() => {
                router.push('/style/piece');
              }}
              filled
              icon={<Icon sf="plus" md="add" color={color.bg.surface} />}
              testID="style-add"
            />
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <SegmentedControl
          accessibilityLabel={t('tabs.style')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'today', label: t('style.tabToday') },
            { value: 'wardrobe', label: t('style.tabWardrobe', { count: wardrobe.length }) },
            { value: 'outfits', label: t('style.tabOutfits') },
          ]}
        />
        {failed ? <Banner tone="danger" title={t('today.saveFailed')} /> : null}

        <Animated.View key={tab} entering={FadeIn.duration(200)} style={styles.group}>
          {tab === 'today' ? (
            suggestion && pieces.length ? (
              <Card elevated>
                <View style={styles.top}>
                  <DomainTag domain="style" />
                  <Text variant="footnote" tone="secondary">
                    {t('style.noWeather')}
                  </Text>
                </View>
                <Text variant="title2">{pieces.map((p) => p.name).join(', ')}</Text>
                <View style={styles.grid}>
                  {pieces.map((p) => (
                    <PieceTile
                      key={p.id}
                      item={p}
                      label={t('style.swapPiece', { category: t(CATEGORY_KEY[p.category]), name: p.name })}
                      badge={t('style.tapToSwap')}
                      onPress={() => {
                        swap(p.category);
                      }}
                    />
                  ))}
                  {Array.from({ length: (COLUMNS - (pieces.length % COLUMNS)) % COLUMNS }, (_, i) => (
                    <View key={`pad-${String(i)}`} style={styles.pad} />
                  ))}
                </View>
                {wornToday ? (
                  <View style={styles.done}>
                    <Icon sf="checkmark" md="check" color={color.success.fg} size={18} />
                    <Text variant="headline" tone="success">
                      {t('today.noted')}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.actions}>
                  <View style={styles.flex}>
                    <Button
                      kind="secondary"
                      label={t('style.another')}
                      onPress={() => {
                        setSwapped(null);
                        setSeed((n) => n + 1);
                      }}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Button
                      kind="decision"
                      label={t('style.wear')}
                      onPress={wear}
                      loading={busy === 'wear'}
                      testID="style-wear"
                    />
                  </View>
                </View>
              </Card>
            ) : (
              <Card>
                <Text variant="headline">{t('style.emptyTitle')}</Text>
                <Text tone="secondary">{t('style.emptyBody')}</Text>
                <Button
                  label={t('style.addPiece')}
                  onPress={() => {
                    router.push('/style/piece');
                  }}
                />
              </Card>
            )
          ) : null}

          {tab === 'wardrobe' ? (
            wardrobe.length ? (
              CATEGORIES.map((category, ci) => {
                const items = wardrobe.filter((w) => w.category === category);
                if (!items.length) return null;
                return (
                  <Animated.View
                    key={category}
                    entering={FadeInDown.delay(ci * 50).duration(240)}
                    style={styles.group}
                  >
                    <Text variant="subhead" tone="secondary" accessibilityRole="header">
                      {t('style.categoryCount', { category: t(CATEGORY_KEY[category]), count: items.length })}
                    </Text>
                    <View style={styles.grid}>
                      {items.map((item) => (
                        <PieceTile
                          key={item.id}
                          item={item}
                          label={[item.name, inLaundry(item) ? t('style.inLaundry') : null]
                            .filter(Boolean)
                            .join(', ')}
                          {...(inLaundry(item) ? { badge: t('style.inLaundry') } : {})}
                          onPress={() => {
                            router.push({ pathname: '/style/piece', params: { id: item.id } });
                          }}
                        />
                      ))}
                      {Array.from({ length: (COLUMNS - (items.length % COLUMNS)) % COLUMNS }, (_, i) => (
                        <View key={`pad-${String(i)}`} style={styles.pad} />
                      ))}
                    </View>
                  </Animated.View>
                );
              })
            ) : (
              <Card>
                <Text variant="headline">{t('style.wardrobeEmptyTitle')}</Text>
                <Text tone="secondary">{t('style.wardrobeEmptyBody')}</Text>
                <Button
                  label={t('style.addPiece')}
                  onPress={() => {
                    router.push('/style/piece');
                  }}
                  testID="style-empty-add"
                />
              </Card>
            )
          ) : null}

          {tab === 'outfits' ? (
            outfits.length ? (
              <View style={styles.list}>
                {outfits.map((o) => (
                  <ListRow
                    key={o.id}
                    title={o.itemIds
                      .map((id) => byId.get(id)?.name)
                      .filter(Boolean)
                      .join(', ')}
                    value={o.date ? dayLabel(o.date.slice(0, 10), i18n.language) : ''}
                  />
                ))}
              </View>
            ) : (
              <Text tone="secondary">{t('style.noOutfits')}</Text>
            )
          ) : null}
        </Animated.View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: layout.margin, gap: space[4], paddingBottom: space[12] },
  group: { gap: space[3] },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  pad: { flexBasis: '28%', flexGrow: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  flex: { flex: 1, minWidth: 140 },
  done: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  list: { borderRadius: radius.field, overflow: 'hidden' },
});
