import type { ReactNode } from 'react';
import { COLORS, FONT } from '../../theme';

interface Props {
  title: string;
  children: ReactNode;
  last?: boolean;
}

export default function BriefingBlock({ title, children, last = false }: Props) {
  return (
    <div style={{ padding: '22px 0', borderBottom: last ? 'none' : `1px solid ${COLORS.line}` }}>
      <h3 style={{
        fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: 1.5,
        color: COLORS.amberBright, margin: '0 0 10px 0', fontWeight: 700, fontFamily: FONT,
      }}>{title}</h3>
      <div style={{ fontSize: 14, lineHeight: 1.75, color: COLORS.textSecondary, maxWidth: 760, fontFamily: FONT }}>
        {children}
      </div>
    </div>
  );
}
