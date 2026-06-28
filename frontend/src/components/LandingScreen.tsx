import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import LangToggle from './LangToggle';

export type Focus          = 'regulatory' | 'climate' | 'market' | 'composite';
export type Horizon        = '30' | '90' | '365';
export type TradeDirection = 'export' | 'import';

export interface LandingParams {
  commodity: string;
  focus: Focus;
  horizon: Horizon;
  query: string;
  origin: string;
  destination: string;
  trade_direction: TradeDirection;
}

interface Props {
  onAnalyze: (params: LandingParams) => void;
}

const AMBER      = '#D4900A';
const BG         = '#0B1120';
const SURFACE    = '#131C2E';
const BORDER     = '#1E2D45';
const TEXT       = '#F1F5F9';
const TEXT_MUTED = '#7A90A8';

const DESTINATIONS = [
  'European Union',
  'Germany',
  'Netherlands',
  'France',
  'Norway',
  'Switzerland',
  'United Kingdom',
];

const IMPORT_ORIGINS = [
  'United States',
  'China',
  'European Union',
  'Germany',
  'Netherlands',
  'France',
  'Argentina',
  'Uruguay',
  'Paraguay',
  'Colombia',
  'Peru',
  'Chile',
];

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

const selectStyle: React.CSSProperties = {
  width: '100%', background: SURFACE, border: `1px solid ${BORDER}`,
  borderRadius: 6, color: TEXT, fontSize: 14,
  padding: '10px 12px', outline: 'none',
  boxSizing: 'border-box', cursor: 'pointer',
};

export default function LandingScreen({ onAnalyze }: Props) {
  const [commodity,       setCommodity]       = useState('coffee');
  const [destination,     setDestination]     = useState('European Union');
  const [importOrigin,    setImportOrigin]    = useState('United States');
  const [focus,           setFocus]           = useState<Focus>('composite');
  const [horizon,         setHorizon]         = useState<Horizon>('90');
  const [query,           setQuery]           = useState('');
  const [tradeDirection,  setTradeDirection]  = useState<TradeDirection>('export');
  const { t } = useLanguage();

  const isImport = tradeDirection === 'import';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isImport) {
      onAnalyze({ commodity, focus, horizon, query, origin: importOrigin, destination: 'Brazil', trade_direction: tradeDirection });
    } else {
      onAnalyze({ commodity, focus, horizon, query, origin: 'Brazil', destination, trade_direction: tradeDirection });
    }
  }

  const nonEU = !isImport && ['Norway', 'Switzerland', 'United Kingdom'].includes(destination);

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
          <LangToggle />
        </div>
        <div style={{ fontSize: 11, letterSpacing: 2.5, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace' }}>
          {t('subtitle')}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Commodity */}
        <div>
          <label style={labelStyle}>{t('commodity_label')}</label>
          <select value={commodity} onChange={e => setCommodity(e.target.value)} style={selectStyle}>
            <option value="coffee">Coffee</option>
            <option value="fruits">Fruits</option>
            <option value="soybeans">Soybeans</option>
          </select>
        </div>

        {/* Origin / Destination */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>{isImport ? t('source_country_label') : t('origin_label')}</label>
            {isImport ? (
              <select
                value={importOrigin}
                onChange={e => setImportOrigin(e.target.value)}
                style={{
                  ...selectStyle,
                  color: AMBER,
                  background: '#0A1628',
                  border: `1px solid ${AMBER}44`,
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  fontWeight: 600, fontSize: 13, letterSpacing: 0.5,
                }}
              >
                {IMPORT_ORIGINS.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <div style={{
                background: '#0A1628', border: `1px solid ${AMBER}44`,
                borderRadius: 6, color: AMBER, fontSize: 13,
                padding: '10px 12px', fontFamily: 'ui-monospace, Consolas, monospace',
                fontWeight: 600, letterSpacing: 0.5,
              }}>⬡ Brazil</div>
            )}
          </div>
          <div>
            <label style={labelStyle}>{t('destination_label')}</label>
            {isImport ? (
              <div style={{
                background: '#0A1628', border: `1px solid ${AMBER}44`,
                borderRadius: 6, color: AMBER, fontSize: 13,
                padding: '10px 12px', fontFamily: 'ui-monospace, Consolas, monospace',
                fontWeight: 600, letterSpacing: 0.5,
              }}>⬡ Brazil</div>
            ) : (
              <select
                value={destination}
                onChange={e => setDestination(e.target.value)}
                style={{
                  ...selectStyle,
                  color: AMBER,
                  background: '#0A1628',
                  border: `1px solid ${AMBER}44`,
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  fontWeight: 600, fontSize: 13, letterSpacing: 0.5,
                }}
              >
                {DESTINATIONS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Non-EU notice */}
        {nonEU && (
          <div style={{
            background: '#1A1400', border: '1px solid #D4900A44',
            borderRadius: 6, padding: '10px 14px',
            fontSize: 11, color: TEXT_MUTED, lineHeight: 1.6,
            fontFamily: 'ui-monospace, Consolas, monospace',
          }}>
            ⚠ {destination} is outside the EU — EUDR does not apply directly.
            Bilateral agreements and equivalent national legislation will be assessed.
          </div>
        )}

        {/* Trade Direction */}
        <div>
          <label style={labelStyle}>Trade Direction</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['export', 'import'] as TradeDirection[]).map(dir => {
              const active = tradeDirection === dir;
              return (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setTradeDirection(dir)}
                  style={{
                    flex: 1, padding: '8px 16px',
                    fontSize: 11, fontWeight: 700, letterSpacing: 1,
                    fontFamily: 'ui-monospace, Consolas, monospace',
                    background: active ? AMBER : 'transparent',
                    color: active ? '#000' : TEXT_MUTED,
                    border: `1px solid ${active ? AMBER : BORDER}`,
                    borderRadius: 4, cursor: 'pointer',
                    transition: 'all 0.15s',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  {active ? '● ' : '○ '}
                  {dir === 'export' ? 'Export' : 'Import'}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace', lineHeight: 1.6 }}>
            {tradeDirection === 'export'
              ? 'Brazilian exporter assessing risk of shipping to Europe'
              : 'Brazilian importer assessing supply risk and regulatory requirements'}
          </div>
        </div>

        {/* Analysis Focus */}
        <div>
          <label style={labelStyle}>{t('analysis_focus')}</label>
          <RadioPill options={FOCUS_OPTIONS} value={focus} onChange={setFocus} />
        </div>

        {/* Time Horizon */}
        <div>
          <label style={labelStyle}>{t('time_horizon')}</label>
          <RadioPill options={HORIZON_OPTIONS} value={horizon} onChange={setHorizon} />
        </div>

        {/* Query (optional) */}
        <div>
          <label style={{ ...labelStyle, display: 'flex', gap: 6, alignItems: 'center' }}>
            {t('query_label')}
            <span style={{ color: BORDER, fontWeight: 400, fontSize: 9, letterSpacing: 1 }}>(OPTIONAL)</span>
          </label>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('query_placeholder')}
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
          {t('analyze_btn')}
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
