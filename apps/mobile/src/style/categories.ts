import type { WardrobeItem } from '@workspace/domain/life';
import { tKey } from '@workspace/i18n';

export type Category = WardrobeItem['category'];
export const CATEGORIES: readonly Category[] = ['top', 'bottom', 'outerwear', 'shoes', 'accessory'];
export const CATEGORY_KEY = {
  top: tKey('style.cat.top'),
  bottom: tKey('style.cat.bottom'),
  outerwear: tKey('style.cat.outerwear'),
  shoes: tKey('style.cat.shoes'),
  accessory: tKey('style.cat.accessory'),
} as const;
/** Three tiles per row; the row is completed with empty cells so the last tiles keep their size. */
export const COLUMNS = 3;
