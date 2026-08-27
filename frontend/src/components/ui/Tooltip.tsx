import { useEffect, useRef, useState } from 'react';
import { COLORS, FONT } from '../../theme';

interface Props {
  text: string;
  position?: 'top' | 'bottom' | 'right';
}

const POPUP_BG = '#132238';
const POPUP_BORDER = 'rgba(212,144,10,0.25)';

export default function Tooltip({ text, position = 'top' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const popupPosition: React.CSSProperties =
    position === 'bottom'
      ? { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8 }
      : position === 'right'
      ? { top: '50%', left: '100%', transform: 'translateY(-50%)', marginLeft: 8 }
      : { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8 };

  const arrowPosition: React.CSSProperties =
    position === 'bottom'
      ? {
          bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          borderWidth: '0 5px 5px 5px',
          borderColor: `transparent transparent ${POPUP_BORDER} transparent`,
        }
      : position === 'right'
      ? {
          right: '100%', top: '50%', transform: 'translateY(-50%)',
          borderWidth: '5px 5px 5px 0',
          borderColor: `transparent ${POPUP_BORDER} transparent transparent`,
        }
      : {
          top: '100%', left: '50%', transform: 'translateX(-50%)',
          borderWidth: '5px 5px 0 5px',
          borderColor: `${POPUP_BORDER} transparent transparent transparent`,
        };

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{
          fontSize: 9, color: COLORS.textSecondary, cursor: 'help',
          border: `1px solid ${COLORS.line}`, borderRadius: '50%',
          width: 12, height: 12, display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          fontFamily: FONT,
        }}
      >?</span>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute', zIndex: 50,
            background: POPUP_BG, border: `1px solid ${POPUP_BORDER}`,
            borderRadius: 6, padding: '10px 12px',
            fontSize: 11, color: '#94A3B8', maxWidth: 260,
            lineHeight: 1.5, fontFamily: FONT, whiteSpace: 'pre-line' as const,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            ...popupPosition,
          }}
        >
          {text}
          <span style={{ position: 'absolute', width: 0, height: 0, border: '5px solid transparent', ...arrowPosition }} />
        </span>
      )}
    </span>
  );
}
