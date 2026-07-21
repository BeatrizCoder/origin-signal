import { COLORS, FONT } from '../../theme';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  tagline?: string;
  stacked?: boolean;
}

const SIZES = {
  sm: { mark: 26, markFont: 9,  name: 13, tag: 8.5  },
  md: { mark: 30, markFont: 10, name: 15, tag: 9.5  },
  lg: { mark: 34, markFont: 11, name: 17, tag: 11   },
};

export default function Logo({ size = 'md', tagline, stacked = true }: Props) {
  const s = SIZES[size];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: s.mark, height: s.mark, flexShrink: 0,
        background: `linear-gradient(135deg, ${COLORS.amberBright}, ${COLORS.bronze})`,
        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: s.markFont, fontWeight: 800, color: '#1A1204', letterSpacing: -0.5,
        fontFamily: FONT,
      }}>OS</div>
      <div style={{ display: stacked ? 'flex' : undefined, flexDirection: stacked ? 'column' : undefined }}>
        <div style={{
          fontSize: s.name, fontWeight: 700, letterSpacing: -0.2, color: COLORS.textPrimary,
          fontFamily: FONT,
        }}>OriginSignal</div>
        {tagline && (
          <div style={{
            fontSize: s.tag, color: COLORS.textSecondary, letterSpacing: 1.5,
            textTransform: 'uppercase' as const, marginTop: 2, fontFamily: FONT,
          }}>{tagline}</div>
        )}
      </div>
    </div>
  );
}
