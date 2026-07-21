import { useEffect, useState } from 'react';
import type { AnalyzeResponse, HistoryItem } from '../types';
import { getHistory, getAnalysisById } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import LangToggle from './LangToggle';
import Logo from './ui/Logo';
import BackButton from './ui/BackButton';
import PillChip from './ui/PillChip';
import Eyebrow from './ui/Eyebrow';
import { COLORS, FONT } from '../theme';

const RISK_BADGE_COLOR: Record<string, string> = {
  LOW: COLORS.petroleo, MEDIUM: COLORS.amberBright, HIGH: COLORS.danger,
};

const VERDICT_COLORS: Record<string, string> = {
  Go:      COLORS.petroleo,
  Caution: COLORS.amberBright,
  Hold:    COLORS.danger,
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
    <div style={{ minHeight: '100vh', color: COLORS.textPrimary, fontFamily: FONT }}>
      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${COLORS.line}`,
        padding: '16px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <BackButton onClick={onBack} label={t('back')} />
          <Logo size="sm" tagline="TRADE INTELLIGENCE" />
        </div>
        <LangToggle />
      </div>

      <main style={{ padding: '24px 28px 60px', maxWidth: 820, margin: '0 auto' }}>
        <Eyebrow>{t('analysis_history')}</Eyebrow>

        {loading && (
          <div style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 8 }}>Loading…</div>
        )}

        {error && (
          <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 8, marginBottom: 16 }}>{error}</div>
        )}

        {!loading && items.length === 0 && !error && (
          <div style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 8 }}>{t('no_history')}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {items.map(item => {
            const badgeColor = RISK_BADGE_COLOR[item.risk_level?.toUpperCase()] ?? RISK_BADGE_COLOR.MEDIUM;
            const verdictColor = VERDICT_COLORS[item.overall_verdict] ?? COLORS.textSecondary;
            const isImport = item.trade_direction === 'import';
            const routeLabel = isImport
              ? `${item.origin} → Brazil`
              : `Brazil → ${item.destination}`;

            return (
              <div
                key={item.id}
                style={{
                  background: COLORS.panel,
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderLeft: `2px solid ${verdictColor}`,
                  borderRadius: 8,
                  padding: '16px 18px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                  transition: 'border-left-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderLeftColor = COLORS.amberBright; }}
                onMouseLeave={e => { e.currentTarget.style.borderLeftColor = verdictColor; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: FONT }}>{formatDate(item.created_at)}</span>
                  <PillChip color={isImport ? COLORS.amberBright : COLORS.petroleo}>{isImport ? 'IMPORT' : 'EXPORT'}</PillChip>
                </div>

                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, fontFamily: FONT }}>
                  {item.commodity?.toUpperCase()} · {routeLabel}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: FONT, fontSize: 20, fontWeight: 800, color: COLORS.amberBright }}>{item.overall_risk_score}</span>
                  <PillChip color={badgeColor}>{item.risk_level?.toUpperCase()}</PillChip>
                  {item.overall_verdict && (
                    <PillChip color={verdictColor} outline>{item.overall_verdict.toUpperCase()}</PillChip>
                  )}
                </div>

                {item.executive_summary && (
                  <div style={{ fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 1.6, fontFamily: FONT }}>
                    {truncate(item.executive_summary, 120)}
                  </div>
                )}

                <button
                  onClick={() => handleViewFull(item.id)}
                  disabled={openingId !== null}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'none',
                    border: `1px solid ${COLORS.amber}66`,
                    borderRadius: 6,
                    color: COLORS.amberBright,
                    padding: '6px 12px',
                    cursor: openingId !== null ? 'not-allowed' : 'pointer',
                    fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                    fontFamily: FONT,
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
