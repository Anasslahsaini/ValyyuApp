export type ShadowSpec = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  /** Android elevation. */
  elevation: number;
};

const none: ShadowSpec = {
  shadowColor: '#000000',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
};

/** 0: flat card with hairline · 1: highlighted "decision" card · 2: menus and toasts. */
export const elevation: Record<0 | 1 | 2, ShadowSpec> = {
  0: none,
  1: {
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  2: {
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};
