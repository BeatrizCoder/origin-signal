interface Props {
  value: number;
  color: string;
  height?: number;
}

export default function ProgressMeter({ value, color, height = 4 }: Props) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div style={{ height, borderRadius: height / 2, background: 'rgba(245,243,238,0.06)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: height / 2, transition: 'width 0.4s ease' }} />
    </div>
  );
}
