/** "16,0:1" — contrast ratio with one decimal, French notation. */
export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(1).replace('.', ',')}:1`;
}

/** Nested color tokens as [`color.bg.paper`, '#F2F1EC'] pairs. */
export function flattenColors(tree: object, prefix = 'color'): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]): [string, string][] =>
    typeof value === 'string'
      ? [[`${prefix}.${key}`, value]]
      : flattenColors(value as object, `${prefix}.${key}`),
  );
}
