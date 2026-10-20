/** Garment color names → display swatch (clothing data, not UI tokens). */
export const swatches: Record<string, string> = {
  black: '#22201F',
  white: '#F6F3EC',
  grey: '#9A978F',
  gray: '#9A978F',
  navy: '#253055',
  blue: '#3E64B3',
  denim: '#4F6B8F',
  green: '#4E7350',
  olive: '#6F6B3A',
  beige: '#D9C6A5',
  cream: '#EDE3CC',
  brown: '#6E4B32',
  tan: '#B88F62',
  red: '#B5372B',
  burgundy: '#6D2233',
  pink: '#E3A1A8',
  purple: '#6B4A8A',
  yellow: '#E2B93B',
  orange: '#D9752E',
};
export const swatchFor = (color: string) => swatches[color.trim().toLowerCase()] ?? null;
