import { useState } from 'react';

export type Focus   = 'regulatory' | 'climate' | 'market' | 'composite';
export type Horizon = '30' | '90' | '365';

export interface LandingParams {
  commodity: string;
  focus: Focus;
  horizon: Horizon;
  query: string;
}

interface Props {
  onSubmit: (params: LandingParams) => void;
}

const AMBER    = '#D4900A';
const BG       = '#0B1120';
const SURFACE  = '#131C2E';
const BORDER   = '#1E2D45';
const TEXT     = '#F1F5F9';
const TEXT_MUTED = '#7A90A8';

const FOCUS_OPTIONS: { value: Focus; label: string }[] = [
  { value: 'regulatory', label: 'Regulatory' },
  { value: 'climate',    label: 'Climate' },
  { value: 'market',     label: 'Market' },
  { value: 'composite',  label: 'Composite' },
];

const HORIZON_OPTIONS: { value: Horizon; label: string }[] = [
  { value: '30',  label: '30 days' },
  { value: '90',  label: '90 days' },
  { value: '365', label: '1 year' },
];

function RadioPill<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: '6px 16px',
              fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
              fontFamily: 'ui-monospace, Consolas, monospace',
              background: active ? AMBER : 'transparent',
              color: active ? '#000' : TEXT_MUTED,
              border: `1px solid ${active ? AMBER : BORDER}`,
              borderRadius: 4, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 600,
  letterSpacing: 1.5, color: TEXT_MUTED, marginBottom: 8,
  textTransform: 'uppercase', fontFamily: 'ui-monospace, Consolas, monospace',
};

export default function LandingScreen({ onSubmit }: Props) {
  const [commodity, setCommodity] = useState('coffee');
  const [focus,     setFocus]     = useState<Focus>('composite');
  const [horizon,   setHorizon]   = useState<Horizon>('90');
  const [query,     setQuery]     = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ commodity, focus, horizon, query });
  }

  return (
    <div style={{
      minHeight: '100vh', background: BG, color: TEXT,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 52 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 14 }}>
          <span style={{
            background: AMBER, color: '#000',
            fontFamily: 'ui-monospace, Consolas, monospace',
            fontWeight: 700, fontSize: 16, letterSpacing: 1,
            padding: '8px 12px', borderRadius: 4,
          }}>OS</span>
          <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 4, color: TEXT, fontFamily: 'system-ui, sans-serif' }}>
            ORIGINSIGNAL
          </span>
        </div>
        <div style={{ fontSize: 11, letterSpacing: 2.5, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace' }}>
          TRADE RISK INTELLIGENCE · BR→EU
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Commodity */}
        <div>
          <label style={labelStyle}>Commodity</label>
          <select
            value={commodity}
            onChange={e => setCommodity(e.target.value)}
            style={{
              width: '100%', background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 6, color: TEXT, fontSize: 14,
              padding: '10px 12px', outline: 'none',
              boxSizing: 'border-box' as const, cursor: 'pointer',
            }}
          >
            <option value="coffee">Coffee</option>
            <option value="fruits">Fruits</option>
          </select>
        </div>

        {/* Origin / Destination tags */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Origin</label>
            <div style={{
              background: '#0A1628', border: `1px solid ${AMBER}44`,
              borderRadius: 6, color: AMBER, fontSize: 13,
              padding: '10px 12px', fontFamily: 'ui-monospace, Consolas, monospace',
              fontWeight: 600, letterSpacing: 0.5,
            }}>⬡ Brazil</div>
          </div>
          <div>
            <label style={labelStyle}>Destination</label>
            <div style={{
              background: '#0A1628', border: `1px solid ${AMBER}44`,
              borderRadius: 6, color: AMBER, fontSize: 13,
              padding: '10px 12px', fontFamily: 'ui-monospace, Consolas, monospace',
              fontWeight: 600, letterSpacing: 0.5,
            }}>⬡ European Union</div>
          </div>
        </div>

        {/* Analysis Focus */}
        <div>
          <label style={labelStyle}>Analysis Focus</label>
          <RadioPill options={FOCUS_OPTIONS} value={focus} onChange={setFocus} />
        </div>

        {/* Time Horizon */}
        <div>
          <label style={labelStyle}>Time Horizon</label>
          <RadioPill options={HORIZON_OPTIONS} value={horizon} onChange={setHorizon} />
        </div>

        {/* Query (optional) */}
        <div>
          <label style={{ ...labelStyle, display: 'flex', gap: 6, alignItems: 'center' }}>
            Query
            <span style={{ color: BORDER, fontWeight: 400, fontSize: 9, letterSpacing: 1 }}>(OPTIONAL)</span>
          </label>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. EUDR compliance for coffee exports from Cerrado Mineiro to Germany"
            rows={3}
            style={{
              width: '100%', background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 6, color: TEXT, fontSize: 14,
              padding: '10px 12px', resize: 'vertical' as const,
              outline: 'none', boxSizing: 'border-box' as const,
              fontFamily: 'system-ui, sans-serif', lineHeight: 1.5,
            }}
          />
        </div>

        {/* Analyze button */}
        <button
          type="submit"
          style={{
            width: '100%', height: 52,
            background: AMBER, color: '#000',
            fontWeight: 700, fontSize: 13, letterSpacing: 2.5,
            fontFamily: 'ui-monospace, Consolas, monospace',
            border: 'none', borderRadius: 6, cursor: 'pointer',
            textTransform: 'uppercase' as const,
          }}
        >
          ANALYZE
        </button>
      </form>

      {/* Footer */}
      <div style={{
        marginTop: 48, fontSize: 10, color: '#334155',
        fontFamily: 'ui-monospace, Consolas, monospace',
        letterSpacing: 0.5, textAlign: 'center', lineHeight: 1.8,
      }}>
        Powered by Claude Sonnet 4.6 · Open-Meteo · USDA FAS · EUR-Lex EUDR
      </div>
    </div>
  );
}
