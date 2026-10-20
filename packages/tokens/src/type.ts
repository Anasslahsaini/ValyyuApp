export type TypeToken =
  'largeTitle' | 'title1' | 'title2' | 'headline' | 'body' | 'callout' | 'subhead' | 'footnote' | 'caption';

type Weight = '400' | '500' | '600' | '700';
export type TypeStyle = {
  ios: { size: number; lineHeight: number; weight: Weight };
  android: { size: number; lineHeight: number };
  family: 'display' | 'text';
};

/** Default ("Large") sizes; the OS scales them with Dynamic Type / font scale. */
export const type: Record<TypeToken, TypeStyle> = {
  largeTitle: {
    ios: { size: 34, lineHeight: 41, weight: '700' },
    android: { size: 34, lineHeight: 40 },
    family: 'display',
  },
  title1: {
    ios: { size: 28, lineHeight: 34, weight: '700' },
    android: { size: 28, lineHeight: 36 },
    family: 'display',
  },
  title2: {
    ios: { size: 22, lineHeight: 28, weight: '700' },
    android: { size: 22, lineHeight: 28 },
    family: 'display',
  },
  headline: {
    ios: { size: 17, lineHeight: 22, weight: '600' },
    android: { size: 16, lineHeight: 24 },
    family: 'text',
  },
  body: {
    ios: { size: 17, lineHeight: 22, weight: '400' },
    android: { size: 16, lineHeight: 24 },
    family: 'text',
  },
  callout: {
    ios: { size: 16, lineHeight: 21, weight: '400' },
    android: { size: 15, lineHeight: 22 },
    family: 'text',
  },
  subhead: {
    ios: { size: 15, lineHeight: 20, weight: '500' },
    android: { size: 14, lineHeight: 20 },
    family: 'text',
  },
  footnote: {
    ios: { size: 13, lineHeight: 18, weight: '400' },
    android: { size: 12, lineHeight: 16 },
    family: 'text',
  },
  caption: {
    ios: { size: 12, lineHeight: 16, weight: '600' },
    android: { size: 12, lineHeight: 16 },
    family: 'text',
  },
};

/** Titles use Bricolage Grotesque; body text uses the system font (SF Pro / Roboto). */
export const fontFamily = { display: 'BricolageGrotesque_700Bold', text: undefined } as const;
