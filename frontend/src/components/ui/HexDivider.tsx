import { COLORS, FONT } from '../../theme';

export default function HexDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '8px 0' }}>
      <div style={{ flex: 1, height: 1, background: COLORS.line }} />
      <span style={{
        fontSize: 10, letterSpacing: 3, color: 'rgba(245,243,238,0.14)', fontFamily: FONT,
      }}>⬢</span>
      <div style={{ flex: 1, height: 1, background: COLORS.line }} />
    </div>
  );
}
