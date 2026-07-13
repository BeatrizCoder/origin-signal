import { useState, useEffect } from 'react';
import type { OptimizationResult, OptimizationRegion } from '../types';
import { optimizeHoneycomb } from '../services/api';
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

const MIN_BUDGET  = 50_000;
const MAX_BUDGET  = 2_000_000;
const STEP_BUDGET = 50_000;

const PRIORITY_BADGE: Record<number, { bg: string; text: string }> = {
  1: { bg: '#3D2E00', text: '#FFD700' },
  2: { bg: '#2A2A2A', text: '#C0C0C0' },
  3: { bg: '#3D2410', text: '#CD7F32' },
};

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

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

function priorityBadgeStyle(priority: number): { bg: string; text: string } {
  return PRIORITY_BADGE[priority] ?? { bg: 'rgba(255,255,255,0.06)', text: TEXT_MUTED };
}

interface Props {
  onBack: () => void;
}

export default function OptimizationScreen({ onBack }: Props) {
  const [commodity, setCommodity] = useState('coffee');
  const [budget,    setBudget]    = useState(500_000);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [result,    setResult]    = useState<OptimizationResult | null>(null);
  const [dispCurrent,   setDispCurrent]   = useState(0);
  const [dispProjected, setDispProjected] = useState(0);
  const { t } = useLanguage();

  async function handleOptimize() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await optimizeHoneycomb(budget, commodity);
      setResult(data);
    } catch {
      setError('Failed to run optimization. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!result) return;
    setDispCurrent(0);
    setDispProjected(0);
    const steps = 24;
    const durationMs = 600;
    let i = 0;
    const id = setInterval(() => {
      i++;
      const frac = Math.min(1, i / steps);
      setDispCurrent(Math.round(result.current_hes * frac * 10) / 10);
      setDispProjected(Math.round(result.projected_hes * frac * 10) / 10);
      if (frac >= 1) clearInterval(id);
    }, durationMs / steps);
    return () => clearInterval(id);
  }, [result]);

  const maxRoi = result ? Math.max(...result.selected_regions.map(r => r.roi), 0.0001) : 0;
  const budgetPct = result ? Math.min(100, (result.budget_used_brl / result.budget_brl) * 100) : 0;

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
          }}>⬡ {t('optimization_engine')}</div>
        </div>
        <LangToggle />
      </div>

      <main style={{ padding: '24px 28px 60px', maxWidth: 1100, margin: '0 auto' }}>

        <div style={{
          fontSize: 12, color: TEXT_MUTED, marginBottom: 24,
          fontFamily: 'ui-monospace, Consolas, monospace',
        }}>{t('optimization_subtitle')}</div>

        {/* Config section */}
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: 8, padding: '20px 24px', marginBottom: 24,
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
            <div>
              <label style={{
                display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
                color: TEXT_MUTED, marginBottom: 10, textTransform: 'uppercase' as const,
                fontFamily: 'ui-monospace, Consolas, monospace',
              }}>{t('budget_label')}</label>
              <input
                type="range"
                min={MIN_BUDGET}
                max={MAX_BUDGET}
                step={STEP_BUDGET}
                value={budget}
                onChange={e => setBudget(Number(e.target.value))}
                style={{ width: '100%', accentColor: AMBER, cursor: 'pointer' }}
              />
              <div style={{
                fontFamily: 'ui-monospace, Consolas, monospace',
                fontSize: 22, fontWeight: 700, color: AMBER_LIGHT, marginTop: 8,
              }}>{fmtBRL(budget)}</div>
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
                color: TEXT_MUTED, marginBottom: 10, textTransform: 'uppercase' as const,
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
          </div>

          <button
            onClick={handleOptimize}
            disabled={loading}
            style={{
              alignSelf: 'flex-start',
              background: loading ? 'rgba(212,144,10,0.25)' : AMBER,
              color: loading ? '#7A5F1E' : '#000',
              fontWeight: 700, fontSize: 12, letterSpacing: 2,
              fontFamily: 'ui-monospace, Consolas, monospace',
              border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
              padding: '11px 28px', textTransform: 'uppercase' as const,
            }}
          >
            {loading ? '...' : t('optimize_btn')}
          </button>
        </div>

        {error && (
          <div style={{ color: '#F87171', fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {/* Results */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* 3 impact cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={{
                background: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: '16px 18px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
                  textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace',
                }}>{t('budget_used')}</div>
                <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 16, color: TEXT }}>
                  {fmtBRL(result.budget_used_brl)} / {fmtBRL(result.budget_brl)}
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${budgetPct}%`, background: AMBER, borderRadius: 3 }} />
                </div>
              </div>

              <div style={{
                background: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: '16px 18px',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
                  textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace',
                }}>{t('regions_selected')}</div>
                <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 36, fontWeight: 700, color: AMBER_LIGHT }}>
                  {result.total_regions_selected}
                </div>
              </div>

              <div style={{
                background: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: '16px 18px',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
                  textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace',
                }}>{t('volume_unlocked')}</div>
                <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 36, fontWeight: 700, color: MOSS }}>
                  {result.total_unlock_kt} <span style={{ fontSize: 14, color: TEXT_MUTED }}>kt</span>
                </div>
              </div>
            </div>

            {/* HES before -> after */}
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: '20px 24px',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
                textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace',
              }}>{t('hes_improvement')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <span style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 40, fontWeight: 700, color: '#F87171' }}>
                  {dispCurrent}%
                </span>
                <span style={{ fontSize: 24, color: TEXT_MUTED }}>→</span>
                <span style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 40, fontWeight: 700, color: MOSS }}>
                  {dispProjected}%
                </span>
                <span style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 16, color: AMBER_LIGHT }}>
                  (+{result.hes_gain}pp)
                </span>
              </div>
            </div>

            {/* Selected regions table */}
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: '20px 24px',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '70px 1.3fr 1fr 1fr 1fr 1.2fr',
                gap: 8, fontSize: 9, fontWeight: 700, letterSpacing: 1, color: TEXT_MUTED,
                textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace',
                paddingBottom: 8, borderBottom: `1px solid ${BORDER}`,
              }}>
                <span>{t('priority')}</span>
                <span>Region</span>
                <span>{t('investment')}</span>
                <span>{t('volume_unlocked')}</span>
                <span>{t('current_risk')}</span>
                <span>ROI</span>
              </div>
              {result.selected_regions.map((r: OptimizationRegion) => {
                const badge = priorityBadgeStyle(r.priority);
                return (
                  <div key={r.region} style={{
                    display: 'grid',
                    gridTemplateColumns: '70px 1.3fr 1fr 1fr 1fr 1.2fr',
                    gap: 8, alignItems: 'center', fontSize: 12,
                    fontFamily: 'ui-monospace, Consolas, monospace',
                  }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
                      padding: '3px 8px', borderRadius: 3, alignSelf: 'start',
                      background: badge.bg, color: badge.text,
                    }}>#{r.priority}</span>
                    <span style={{ color: TEXT }}>{r.region}</span>
                    <span style={{ color: TEXT }}>R$ {(r.cost_brl_k * 1000).toLocaleString('pt-BR')}</span>
                    <span style={{ color: MOSS }}>{r.unlock_kt} kt</span>
                    <span style={{ color: TEXT_MUTED }}>{r.current_risk}/100</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(r.roi / maxRoi) * 100}%`, background: AMBER, borderRadius: 3 }} />
                      </div>
                      <span style={{ color: AMBER_LIGHT, fontSize: 10, minWidth: 42, textAlign: 'right' as const }}>{r.roi.toFixed(3)}</span>
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mathematical basis */}
            <div style={{
              background: `${AMBER}0D`, border: `1px solid ${AMBER}33`,
              borderRadius: 6, padding: '16px 18px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                fontFamily: 'ui-monospace, Consolas, monospace',
                color: AMBER_LIGHT, textTransform: 'uppercase' as const,
              }}>{t('mathematical_basis')}</span>
              <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.75 }}>
                {result.mathematical_basis}
              </div>
              <div style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                Learn more about Honeycomb Conjecture →
              </div>
            </div>

            {/* Excluded regions */}
            {result.excluded_regions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: TEXT_MUTED,
                  textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace',
                }}>{t('excluded_regions')}</div>
                {result.excluded_regions.map(r => {
                  const additional = Math.max(0, r.cost_brl_k * 1000 - result.budget_remaining_brl);
                  return (
                    <div key={r.region} style={{ fontSize: 12, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                      {r.region} — {fmtBRL(additional)} {t('additional_needed')}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
