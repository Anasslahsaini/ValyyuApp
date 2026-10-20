/** Design system v1 colors (docs/design/claude-design-v1-tokens.md). Light mode only. */
export const color = {
  bg: { paper: '#F2F1EC', surface: '#FEFEFC', sunken: '#E8E7E0' },
  ink: { primary: '#161616', secondary: '#5E5D58' },
  border: { field: '#84837C', hairline: '#E3E2DB' },
  /** The light "y" of the logo. Never for text (1.7:1). */
  logo: { light: '#C9C8C2' },
  /** Lime is for the mic and the "decision" moment only; always with ink on top. */
  accent: { lime: '#DDF55C', limePressed: '#C9E23F' },
  danger: { fg: '#B3261E', bg: '#FBE9E7' },
  success: { fg: '#1D6B3A', bg: '#E4F1E8' },
  domain: {
    today: { fg: '#161616', bg: '#E8E7E0' },
    repas: { fg: '#A5400C', bg: '#FBEADF' },
    sport: { fg: '#1F5FAD', bg: '#E3EDF9' },
    style: { fg: '#6A3FB5', bg: '#EEE7F8' },
  },
} as const;

export type Domain = keyof typeof color.domain;
