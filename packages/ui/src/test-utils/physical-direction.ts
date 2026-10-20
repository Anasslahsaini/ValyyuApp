const PATTERNS = [
  /['"]?\b(marginLeft|marginRight|paddingLeft|paddingRight|left|right|borderLeft\w*|borderRight\w*|border(?:Top|Bottom)(?:Left|Right)Radius)['"]?\s*:/g,
  /\b(?:textAlign|alignSelf)\s*:\s*['"](?:left|right)['"]/g,
  /\bflexDirection\s*:\s*['"]row-reverse['"]/g,
];

/** Physical left/right styles that would not mirror in Arabic. Returns what it found (empty when clean). */
export function findPhysicalDirection(source: string): string[] {
  return PATTERNS.flatMap((pattern) =>
    [...source.matchAll(pattern)].map(
      (m) => m[1] ?? m[0].replace(/\s*:\s*/, ': ').replace(/^['"]|['"]?:$/g, ''),
    ),
  ).map((found) => found.replace(/['"]:$/, ''));
}
