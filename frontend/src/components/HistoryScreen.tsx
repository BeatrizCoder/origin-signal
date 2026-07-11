import { useEffect, useState } from 'react';
import type { AnalyzeResponse, HistoryItem } from '../types';
import { getHistory, getAnalysisById } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import LangToggle from './LangToggle';

const AMBER      = '#D4900A';
const AMBER_LIGHT = '#F5B731';
const BG         = '#0B1120';
const SURFACE    = '#131C2E';
const BORDER     = 'rgba(255,255,255,0.06)';
const TEXT       = '#F1F5F9';
const TEXT_MUTED = '#7A90A8';

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  LOW:    { bg: '#0D3321', text: '#34D399' },
  MEDIUM: { bg: '#2D1F00', text: '#FBBF24' },
  HIGH:   { bg: '#2D0D0D', text: '#F87171' },
};

const VERDICT_COLORS: Record<string, string> = {
  Go:      '#34D399',
  Caution: '#FBBF24',
  Hold:    '#F87171',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${time}`;
}

function truncate(text: string, max: number): string {
  if (!text || text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}

interface Props {
  onBack: () => void;
  onSelectAnalysis: (result: AnalyzeResponse) => void;
}

export default function HistoryScreen({ onBack, onSelectAnalysis }: Props) {
  const [items,   setItems]   = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    let cancelled = false;
    getHistory(20)
      .then(data => { if (!cancelled) setItems(data); })
      .catch(() => { if (!cancelled) setError('Failed to load history.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleViewFull(id: string) {
    setOpeningId(id);
    try {
      const doc = await getAnalysisById(id);
      onSelectAnalysis(doc.full_result);
    } catch {
      setError('Failed to load analysis.');
    } finally {
      setOpeningId(null);
    }
  }

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
          <button
            onClick={onBack}
            style={{
              background: 'none', border: `1px solid ${BORDER}`,
              borderRadius: 4, color: TEXT_MUTED,
              padding: '4px 9px', cursor: 'pointer',
              fontSize: 10, fontFamily: 'ui-monospace, Consolas, monospace',
              letterSpacing: 0.8,
            }}
          >
            {t('back')}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              background: AMBER, color: '#000',
              fontFamily: 'ui-monospace, Consolas, monospace',
              fontWeight: 700, fontSize: 12, letterSpacing: 1,
              padding: '4px 8px', borderRadius: 3,
            }}>OS</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: TEXT, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                ORIGINSIGNAL
              </div>
              <div style={{ fontSize: 9, color: TEXT_MUTED, letterSpacing: 1, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                TRADE INTELLIGENCE
              </div>
            </div>
          </div>
        </div>
        <LangToggle />
      </div>

      <main style={{ padding: '24px 28px 60px', maxWidth: 820, margin: '0 auto' }}>
        <div style={{
          fontSize: 13, fontWeight: 700, letterSpacing: 1.5, color: AMBER_LIGHT,
          textTransform: 'uppercase' as const,
          fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 20,
        }}>{t('analysis_history')}</div>

        {loading && (
          <div style={{ color: TEXT_MUTED, fontSize: 13 }}>Loading…</div>
        )}

        {error && (
          <div style={{ color: '#F87171', fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {!loading && items.length === 0 && !error && (
          <div style={{ color: TEXT_MUTED, fontSize: 13 }}>{t('no_history')}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(item => {
            const riskColor = RISK_COLORS[item.risk_level?.toUpperCase()] ?? RISK_COLORS.MEDIUM;
            const verdictColor = VERDICT_COLORS[item.overall_verdict] ?? TEXT_MUTED;
            const isImport = item.trade_direction === 'import';
            const routeLabel = isImport
              ? `${item.origin} → Brazil`
              : `Brazil → ${item.destination}`;

            return (
              <div
                key={item.id}
                style={{
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderLeft: `2px solid ${verdictColor}`,
                  borderRadius: 6,
                  padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                  transition: 'border-left-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderLeftColor = AMBER; }}
                onMouseLeave={e => { e.currentTarget.style.borderLeftColor = verdictColor; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: 10, color: TEXT_MUTED,
                    fontFamily: 'ui-monospace, Consolas, monospace',
                  }}>{formatDate(item.created_at)}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 1,
                    fontFamily: 'ui-monospace, Consolas, monospace',
                    color: isImport ? AMBER : '#34D399',
                    background: isImport ? '#2D1F00' : '#0D3321',
                    padding: '2px 7px', borderRadius: 3,
                  }}>{isImport ? 'IMPORT' : 'EXPORT'}</span>
                </div>

                <div style={{
                  fontSize: 13, fontWeight: 600, color: TEXT,
                  fontFamily: 'ui-monospace, Consolas, monospace',
                }}>
                  {item.commodity?.toUpperCase()} · {routeLabel}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'ui-monospace, Consolas, monospace',
                    fontSize: 18, fontWeight: 700, color: AMBER,
                  }}>{item.overall_risk_score}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 1,
                    fontFamily: 'ui-monospace, Consolas, monospace',
                    padding: '2px 7px', borderRadius: 3,
                    background: riskColor.bg, color: riskColor.text,
                  }}>{item.risk_level?.toUpperCase()}</span>
                  {item.overall_verdict && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: 1,
                      fontFamily: 'ui-monospace, Consolas, monospace',
                      color: verdictColor, border: `1px solid ${verdictColor}44`,
                      padding: '2px 7px', borderRadius: 3,
                    }}>{item.overall_verdict.toUpperCase()}</span>
                  )}
                </div>

                {item.executive_summary && (
                  <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.6 }}>
                    {truncate(item.executive_summary, 120)}
                  </div>
                )}

                <button
                  onClick={() => handleViewFull(item.id)}
                  disabled={openingId !== null}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'none',
                    border: `1px solid ${AMBER}66`,
                    borderRadius: 4,
                    color: AMBER,
                    padding: '5px 10px',
                    cursor: openingId !== null ? 'not-allowed' : 'pointer',
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                    fontFamily: 'ui-monospace, Consolas, monospace',
                    marginTop: 4,
                    opacity: openingId !== null && openingId !== item.id ? 0.5 : 1,
                  }}
                >
                  {openingId === item.id ? t('generating') : t('view_full_analysis').toUpperCase()}
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
