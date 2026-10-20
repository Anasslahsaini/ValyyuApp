import { color } from './color';

const HEX = /^#[0-9a-fA-F]{6}$/;

function luminance(hex: string): number {
  if (!HEX.test(hex)) throw new Error(`Expected a #RRGGBB color, got "${hex}"`);
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.2 contrast ratio between two #RRGGBB colors (1 to 21). */
export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastPair = { fg: string; bg: string; usage: string; min: 4.5 | 3 };

/** Every text/background pair the design system allows, with its minimum ratio. */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { fg: color.ink.primary, bg: color.bg.paper, usage: 'ink / paper', min: 4.5 },
  { fg: color.ink.primary, bg: color.bg.surface, usage: 'ink / surface', min: 4.5 },
  { fg: color.ink.primary, bg: color.bg.sunken, usage: 'ink / sunken', min: 4.5 },
  { fg: color.bg.surface, bg: color.ink.primary, usage: 'primary button label', min: 4.5 },
  { fg: color.ink.secondary, bg: color.bg.paper, usage: 'secondary ink / paper', min: 4.5 },
  { fg: color.ink.secondary, bg: color.bg.surface, usage: 'secondary ink / surface', min: 4.5 },
  { fg: color.ink.secondary, bg: color.bg.sunken, usage: 'secondary ink / sunken', min: 4.5 },
  { fg: color.ink.primary, bg: color.accent.lime, usage: 'mic and decision button', min: 4.5 },
  { fg: color.ink.primary, bg: color.accent.limePressed, usage: 'pressed mic and decision', min: 4.5 },
  { fg: color.border.field, bg: color.bg.surface, usage: 'field border / surface', min: 3 },
  { fg: color.border.field, bg: color.bg.paper, usage: 'field border / paper', min: 3 },
  { fg: color.danger.fg, bg: color.bg.surface, usage: 'error / surface', min: 4.5 },
  { fg: color.danger.fg, bg: color.danger.bg, usage: 'error / error background', min: 4.5 },
  { fg: color.success.fg, bg: color.bg.surface, usage: 'success / surface', min: 4.5 },
  { fg: color.success.fg, bg: color.success.bg, usage: 'success / success background', min: 4.5 },
  ...(['today', 'repas', 'sport', 'style'] as const).flatMap((d): ContrastPair[] => [
    { fg: color.domain[d].fg, bg: color.domain[d].bg, usage: `${d} label / its background`, min: 4.5 },
    { fg: color.domain[d].fg, bg: color.bg.surface, usage: `${d} label / surface`, min: 4.5 },
  ]),
];
