import { useState } from 'react';
import type { CompareResponse, RouteComparison, TariffCalculation } from '../types';
import { compareRoutes } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import LangToggle from './LangToggle';
import ScreenHeader from './ui/ScreenHeader';
import Eyebrow from './ui/Eyebrow';
import HexDivider from './ui/HexDivider';
import PillChip from './ui/PillChip';
import { COLORS, FONT } from '../theme';

const VERDICT_COLOR: Record<RouteComparison['verdict'], string> = {
  best:  COLORS.petroleo,
  mid:   COLORS.amberBright,
  worst: COLORS.danger,
  only:  COLORS.amberBright,
};

const IMPORT_ORIGINS = [
  'United States', 'China', 'European Union', 'Norway', 'Switzerland',
  'United Kingdom', 'Argentina', 'Colombia', 'Peru', 'Chile',
  'Uruguay', 'Paraguay', 'Vietnam', 'Ethiopia',
];

const MIN_ORIGINS = 2;
const MAX_ORIGINS = 5;

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
  color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase' as const,
  fontFamily: FONT,
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', background: COLORS.bg, border: `1px solid ${COLORS.line}`,
  borderRadius: 6, color: COLORS.textPrimary, fontSize: 14,
  padding: '10px 12px', outline: 'none', boxSizing: 'border-box',
  fontFamily: FONT,
};

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
    <div style={{ minHeight: '100vh', color: COLORS.textPrimary, fontFamily: FONT }}>
      <ScreenHeader
        title={t('route_comparator')}
        backLabel={t('back')}
        onBack={onBack}
        right={<LangToggle />}
      />

      <main style={{ padding: '24px 28px 60px', maxWidth: 1200, margin: '0 auto' }}>

        {/* Config section */}
        <div style={{
          background: COLORS.panel, border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: 10, padding: '20px 24px', marginBottom: 24,
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={LABEL_STYLE}>{t('commodity_label')}</label>
              <select
                value={commodity}
                onChange={e => setCommodity(e.target.value)}
                style={{ ...INPUT_STYLE, cursor: 'pointer' }}
              >
                <option value="coffee">Coffee</option>
                <option value="soybeans">Soybeans</option>
                <option value="fruits">Fruits</option>
              </select>
            </div>

            <div>
              <label style={LABEL_STYLE}>{t('destination_label')}</label>
              <div style={{
                background: 'rgba(0,0,0,0.2)', border: `1px solid ${COLORS.amber}44`,
                borderRadius: 6, color: COLORS.amberBright, fontSize: 13,
                padding: '10px 12px', fontFamily: FONT,
                fontWeight: 700, letterSpacing: 0.5,
              }}>⬡ Brazil</div>
            </div>

            <div>
              <label style={LABEL_STYLE}>{t('cif_value')}</label>
              <input
                type="number"
                min={1}
                value={cifValue}
                onChange={e => setCifValue(Number(e.target.value))}
                style={INPUT_STYLE}
              />
            </div>
          </div>

          <div>
            <label style={{ ...LABEL_STYLE, marginBottom: 10 }}>{t('select_origins')} ({origins.length}/{MAX_ORIGINS})</label>
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
                      fontFamily: FONT,
                      background: active ? COLORS.amber : 'transparent',
                      color: active ? '#1A1204' : disabled ? '#3A4A60' : COLORS.textSecondary,
                      border: `1px solid ${active ? COLORS.amber : COLORS.line}`,
                      borderRadius: 20, cursor: disabled ? 'not-allowed' : 'pointer',
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
              background: canCompare ? COLORS.amber : 'rgba(217,119,6,0.25)',
              color: canCompare ? '#1A1204' : '#7A5F1E',
              fontWeight: 700, fontSize: 12, letterSpacing: 2,
              fontFamily: FONT,
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
            textAlign: 'center', padding: '40px 0', color: COLORS.textSecondary,
            fontSize: 13, fontFamily: FONT,
          }}>
            ⬡ {t('analyzing_routes')} ({origins.length})
          </div>
        )}

        {error && (
          <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {/* Results */}
        {result && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Comparative bar */}
            <div style={{
              background: COLORS.panel, border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: 10, padding: '18px 22px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <Eyebrow>{t('landed_cost')} · {t('select_origins')}</Eyebrow>
              {result.comparisons.map(c => {
                const pct = maxCost > 0 ? (c.landed_cost_brl / maxCost) * 100 : 0;
                const col = VERDICT_COLOR[c.verdict];
                return (
                  <div key={c.origin} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      width: 110, fontSize: 11, color: COLORS.textPrimary,
                      fontFamily: FONT, flexShrink: 0,
                    }}>{c.origin}</span>
                    <div style={{ flex: 1, height: 8, background: 'rgba(245,243,238,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 4, transition: 'width 0.4s ease' }} />
                    </div>
                    <span style={{
                      width: 130, textAlign: 'right', fontSize: 11, fontWeight: 700, color: col,
                      fontFamily: FONT, flexShrink: 0,
                    }}>{fmtBRL(c.landed_cost_brl)}</span>
                  </div>
                );
              })}
            </div>

            {/* AI Recommendation */}
            {result.recommendation && (
              <div style={{
                background: 'rgba(245,158,11,0.06)',
                border: `1px solid ${COLORS.amber}33`,
                borderRadius: 8, padding: '16px 18px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <Eyebrow>{t('ai_recommendation')}</Eyebrow>
                <div style={{ fontSize: 13, color: COLORS.textPrimary, lineHeight: 1.75 }}>
                  {result.recommendation}
                </div>
              </div>
            )}

            <HexDivider />

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
      background: COLORS.panel,
      border: `1px solid ${col}`,
      borderRadius: 10, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 12,
      opacity: comparison.verdict === 'worst' ? 0.85 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.textPrimary, fontFamily: FONT }}>
            {comparison.origin}
          </div>
          <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 2, fontFamily: FONT }}>
            {comparison.trade_agreement}
            {comparison.ii_reduction_pct > 0 && ` · ${comparison.ii_reduction_pct}% II reduction`}
          </div>
        </div>
        <PillChip color={col}>{badgeLabel}</PillChip>
      </div>

      <div>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: COLORS.textSecondary,
          textTransform: 'uppercase' as const,
          fontFamily: FONT, marginBottom: 4,
        }}>{t('landed_cost')}</div>
        <div style={{
          fontFamily: FONT,
          fontSize: 26, fontWeight: 800, color: col,
        }}>{fmtBRL(comparison.landed_cost_brl)}</div>
        {typeof comparison.savings_vs_worst === 'number' && comparison.savings_vs_worst > 0 && (
          <div style={{ fontSize: 10, color: COLORS.petroleo, marginTop: 2, fontFamily: FONT }}>
            +{fmtBRL(comparison.savings_vs_worst)} {t('savings_vs')}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div>
          <div style={{ fontSize: 9, color: COLORS.textSecondary, textTransform: 'uppercase' as const, fontFamily: FONT }}>{t('transit')}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary, fontFamily: FONT }}>{comparison.transit_days}d</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: COLORS.textSecondary, textTransform: 'uppercase' as const, fontFamily: FONT }}>Risk</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary, fontFamily: FONT }}>{comparison.total_risk_score}/100</div>
        </div>
        {calc && (
          <div>
            <div style={{ fontSize: 9, color: COLORS.textSecondary, textTransform: 'uppercase' as const, fontFamily: FONT }}>{t('tax_burden')}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary, fontFamily: FONT }}>{calc.tax_burden_pct}%</div>
          </div>
        )}
      </div>

      {calc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: `1px solid ${COLORS.line}`, paddingTop: 10 }}>
          {[
            { label: 'CIF', value: fmtBRL(calc.cif_brl) },
            { label: `II (${calc.ii_rate_applied}%)`, value: fmtBRL(calc.ii_value) },
            { label: `IPI (${calc.ipi_rate}%)`, value: fmtBRL(calc.ipi_value) },
            { label: 'PIS/COFINS', value: fmtBRL(calc.pis_cofins_value) },
            { label: 'ICMS', value: fmtBRL(calc.icms_value) },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: FONT }}>
              <span style={{ color: COLORS.textSecondary }}>{row.label}</span>
              <span style={{ color: COLORS.textPrimary }}>{row.value}</span>
            </div>
          ))}
          <div style={{ height: 1, background: COLORS.line, margin: '2px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, fontFamily: FONT }}>
            <span style={{ color: COLORS.textSecondary }}>{t('total_taxes')}</span>
            <span style={{ color: COLORS.textPrimary }}>{fmtBRL(calc.total_taxes_brl)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
