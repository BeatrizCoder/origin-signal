import { useState } from 'react';
import type { CompareResponse, RouteComparison, TariffCalculation } from '../types';
import { compareRoutes } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import LangToggle from './LangToggle';

const AMBER       = '#D4900A';
const AMBER_LIGHT = '#F5B731';
const BG          = '#0B1120';
const SURFACE     = '#131C2E';
const BORDER      = 'rgba(255,255,255,0.06)';
const TEXT        = '#F1F5F9';
const TEXT_MUTED  = '#7A90A8';
const MOSS        = '#34D399';
const TERRA       = '#F87171';

const VERDICT_COLOR: Record<RouteComparison['verdict'], string> = {
  best:  MOSS,
  mid:   AMBER,
  worst: TERRA,
  only:  AMBER,
};

const IMPORT_ORIGINS = [
  'Argentina', 'Uruguay', 'Paraguay', 'Colombia', 'Peru', 'Chile',
  'United States', 'China', 'European Union',
];

const MIN_ORIGINS = 2;
const MAX_ORIGINS = 5;

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const AMBER_BTN_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  background: 'transparent',
  border: '0.5px solid rgba(212,144,10,0.4)',
  borderRadius: 4,
  color: AMBER,
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 10,
  fontFamily: 'ui-monospace, Consolas, monospace',
  letterSpacing: '0.06em',
  transition: 'background 0.15s',
  whiteSpace: 'nowrap',
};

function handleAmberHover(e: React.MouseEvent<HTMLButtonElement>, entering: boolean) {
  e.currentTarget.style.background = entering ? 'rgba(212,144,10,0.1)' : 'transparent';
}

interface Props {
  onBack: () => void;
}

export default function ComparatorScreen({ onBack }: Props) {
  const [commodity, setCommodity]   = useState('coffee');
  const [cifValue,  setCifValue]    = useState(10000);
  const [origins,   setOrigins]     = useState<string[]>(['Argentina', 'Uruguay', 'Paraguay']);
  const [loading,   setLoading]     = useState(false);
  const [error,     setError]       = useState<string | null>(null);
  const [result,    setResult]      = useState<CompareResponse | null>(null);
  const { t } = useLanguage();

  function toggleOrigin(o: string) {
    setOrigins(prev => {
      if (prev.includes(o)) return prev.filter(x => x !== o);
      if (prev.length >= MAX_ORIGINS) return prev;
      return [...prev, o];
    });
  }

  async function handleCompare() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await compareRoutes({
        commodity,
        destination: 'Brazil',
        origins,
        trade_direction: 'import',
        cif_value_usd: cifValue,
      });
      setResult(data);
    } catch {
      setError('Failed to compare routes. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const canCompare = origins.length >= MIN_ORIGINS && origins.length <= MAX_ORIGINS && !loading;
  const maxCost = result ? Math.max(...result.comparisons.map(c => c.landed_cost_brl)) : 0;

  return (
    <div style={{
      minHeight: '100vh', background: BG, color: TEXT,
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${BORDER}`,
        padding: '14px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={onBack} style={AMBER_BTN_STYLE}
            onMouseEnter={e => handleAmberHover(e, true)}
            onMouseLeave={e => handleAmberHover(e, false)}>
            {t('back')}
          </button>
          <div style={{
            fontSize: 13, fontWeight: 700, letterSpacing: 1.5, color: AMBER_LIGHT,
            fontFamily: 'ui-monospace, Consolas, monospace',
          }}>{t('route_comparator')}</div>
        </div>
        <LangToggle />
      </div>

      <main style={{ padding: '24px 28px 60px', maxWidth: 1200, margin: '0 auto' }}>

        {/* Config section */}
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: 8, padding: '20px 24px', marginBottom: 24,
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={{
                display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
                color: TEXT_MUTED, marginBottom: 8, textTransform: 'uppercase' as const,
                fontFamily: 'ui-monospace, Consolas, monospace',
              }}>{t('commodity_label')}</label>
              <select
                value={commodity}
                onChange={e => setCommodity(e.target.value)}
                style={{
                  width: '100%', background: BG, border: `1px solid ${BORDER}`,
                  borderRadius: 6, color: TEXT, fontSize: 14,
                  padding: '10px 12px', outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="coffee">Coffee</option>
                <option value="soybeans">Soybeans</option>
                <option value="fruits">Fruits</option>
              </select>
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
                color: TEXT_MUTED, marginBottom: 8, textTransform: 'uppercase' as const,
                fontFamily: 'ui-monospace, Consolas, monospace',
              }}>{t('destination_label')}</label>
              <div style={{
                background: '#0A1628', border: `1px solid ${AMBER}44`,
                borderRadius: 6, color: AMBER, fontSize: 13,
                padding: '10px 12px', fontFamily: 'ui-monospace, Consolas, monospace',
                fontWeight: 600, letterSpacing: 0.5,
              }}>⬡ Brazil</div>
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
                color: TEXT_MUTED, marginBottom: 8, textTransform: 'uppercase' as const,
                fontFamily: 'ui-monospace, Consolas, monospace',
              }}>{t('cif_value')}</label>
              <input
                type="number"
                min={1}
                value={cifValue}
                onChange={e => setCifValue(Number(e.target.value))}
                style={{
                  width: '100%', background: BG, border: `1px solid ${BORDER}`,
                  borderRadius: 6, color: TEXT, fontSize: 14,
                  padding: '10px 12px', outline: 'none', boxSizing: 'border-box',
                  fontFamily: 'ui-monospace, Consolas, monospace',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{
              display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
              color: TEXT_MUTED, marginBottom: 10, textTransform: 'uppercase' as const,
              fontFamily: 'ui-monospace, Consolas, monospace',
            }}>{t('select_origins')} ({origins.length}/{MAX_ORIGINS})</label>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
              {IMPORT_ORIGINS.map(o => {
                const active = origins.includes(o);
                const disabled = !active && origins.length >= MAX_ORIGINS;
                return (
                  <button
                    key={o}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleOrigin(o)}
                    style={{
                      padding: '6px 14px',
                      fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
                      fontFamily: 'ui-monospace, Consolas, monospace',
                      background: active ? AMBER : 'transparent',
                      color: active ? '#000' : disabled ? '#3A4A60' : TEXT_MUTED,
                      border: `1px solid ${active ? AMBER : BORDER}`,
                      borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {active ? '✓ ' : ''}{o}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleCompare}
            disabled={!canCompare}
            style={{
              alignSelf: 'flex-start',
              background: canCompare ? AMBER : 'rgba(212,144,10,0.25)',
              color: canCompare ? '#000' : '#7A5F1E',
              fontWeight: 700, fontSize: 12, letterSpacing: 2,
              fontFamily: 'ui-monospace, Consolas, monospace',
              border: 'none', borderRadius: 6, cursor: canCompare ? 'pointer' : 'not-allowed',
              padding: '11px 28px', textTransform: 'uppercase' as const,
            }}
          >
            {loading ? t('analyzing_routes') : t('compare_btn')}
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{
            textAlign: 'center', padding: '40px 0', color: TEXT_MUTED,
            fontSize: 13, fontFamily: 'ui-monospace, Consolas, monospace',
          }}>
            ⬡ {t('analyzing_routes')} ({origins.length})
          </div>
        )}

        {error && (
          <div style={{ color: TERRA, fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {/* Results */}
        {result && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Comparative bar */}
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: '18px 22px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
                textTransform: 'uppercase' as const,
                fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 4,
              }}>{t('landed_cost')} · {t('select_origins')}</div>
              {result.comparisons.map(c => {
                const pct = maxCost > 0 ? (c.landed_cost_brl / maxCost) * 100 : 0;
                const col = VERDICT_COLOR[c.verdict];
                return (
                  <div key={c.origin} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      width: 110, fontSize: 11, color: TEXT,
                      fontFamily: 'ui-monospace, Consolas, monospace', flexShrink: 0,
                    }}>{c.origin}</span>
                    <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 4 }} />
                    </div>
                    <span style={{
                      width: 130, textAlign: 'right', fontSize: 11, fontWeight: 700, color: col,
                      fontFamily: 'ui-monospace, Consolas, monospace', flexShrink: 0,
                    }}>{fmtBRL(c.landed_cost_brl)}</span>
                  </div>
                );
              })}
            </div>

            {/* AI Recommendation */}
            {result.recommendation && (
              <div style={{
                background: `${AMBER}0D`,
                border: `1px solid ${AMBER}33`,
                borderRadius: 6, padding: '16px 18px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  color: AMBER_LIGHT, textTransform: 'uppercase' as const,
                }}>{t('ai_recommendation')}</span>
                <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.75 }}>
                  {result.recommendation}
                </div>
              </div>
            )}

            {/* Card grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(result.comparisons.length, 3)}, 1fr)`,
              gap: 16,
            }}>
              {result.comparisons.map(c => (
                <ComparisonCard key={c.origin} comparison={c} t={t} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ComparisonCard({ comparison, t }: { comparison: RouteComparison; t: (k: import('../i18n/translations').TranslationKey) => string }) {
  const col = VERDICT_COLOR[comparison.verdict];
  const calc = comparison.tariff?.calculation as TariffCalculation | undefined;
  const badgeLabel = comparison.verdict === 'best'
    ? `✓ ${t('best_option')}`
    : comparison.verdict === 'worst'
      ? `✗ ${t('highest_cost')}`
      : comparison.verdict === 'only'
        ? `${comparison.origin}`
        : `~ Mid-range`;

  return (
    <div style={{
      background: SURFACE,
      border: `1px solid ${col}`,
      borderRadius: 8, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 12,
      opacity: comparison.verdict === 'worst' ? 0.85 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, fontFamily: 'ui-monospace, Consolas, monospace' }}>
            {comparison.origin}
          </div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>
            {comparison.trade_agreement}
            {comparison.ii_reduction_pct > 0 && ` · ${comparison.ii_reduction_pct}% II reduction`}
          </div>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
          fontFamily: 'ui-monospace, Consolas, monospace',
          color: col, background: `${col}22`,
          border: `1px solid ${col}55`,
          padding: '3px 8px', borderRadius: 3, whiteSpace: 'nowrap' as const,
        }}>{badgeLabel}</span>
      </div>

      <div>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: TEXT_MUTED,
          textTransform: 'uppercase' as const,
          fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 4,
        }}>{t('landed_cost')}</div>
        <div style={{
          fontFamily: 'ui-monospace, Consolas, monospace',
          fontSize: 26, fontWeight: 700, color: col,
        }}>{fmtBRL(comparison.landed_cost_brl)}</div>
        {typeof comparison.savings_vs_worst === 'number' && comparison.savings_vs_worst > 0 && (
          <div style={{ fontSize: 10, color: MOSS, marginTop: 2 }}>
            +{fmtBRL(comparison.savings_vs_worst)} {t('savings_vs')}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div>
          <div style={{ fontSize: 9, color: TEXT_MUTED, textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace' }}>{t('transit')}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, fontFamily: 'ui-monospace, Consolas, monospace' }}>{comparison.transit_days}d</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: TEXT_MUTED, textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace' }}>Risk</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, fontFamily: 'ui-monospace, Consolas, monospace' }}>{comparison.total_risk_score}/100</div>
        </div>
        {calc && (
          <div>
            <div style={{ fontSize: 9, color: TEXT_MUTED, textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace' }}>{t('tax_burden')}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, fontFamily: 'ui-monospace, Consolas, monospace' }}>{calc.tax_burden_pct}%</div>
          </div>
        )}
      </div>

      {calc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
          {[
            { label: 'CIF', value: fmtBRL(calc.cif_brl) },
            { label: `II (${calc.ii_rate_applied}%)`, value: fmtBRL(calc.ii_value) },
            { label: `IPI (${calc.ipi_rate}%)`, value: fmtBRL(calc.ipi_value) },
            { label: 'PIS/COFINS', value: fmtBRL(calc.pis_cofins_value) },
            { label: 'ICMS', value: fmtBRL(calc.icms_value) },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'ui-monospace, Consolas, monospace' }}>
              <span style={{ color: TEXT_MUTED }}>{row.label}</span>
              <span style={{ color: TEXT }}>{row.value}</span>
            </div>
          ))}
          <div style={{ height: 1, background: BORDER, margin: '2px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, fontFamily: 'ui-monospace, Consolas, monospace' }}>
            <span style={{ color: TEXT_MUTED }}>{t('total_taxes')}</span>
            <span style={{ color: TEXT }}>{fmtBRL(calc.total_taxes_brl)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
