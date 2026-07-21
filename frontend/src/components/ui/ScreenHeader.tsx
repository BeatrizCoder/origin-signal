import type { ReactNode } from 'react';
import { COLORS, FONT } from '../../theme';
import BackButton from './BackButton';

interface Props {
  title: string;
  icon?: string;
  backLabel: string;
  onBack: () => void;
  right?: ReactNode;
}

export default function ScreenHeader({ title, icon = '⬢', backLabel, onBack, right }: Props) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '18px 28px', borderBottom: `1px solid ${COLORS.line}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <BackButton onClick={onBack} label={backLabel} />
        <span style={{
          fontSize: 14, fontWeight: 700, letterSpacing: 0.3, color: COLORS.textPrimary,
          fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: COLORS.amberBright }}>{icon}</span> {title}
        </span>
      </div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>{right}</div>}
    </div>
  );
}
