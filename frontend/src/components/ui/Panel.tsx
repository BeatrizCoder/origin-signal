import type { ReactNode, CSSProperties } from 'react';
import { COLORS } from '../../theme';

interface Props {
  children: ReactNode;
  variant?: 'default' | 'gradient';
  style?: CSSProperties;
}

export default function Panel({ children, variant = 'default', style }: Props) {
  const gradient = variant === 'gradient';
  return (
    <div style={{
      background: gradient
        ? `linear-gradient(135deg, ${COLORS.panelSoft} 0%, ${COLORS.panel} 100%)`
        : COLORS.panel,
      border: gradient ? `1px solid rgba(217,119,6,0.18)` : `1px solid rgba(255,255,255,0.04)`,
      borderRadius: 18,
      padding: 32,
      boxShadow: COLORS.shadowSoft,
      position: 'relative',
      ...style,
    }}>
      {children}
    </div>
  );
}
