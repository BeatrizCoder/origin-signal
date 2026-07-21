import { COLORS, FONT } from '../../theme';

export interface PipelineStep {
  id: string;
  icon: string;
  label: string;
}

interface Props {
  steps: PipelineStep[];
  activeCount: number;
  justify?: 'center' | 'flex-start';
}

export default function PipelineStrip({ steps, activeCount, justify = 'center' }: Props) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: justify, flexWrap: 'wrap' as const }}>
      {steps.map((step, i) => {
        const active = i < activeCount;
        return (
          <div key={step.id} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            fontSize: 11.5, fontFamily: FONT,
            color: active ? COLORS.textPrimary : COLORS.textSecondary,
            padding: '6px 12px', borderRadius: 20,
            border: `1px solid ${active ? 'rgba(245,158,11,0.4)' : COLORS.line}`,
            background: active ? 'rgba(245,158,11,0.08)' : 'transparent',
            transition: 'all 0.4s ease',
          }}>
            <span>{step.icon}</span> {step.label}
          </div>
        );
      })}
    </div>
  );
}
