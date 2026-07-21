import type { ReactNode } from 'react';
import { COLORS, FONT } from '../../theme';

export default function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p style={{
      fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 2.5,
      color: COLORS.amberBright, fontWeight: 700, margin: '0 0 4px 0', fontFamily: FONT,
    }}>{children}</p>
  );
}
