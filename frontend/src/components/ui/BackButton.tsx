import { useState } from 'react';
import { COLORS, FONT } from '../../theme';

interface Props {
  onClick: () => void;
  label: string;
}

export default function BackButton({ onClick, label }: Props) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'rgba(217,119,6,0.12)' : 'transparent',
        border: `1px solid ${hover ? COLORS.amber : COLORS.line}`,
        color: hover ? COLORS.amberBright : COLORS.textSecondary,
        borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600,
        fontFamily: FONT, cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      <i className="fas fa-arrow-left" style={{ fontSize: 11 }} /> {label}
    </button>
  );
}
