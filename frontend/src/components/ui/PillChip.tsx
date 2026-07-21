import type { ReactNode } from 'react';
import { FONT } from '../../theme';

interface Props {
  color: string;
  children: ReactNode;
  outline?: boolean;
}

export default function PillChip({ color, children, outline = false }: Props) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
      padding: '3px 10px', borderRadius: 20, fontFamily: FONT,
      color, background: outline ? 'transparent' : `${color}1F`,
      border: `1px solid ${color}55`,
    }}>{children}</span>
  );
}
