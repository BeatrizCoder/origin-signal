export const COLORS = {
  bg:           '#0B1220',
  panel:        '#132238',
  panelSoft:    '#16263E',
  textPrimary:  '#F5F3EE',
  textSecondary:'#AAB4C5',
  amber:        '#D97706',
  amberBright:  '#F59E0B',
  petroleo:     '#0F766E',
  bronze:       '#B45309',
  danger:       '#DC2626',
  line:         'rgba(245,243,238,0.08)',
  shadowSoft:   '0 24px 48px -20px rgba(0,0,0,0.45)',
} as const;

export const FONT = "'Manrope', 'IBM Plex Sans', sans-serif";

export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH';

export function riskColor(score: number): string {
  if (score < 40) return COLORS.petroleo;
  if (score <= 65) return COLORS.amberBright;
  return COLORS.danger;
}

export function riskTier(score: number): RiskTier {
  if (score < 40) return 'LOW';
  if (score <= 65) return 'MEDIUM';
  return 'HIGH';
}
