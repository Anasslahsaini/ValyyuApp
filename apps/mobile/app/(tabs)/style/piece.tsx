import { SWATCH_NAMES, type SwatchName } from '@workspace/domain/color-names';
import { swatches } from '@workspace/domain/constants/swatches';
import { createId, type WardrobeItem } from '@workspace/domain/life';
import { toggleLaundry, inLaundry } from '@workspace/domain/wear';
import { tKey } from '@workspace/i18n';
import { color, radius, size, space } from '@workspace/tokens';
import { Banner, Button, CheckboxRow, ChoiceRow, Text, TextField } from '@workspace/ui';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { FormScreen } from '../../../src/components/FormScreen';
import { Icon } from '../../../src/components/Icon';
import { useLife } from '../../../src/data/LifeProvider';
import { useRun } from '../../../src/data/useRun';
import { CATEGORIES, CATEGORY_KEY, type Category } from '../../../src/style/categories';
import { dropPhoto, keepPhoto, pickPhoto } from '../../../src/style/photos';

const COLOR_KEY: Record<SwatchName, ReturnType<typeof tKey>> = {
  black: tKey('style.color.black'),
  white: tKey('style.color.white'),
  grey: tKey('style.color.grey'),
  navy: tKey('style.color.navy'),
  blue: tKey('style.color.blue'),
  denim: tKey('style.color.denim'),
  beige: tKey('style.color.beige'),
  cream: tKey('style.color.cream'),
  brown: tKey('style.color.brown'),
  tan: tKey('style.color.tan'),
  green: tKey('style.color.green'),
  olive: tKey('style.color.olive'),
  red: tKey('style.color.red'),
  burgundy: tKey('style.color.burgundy'),
  pink: tKey('style.color.pink'),
  purple: tKey('style.color.purple'),
  yellow: tKey('style.color.yellow'),
  orange: tKey('style.color.orange'),
};

/** Add or edit a piece: photo (camera or library, explained before the system asks), name, type, color, laundry. */
export default function PieceForm() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const { state, save, remove } = useLife();
  const { busy, failed, run } = useRun<'save'>();
  const existing = params.id ? state.wardrobe.find((w) => w.id === params.id) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState<Category>(existing?.category ?? 'top');
  const [colorName, setColorName] = useState(existing?.color ?? '');
  const [photo, setPhoto] = useState<string | undefined>(existing?.imageUri);
  const [laundry, setLaundry] = useState(existing ? inLaundry(existing) : false);
  const [denied, setDenied] = useState(false);
  const colorKey = (SWATCH_NAMES as readonly string[]).includes(colorName)
    ? COLOR_KEY[colorName as SwatchName]
    : null;
  const [missingName, setMissingName] = useState(false);

  const choose = (source: 'camera' | 'library') => {
    void pickPhoto(source).then((result) => {
      if (!result) return;
      if ('denied' in result) {
        setDenied(true);
        return;
      }
      setDenied(false);
      setPhoto(result.uri);
    });
  };

  const onSave = () => {
    if (!name.trim()) {
      setMissingName(true);
      return Promise.resolve(false);
    }
    const id = existing?.id ?? createId();
    return run('save', async () => {
      let imageUri = existing?.imageUri;
      if (photo && photo !== existing?.imageUri) {
        imageUri = await keepPhoto(photo, id);
        dropPhoto(existing?.imageUri);
      }
      const base: WardrobeItem = {
        ...(existing ?? { id }),
        name: name.trim(),
        category,
        color: colorName || 'grey',
      };
      delete base.imageUri;
      const record = { ...base, ...(imageUri ? { imageUri } : {}) };
      await save('wardrobe', inLaundry(record) === laundry ? record : toggleLaundry(record));
    });
  };

  return (
    <FormScreen
      title={existing ? t('style.editPiece') : t('style.addPiece')}
      onSave={onSave}
      {...(existing
        ? {
            onDelete: () =>
              run('save', async () => {
                await remove('wardrobe', existing.id);
                dropPhoto(existing.imageUri);
              }),
          }
        : {})}
      busy={busy === 'save'}
      error={failed ? t('today.saveFailed') : null}
    >
      <View style={styles.photoRow}>
        <View style={styles.photo}>
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={styles.image}
              accessibilityLabel={t('style.photoOf', { name: name || t('style.thisPiece') })}
            />
          ) : (
            <Icon sf="tshirt" md="checkroom" color={color.ink.secondary} size={32} />
          )}
        </View>
        <View style={styles.photoActions}>
          <Text variant="footnote" tone="secondary">
            {t('style.photoWhy')}
          </Text>
          <Button
            kind="secondary"
            label={t('style.takePhoto')}
            onPress={() => {
              choose('camera');
            }}
          />
          <Button
            kind="tertiary"
            label={t('style.fromLibrary')}
            onPress={() => {
              choose('library');
            }}
          />
        </View>
      </View>
      {denied ? (
        <View style={styles.group}>
          <Banner tone="info" title={t('style.photoDenied')} />
          <Button
            kind="tertiary"
            label={t('style.openSettings')}
            onPress={() => {
              void Linking.openSettings();
            }}
          />
        </View>
      ) : null}

      <TextField
        label={t('style.pieceName')}
        help={t('style.pieceNameHelp')}
        value={name}
        onChangeText={(v) => {
          setName(v);
          setMissingName(false);
        }}
        {...(missingName ? { error: t('repas.nameRequired') } : {})}
        testID="piece-name"
      />

      <View style={styles.group} accessibilityRole="radiogroup">
        <Text variant="subhead" tone="secondary">
          {t('style.category')}
        </Text>
        {CATEGORIES.map((c) => (
          <ChoiceRow
            key={c}
            label={t(CATEGORY_KEY[c])}
            selected={category === c}
            onPress={() => {
              setCategory(c);
            }}
          />
        ))}
      </View>

      <View style={styles.group}>
        <Text variant="subhead" tone="secondary">
          {colorKey ? t('style.colorIs', { color: t(colorKey) }) : t('style.color.title')}
        </Text>
        <View style={styles.swatches} accessibilityRole="radiogroup">
          {SWATCH_NAMES.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityLabel={t(COLOR_KEY[c])}
              accessibilityState={{ selected: colorName === c }}
              onPress={() => {
                setColorName(c);
              }}
              style={[styles.swatchHit, colorName === c && styles.swatchOn]}
            >
              <View style={[styles.swatch, { backgroundColor: swatches[c] }]} />
            </Pressable>
          ))}
        </View>
      </View>

      {existing ? (
        <CheckboxRow label={t('style.inLaundryBox')} checked={laundry} onChange={setLaundry} />
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
  photoRow: { flexDirection: 'row', gap: space[4], alignItems: 'center', flexWrap: 'wrap' },
  photo: {
    width: space[12] * 2,
    aspectRatio: 3 / 4,
    borderRadius: radius.field,
    backgroundColor: color.bg.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  photoActions: { flex: 1, minWidth: 160, gap: space[2] },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1] },
  swatchHit: {
    width: size.touchMin,
    height: size.touchMin,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchOn: { borderColor: color.ink.primary },
  swatch: {
    width: space[8],
    height: space[8],
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border.field,
  },
});
