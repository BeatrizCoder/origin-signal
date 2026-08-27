import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import LangToggle from './LangToggle';
import Logo from './ui/Logo';
import PillChip from './ui/PillChip';
import { COLORS, FONT, riskColor } from '../theme';
import { getHistory } from '../services/api';
import type { HistoryItem } from '../types';

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
  onCompare: () => void;
  initialOrigin?: string;
  initialDestination?: string;
  initialTradeDirection?: TradeDirection;
}

const DESTINATIONS = [
  'European Union',
  'Norway',
  'Switzerland',
  'United Kingdom',
  'United States',
  'China',
  'Japan',
  'South Korea',
  'Argentina',
  'Uruguay',
  'Paraguay',
  'Colombia',
  'Peru',
  'Chile',
  'Mexico',
  'Saudi Arabia',
  'UAE',
];

const IMPORT_ORIGINS = [
  'United States',
  'China',
  'European Union',
  'Norway',
  'Switzerland',
  'United Kingdom',
  'Argentina',
  'Colombia',
  'Peru',
  'Chile',
  'Uruguay',
  'Paraguay',
  'Vietnam',
  'Ethiopia',
];

// explicit map (not a slice/prefix heuristic) — avoids collisions like
// "United States"/"United Kingdom" both truncating to the same code
const COUNTRY_CODE: Record<string, string> = {
  'Brazil': 'BR', 'European Union': 'EU', 'Norway': 'NO', 'Switzerland': 'CH',
  'United Kingdom': 'UK', 'United States': 'US', 'China': 'CN', 'Japan': 'JP',
  'South Korea': 'KR', 'Argentina': 'AR', 'Uruguay': 'UY', 'Paraguay': 'PY',
  'Colombia': 'CO', 'Peru': 'PE', 'Chile': 'CL', 'Mexico': 'MX',
  'Saudi Arabia': 'SA', 'UAE': 'AE', 'Vietnam': 'VN', 'Ethiopia': 'ET',
};
const countryCode = (name: string) => COUNTRY_CODE[name] ?? name.slice(0, 2).toUpperCase();

const VERDICT_COLOR: Record<string, string> = {
  Go: COLORS.petroleo, Caution: COLORS.amberBright, Hold: COLORS.danger,
};

function formatRelativeTime(iso: string, t: (key: 'hours_ago' | 'yesterday') => string): string {
  const diffMs    = Date.now() - new Date(iso).getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays  = Math.floor(diffMs / 86_400_000);
  if (diffDays >= 2) return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  if (diffDays === 1) return t('yesterday');
  return `${Math.max(1, diffHours)} ${t('hours_ago')}`;
}

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

const QUERY_CHIPS = {
  EN: ['Geopolitical risk', 'Phytosanitary requirements', 'Tariff optimization', 'EUDR compliance', 'Climate impact'],
  PT: ['Risco geopolítico', 'Requisitos fitossanitários', 'Otimização tarifária', 'Conformidade EUDR', 'Impacto climático'],
};

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
              fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
              fontFamily: FONT,
              background: active ? COLORS.amberBright : 'transparent',
              color: active ? '#1A1204' : COLORS.textSecondary,
              border: `1px solid ${active ? COLORS.amberBright : COLORS.line}`,
              borderRadius: 20, cursor: 'pointer',
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
  display: 'block', fontSize: 11, fontWeight: 700,
  letterSpacing: 1.5, color: COLORS.textSecondary, marginBottom: 8,
  textTransform: 'uppercase', fontFamily: FONT,
};

const selectStyle: React.CSSProperties = {
  width: '100%', background: COLORS.panel, border: `1px solid ${COLORS.line}`,
  borderRadius: 8, color: COLORS.textPrimary, fontSize: 14,
  padding: '10px 12px', outline: 'none',
  boxSizing: 'border-box', cursor: 'pointer', fontFamily: FONT,
};

export default function LandingScreen({ onAnalyze, onCompare, initialOrigin, initialDestination, initialTradeDirection }: Props) {
  const [commodity,       setCommodity]       = useState('coffee');
  const [destination,     setDestination]     = useState(initialTradeDirection !== 'import' && initialDestination ? initialDestination : 'European Union');
  const [importOrigin,    setImportOrigin]    = useState(initialTradeDirection === 'import' && initialOrigin ? initialOrigin : 'United States');
  const [focus,           setFocus]           = useState<Focus>('composite');
  const [horizon,         setHorizon]         = useState<Horizon>('90');
  const [query,           setQuery]           = useState('');
  const [tradeDirection,  setTradeDirection]  = useState<TradeDirection>(initialTradeDirection ?? 'export');
  const [recentAnalyses,  setRecentAnalyses]  = useState<HistoryItem[]>([]);
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const isImport = tradeDirection === 'import';
  const destinationOptions   = DESTINATIONS.includes(destination) ? DESTINATIONS : [destination, ...DESTINATIONS];
  const importOriginOptions  = IMPORT_ORIGINS.includes(importOrigin) ? IMPORT_ORIGINS : [importOrigin, ...IMPORT_ORIGINS];

  useEffect(() => {
    let cancelled = false;
    getHistory(5)
      .then(data => { if (!cancelled) setRecentAnalyses(data.slice(0, 5)); })
      .catch(() => { if (!cancelled) setRecentAnalyses([]); });
    return () => { cancelled = true; };
  }, []);

  function addQueryChip(text: string) {
    setQuery(prev => (prev ? `${prev} ${text}` : text));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isImport) {
      onAnalyze({ commodity, focus, horizon, query, origin: importOrigin, destination: 'Brazil', trade_direction: tradeDirection });
    } else {
      onAnalyze({ commodity, focus, horizon, query, origin: 'Brazil', destination, trade_direction: tradeDirection });
    }
  }

  const nonEU = !isImport && ['Norway', 'Switzerland', 'United Kingdom'].includes(destination);
  const pillLegPanel: React.CSSProperties = {
    background: 'rgba(217,119,6,0.08)', border: `1px solid ${COLORS.amber}44`,
    borderRadius: 8, color: COLORS.amberBright, fontSize: 13,
    padding: '10px 12px', fontFamily: FONT, fontWeight: 600, letterSpacing: 0.3,
  };
  const legSelectStyle: React.CSSProperties = {
    ...selectStyle,
    color: COLORS.amberBright,
    background: 'rgba(217,119,6,0.08)',
    border: `1px solid ${COLORS.amber}44`,
    fontWeight: 600, fontSize: 13,
  };

  return (
    <div style={{
      minHeight: '100vh', color: COLORS.textPrimary,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 52 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 14 }}>
          <Logo size="lg" stacked={false} />
          <LangToggle />
        </div>
        <div style={{ fontSize: 12, letterSpacing: 2, color: COLORS.textSecondary, fontFamily: FONT, textTransform: 'uppercase' as const }}>
          TRADE RISK INTELLIGENCE
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
              <select value={importOrigin} onChange={e => setImportOrigin(e.target.value)} style={legSelectStyle}>
                {importOriginOptions.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <div style={pillLegPanel}>⬢ Brazil</div>
            )}
          </div>
          <div>
            <label style={labelStyle}>{t('destination_label')}</label>
            {isImport ? (
              <div style={pillLegPanel}>⬢ Brazil</div>
            ) : (
              <select value={destination} onChange={e => setDestination(e.target.value)} style={legSelectStyle}>
                {destinationOptions.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Non-EU notice */}
        {nonEU && (
          <div style={{
            background: 'rgba(217,119,6,0.08)', border: `1px solid ${COLORS.amber}44`,
            borderRadius: 8, padding: '10px 14px',
            fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6,
            fontFamily: FONT,
          }}>
            <i className="fas fa-triangle-exclamation" style={{ color: COLORS.amberBright, marginRight: 6 }} />
            {destination} is outside the EU — EUDR does not apply directly.
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
                    flex: 1, padding: '9px 16px',
                    fontSize: 12, fontWeight: 700, letterSpacing: 0.8,
                    fontFamily: FONT,
                    background: active ? COLORS.amberBright : 'transparent',
                    color: active ? '#1A1204' : COLORS.textSecondary,
                    border: `1px solid ${active ? COLORS.amberBright : COLORS.line}`,
                    borderRadius: 8, cursor: 'pointer',
                    transition: 'all 0.15s',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  <i className={dir === 'export' ? 'fas fa-arrow-up-from-bracket' : 'fas fa-arrow-down-to-bracket'} style={{ marginRight: 7, fontSize: 10 }} />
                  {dir === 'export' ? 'Export' : 'Import'}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 6, fontSize: 11.5, color: COLORS.textSecondary, fontFamily: FONT, lineHeight: 1.6 }}>
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
            <span style={{ color: COLORS.textSecondary, fontWeight: 400, fontSize: 9.5, letterSpacing: 1, opacity: 0.7 }}>(OPTIONAL)</span>
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 8 }}>
            {QUERY_CHIPS[language].map(chip => (
              <span
                key={chip}
                onClick={() => addQueryChip(chip)}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,144,10,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,144,10,0.1)'; }}
                style={{
                  background: 'rgba(212,144,10,0.1)',
                  border: '1px solid rgba(212,144,10,0.25)',
                  color: '#D4900A',
                  fontSize: 10, padding: '2px 8px', borderRadius: 10,
                  cursor: 'pointer', fontFamily: FONT,
                }}
              >
                {chip}
              </span>
            ))}
          </div>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('query_placeholder')}
            rows={3}
            style={{
              width: '100%', background: COLORS.panel, border: `1px solid ${COLORS.line}`,
              borderRadius: 8, color: COLORS.textPrimary, fontSize: 14,
              padding: '10px 12px', resize: 'vertical' as const,
              outline: 'none', boxSizing: 'border-box' as const,
              fontFamily: FONT, lineHeight: 1.5,
            }}
          />
        </div>

        {/* Analyze button */}
        <button
          type="submit"
          style={{
            width: '100%', height: 52,
            background: COLORS.amberBright, color: '#1A1204',
            fontWeight: 700, fontSize: 13, letterSpacing: 1.5,
            fontFamily: FONT,
            border: 'none', borderRadius: 8, cursor: 'pointer',
            textTransform: 'uppercase' as const,
            boxShadow: '0 6px 20px -6px rgba(245,158,11,0.5)',
          }}
        >
          <i className="fas fa-compass" style={{ marginRight: 8 }} />
          {t('analyze_btn')}
        </button>

        <button
          type="button"
          onClick={onCompare}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: COLORS.textSecondary, letterSpacing: 0.3,
            fontFamily: FONT,
            textAlign: 'center' as const, padding: 0,
          }}
        >
          {t('compare_routes')} →
        </button>
      </form>

      {/* Recent Analyses */}
      {recentAnalyses.length > 0 && (
        <div style={{ width: '100%', maxWidth: 480, marginTop: 32 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: COLORS.textSecondary,
            textTransform: 'uppercase' as const, fontFamily: FONT, marginBottom: 10,
          }}>
            {t('recent_analyses')}
          </div>
          <div style={{
            background: COLORS.panel, border: `1px solid ${COLORS.line}`,
            borderRadius: 8, overflow: 'hidden',
          }}>
            {recentAnalyses.map((item, i) => {
              const isImportItem = item.trade_direction === 'import';
              const route = isImportItem
                ? `${countryCode(item.origin)}→${countryCode('Brazil')}`
                : `${countryCode('Brazil')}→${countryCode(item.destination)}`;
              const verdict = item.overall_verdict;
              const verdictLabel = verdict === 'Go' ? t('go') : verdict === 'Hold' ? t('hold') : t('caution');
              const verdictColor = VERDICT_COLOR[verdict] ?? COLORS.textSecondary;
              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`/analysis/${item.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    borderTop: i > 0 ? `1px solid ${COLORS.line}` : 'none',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <PillChip color={COLORS.amberBright}>{item.commodity?.toUpperCase()}</PillChip>
                  <span style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: FONT, fontWeight: 600 }}>{route}</span>
                  <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 800, color: riskColor(item.overall_risk_score) }}>
                    {item.overall_risk_score}
                  </span>
                  {verdict && <PillChip color={verdictColor}>{verdictLabel.toUpperCase()}</PillChip>}
                  <span style={{ marginLeft: 'auto', fontSize: 10.5, color: COLORS.textSecondary, fontFamily: FONT, whiteSpace: 'nowrap' as const }}>
                    {formatRelativeTime(item.created_at, t)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 48, fontSize: 11, color: COLORS.textSecondary,
        fontFamily: FONT, opacity: 0.7,
        letterSpacing: 0.3, textAlign: 'center', lineHeight: 1.8,
      }}>
        Powered by Claude Sonnet 4.6 · Open-Meteo · USDA FAS · EUR-Lex EUDR
      </div>
    </div>
  );
}
