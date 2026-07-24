import { useEffect, useMemo, useState } from 'react';
import type { AnalyzeResponse, TariffCalculation, AgentObservability } from '../types';
import { getRiskLevel } from '../types';
import HexMap from './HexMap';
import GlobalHeatMap from './GlobalHeatMap';
import { analyzeRoute } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import LangToggle from './LangToggle';
import Logo from './ui/Logo';
import Eyebrow from './ui/Eyebrow';
import HexDivider from './ui/HexDivider';
import PillChip from './ui/PillChip';
import ProgressMeter from './ui/ProgressMeter';
import BriefingBlock from './ui/BriefingBlock';
import PipelineStrip from './ui/PipelineStrip';
import RevealSection from './ui/RevealSection';
import { COLORS, FONT, riskColor } from '../theme';

type Tab = 'analysis' | 'map' | 'global' | 'ai';

const RISK_BADGE_COLOR: Record<string, string> = {
  LOW: COLORS.petroleo, MEDIUM: COLORS.amberBright, HIGH: COLORS.danger,
};

const SEV_COLORS: Record<string, string> = {
  critical: COLORS.danger,
  high:     COLORS.amberBright,
  medium:   COLORS.petroleo,
};

const HES_COLORS: Record<string, string> = {
  Critical: COLORS.danger,
  Low:      COLORS.bronze,
  Moderate: COLORS.amberBright,
  Good:     COLORS.petroleo,
};

const PIPELINE_STEPS = [
  { id: 'climate',    icon: '🌦', label: 'Climate Intelligence' },
  { id: 'regulatory', icon: '⚖',  label: 'Regulatory Intelligence' },
  { id: 'market',     icon: '📈', label: 'Market Intelligence' },
  { id: 'logistics',  icon: '🚢', label: 'Logistics Intelligence' },
  { id: 'gap',        icon: '🐝', label: 'Due Diligence Engine' },
  { id: 'executive',  icon: '🧠', label: 'Executive AI Synthesis' },
];

const AGENT_ICONS: Record<string, string> = {
  'Climate Intelligence':    '🌦',
  'Regulatory Intelligence': '⚖',
  'Market Intelligence':     '📈',
  'Logistics Intelligence':  '🚢',
  'Due Diligence Engine':    '🐝',
  'Executive AI Synthesis':  '🧠',
};

const FRESHNESS_LABELS: Record<string, string> = {
  climate:    'Climate',
  regulatory: 'Regulatory',
  market:     'Market',
  logistics:  'Logistics',
};

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// higher-is-better coloring (readiness, GPS coverage) — inverse of theme.riskColor
function goodColor(v: number): string {
  if (v >= 70) return COLORS.petroleo;
  if (v >= 40) return COLORS.amberBright;
  return COLORS.danger;
}

function confidenceColor(v: number): string {
  if (v >= 75) return COLORS.petroleo;
  if (v >= 50) return COLORS.amberBright;
  return COLORS.danger;
}

const CARD: React.CSSProperties = {
  background: COLORS.panel, border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: 10, padding: '22px 26px',
};

const CALLOUT: React.CSSProperties = {
  background: 'rgba(245,158,11,0.06)', border: `1px solid ${COLORS.amber}44`,
  borderRadius: 8, padding: '14px 16px',
  fontSize: 13, color: COLORS.textPrimary, lineHeight: 1.7,
  display: 'flex', gap: 10, alignItems: 'flex-start', fontFamily: FONT,
};

const ACTION_BTN: React.CSSProperties = {
  flex: '0 1 auto',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  background: 'transparent',
  border: `1px solid rgba(217,119,6,0.4)`,
  borderRadius: 20,
  color: COLORS.amberBright,
  padding: '5px 12px',
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: FONT,
  fontWeight: 600,
  letterSpacing: 0.2,
  transition: 'background 0.15s',
  whiteSpace: 'nowrap',
};

function handleAmberHover(e: React.MouseEvent<HTMLButtonElement>, entering: boolean) {
  e.currentTarget.style.background = entering ? 'rgba(217,119,6,0.12)' : 'transparent';
}

function MetricCard({ label, value, unit, color, sub }: {
  label: string; value: string; unit: string; color: string; sub: string;
}) {
  return (
    <div style={{
      background: COLORS.panel, border: '1px solid rgba(255,255,255,0.04)',
      borderRadius: 10, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: COLORS.textSecondary,
        textTransform: 'uppercase' as const, fontFamily: FONT,
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontFamily: FONT, fontSize: 34, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
        <span style={{ fontFamily: FONT, fontSize: 13, color: COLORS.textSecondary }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11.5, color: COLORS.textSecondary, fontFamily: FONT }}>{sub}</div>
    </div>
  );
}

function SignalRow({ icon, color, text, detail }: { icon: string; color: string; text: string; detail?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontFamily: FONT, color: COLORS.textPrimary }}>
      <i className={icon} style={{ width: 18, color, flexShrink: 0, textAlign: 'center' as const }} />
      <span>{text}</span>
      {detail && <span style={{ color: COLORS.textSecondary, fontSize: 12.5, marginLeft: 2 }}>— {detail}</span>}
    </div>
  );
}

interface Props {
  result: AnalyzeResponse;
  commodity: string;
  horizon: string;
  origin: string;
  destination: string;
  tradeDirection: 'export' | 'import';
  onNewAnalysis: () => void;
  onHistory: () => void;
  onCompare: () => void;
  onOptimize: () => void;
  onAuditPath: () => void;
  onAnalyzeRoute?: (origin: string, destination: string, tradeDirection: 'export' | 'import') => void;
}

export default function DashboardScreen({ result, commodity, horizon, origin, destination, tradeDirection, onNewAnalysis, onHistory, onCompare, onOptimize, onAuditPath, onAnalyzeRoute }: Props) {
  const [activeTab,   setActiveTab]   = useState<Tab>('analysis');
  const [downloading, setDownloading] = useState<'pdf' | 'excel' | null>(null);
  const [pipelineActive, setPipelineActive] = useState(0);
  const [revealedSections, setRevealedSections] = useState<Set<string>>(new Set());
  const [linkCopied, setLinkCopied] = useState(false);
  const { t } = useLanguage();
  const isImport = tradeDirection === 'import';

  async function handleShare() {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function handleExport(format: 'pdf' | 'excel') {
    setDownloading(format);
    try {
      const resp = await fetch(`http://localhost:8000/api/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `originsignal_${new Date().toISOString().slice(0, 10)}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  async function handleAnalyzeRegion(regionName: string) {
    const data = await analyzeRoute({
      query: `Trade risk assessment for ${regionName}${isImport ? '' : ' region'}`,
      commodity,
      origin: isImport ? regionName : 'Brazil',
      destination: isImport ? 'Brazil' : destination,
      origin_region: isImport ? undefined : regionName,
      trade_direction: tradeDirection,
    });
    return {
      regulatory: data.regulatory.risk_score,
      climate:    data.climate.climate_risk_score,
      market:     data.market.market_risk_score,
      logistics:  data.logistics.logistics_risk_score,
    };
  }

  const score      = clamp(result.overall_risk_score ?? result.risk_score);
  const riskLevel  = getRiskLevel(score);
  const readiness  = clamp(result.export_readiness ?? (100 - result.risk_score));
  const exec       = result.executive;
  const verdict    = exec?.overall_verdict;
  const verdictColor = verdict === 'Go' ? COLORS.petroleo : verdict === 'Hold' ? COLORS.danger : COLORS.amberBright;

  const obs = result.observability;

  const dims = [
    { key: 'regulatory' as const, value: clamp(result.regulatory?.risk_score ?? result.risk_score) },
    { key: 'market'     as const, value: clamp(result.market?.market_risk_score ?? 50) },
    { key: 'climate'    as const, value: clamp(result.climate?.climate_risk_score ?? 55) },
    { key: 'logistics'  as const, value: clamp(result.logistics?.logistics_risk_score ?? 44) },
    ...(isImport && result.tariff ? [{ key: 'tariff' as const, value: clamp(result.tariff.tariff_risk_score) }] : []),
  ];

  const gpsPct      = result.gap?.supplier_profile?.gps_coverage_pct ?? 0;
  const originPort  = result.logistics?.origin_port ?? 'Santos';
  const destPort    = result.logistics?.destination_port ?? 'Hamburg';
  const transitDays = result.logistics?.estimated_transit_days ?? 18;
  const marketScore = clamp(result.market?.market_risk_score ?? 50);

  const riskBadge = riskLevel === 'HIGH' ? t('high') : riskLevel === 'MEDIUM' ? t('medium') : t('low');
  const verdictLabel = verdict === 'Go' ? t('go') : verdict === 'Hold' ? t('hold') : t('caution');

  const sectionOrder = useMemo(() => {
    const order: string[] = ['hero', 'metrics'];
    if (exec?.key_risks && exec.key_risks.length > 0) order.push('priorities');
    if (result.honeycomb) order.push('hes');
    if (result.propagation) order.push('propagation');
    order.push('traderoute');
    if (isImport && result.tariff && result.tariff.ncm_code) order.push('tariff');
    order.push('memo');
    return order;
  }, [result, exec, isImport]);

  useEffect(() => {
    setPipelineActive(0);
    setRevealedSections(new Set());

    const pipelineTimers = PIPELINE_STEPS.map((_, i) =>
      setTimeout(() => setPipelineActive(c => Math.max(c, i + 1)), (i + 1) * 120)
    );
    const sectionTimers = sectionOrder.map((id, i) =>
      setTimeout(() => setRevealedSections(prev => new Set(prev).add(id)), (i + 1) * 120)
    );

    return () => {
      pipelineTimers.forEach(clearTimeout);
      sectionTimers.forEach(clearTimeout);
    };
  }, [result, sectionOrder]);

  const decisionTraceInputs = [
    { label: t('regulatory'), value: clamp(result.regulatory?.risk_score ?? 0) },
    { label: t('climate'),    value: clamp(result.climate?.climate_risk_score ?? 0) },
    { label: t('market'),     value: clamp(result.market?.market_risk_score ?? 0) },
    { label: t('logistics'),  value: clamp(result.logistics?.logistics_risk_score ?? 0) },
    { label: 'Gap',           value: clamp(result.gap?.gap_risk_score ?? 0) },
  ];
  const decisionTrace =
    decisionTraceInputs.map(d => `${d.label} ${d.value}`).join(' + ') +
    ` → weighted average → ${t('trade_risk_score')} ${score} → Executive synthesis → ${verdict ? verdictLabel.toUpperCase() : '—'} verdict`;

  const mapTitle = isImport
    ? 'SUPPLY ORIGIN RISK MAP · IMPORT SOURCES'
    : `HONEYCOMB RISK MAP · ${commodity === 'soybeans' ? 'SOYBEAN' : commodity === 'fruits' ? 'FRUIT' : 'COFFEE'} PRODUCING REGIONS · BRAZIL`;

  // Hero signal rows — derived from real result fields, no invented data
  const priceTrend = result.market?.price_trend ?? 'Stable';
  const trendLower = priceTrend.toLowerCase();
  const trendUp   = /up|ris|alta/.test(trendLower);
  const trendDown = /down|fall|queda|baixa/.test(trendLower);
  const marketSignal = trendUp
    ? { icon: 'fas fa-arrow-trend-up', color: COLORS.bronze, text: 'Market pressure trending up' }
    : trendDown
    ? { icon: 'fas fa-arrow-trend-down', color: COLORS.petroleo, text: 'Market pressure easing' }
    : { icon: 'fas fa-minus', color: COLORS.textSecondary, text: 'Market pressure stable' };

  const climateLevel = result.climate?.risk_level ?? 'Stable';
  const climateScore = clamp(result.climate?.climate_risk_score ?? 50);
  const climateSignal = {
    icon: climateScore >= 66 ? 'fas fa-cloud-bolt' : 'fas fa-cloud-sun',
    color: riskColor(climateScore),
    text: `Climate risk: ${climateLevel}`,
  };

  const gapSignal = gpsPct >= 100
    ? { icon: 'fas fa-circle-check', color: COLORS.petroleo, text: 'Full EUDR traceability', detail: '100% GPS coverage confirmed' }
    : { icon: 'fas fa-triangle-exclamation', color: COLORS.amberBright, text: 'EUDR traceability gap', detail: `${100 - gpsPct}% GPS coverage pending` };

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      color: COLORS.textPrimary, fontFamily: FONT,
    }}>

      {/* ═══════════════════════════════════════
          LEFT SIDEBAR — 300px fixed
      ═══════════════════════════════════════ */}
      <aside style={{
        width: 300, flexShrink: 0,
        background: COLORS.panelSoft,
        borderRight: `1px solid ${COLORS.line}`,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Logo + action buttons */}
        <div style={{
          padding: '16px 18px',
          borderBottom: `1px solid ${COLORS.line}`,
          display: 'flex', flexDirection: 'column', gap: 12,
          flexShrink: 0,
        }}>
          <Logo size="sm" tagline="TRADE INTELLIGENCE" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
            <button onClick={onHistory} style={ACTION_BTN} onMouseEnter={e => handleAmberHover(e, true)} onMouseLeave={e => handleAmberHover(e, false)}>
              <i className="fas fa-clock-rotate-left" /> {t('history')}
            </button>
            <button onClick={onCompare} style={ACTION_BTN} onMouseEnter={e => handleAmberHover(e, true)} onMouseLeave={e => handleAmberHover(e, false)}>
              <i className="fas fa-right-left" /> {t('compare_routes')}
            </button>
            <button onClick={onOptimize} style={ACTION_BTN} onMouseEnter={e => handleAmberHover(e, true)} onMouseLeave={e => handleAmberHover(e, false)}>
              <i className="fas fa-diagram-project" /> {t('optimize')}
            </button>
            <button onClick={onAuditPath} style={ACTION_BTN} onMouseEnter={e => handleAmberHover(e, true)} onMouseLeave={e => handleAmberHover(e, false)}>
              <i className="fas fa-route" /> {t('audit_path')}
            </button>
            <button onClick={onNewAnalysis} style={ACTION_BTN} onMouseEnter={e => handleAmberHover(e, true)} onMouseLeave={e => handleAmberHover(e, false)}>
              <i className="fas fa-compass" /> {t('new_analysis')}
            </button>
          </div>
        </div>

        {/* Export buttons */}
        <div style={{
          padding: '10px 18px',
          borderBottom: `1px solid ${COLORS.line}`,
          display: 'flex', gap: 8, flexShrink: 0,
        }}>
          {(['pdf', 'excel'] as const).map(fmt => (
            <button
              key={fmt}
              onClick={() => handleExport(fmt)}
              disabled={downloading !== null}
              style={{
                flex: 1,
                background: 'none',
                border: `1px solid ${downloading === fmt ? COLORS.line : `${COLORS.amber}66`}`,
                borderRadius: 6,
                color: downloading === fmt ? COLORS.textSecondary : COLORS.amberBright,
                padding: '6px 8px',
                cursor: downloading !== null ? 'not-allowed' : 'pointer',
                fontSize: 11,
                fontFamily: FONT,
                letterSpacing: 0.3,
                opacity: downloading !== null && downloading !== fmt ? 0.45 : 1,
                transition: 'all 0.15s',
              }}
            >
              {downloading === fmt ? t('generating') : fmt === 'pdf' ? t('export_pdf') : t('export_excel')}
            </button>
          ))}
          <button
            onClick={handleShare}
            style={{
              flex: 1,
              background: 'none',
              border: `1px solid ${COLORS.amber}66`,
              borderRadius: 6,
              color: COLORS.amberBright,
              padding: '6px 8px',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: FONT,
              letterSpacing: 0.3,
              transition: 'all 0.15s',
            }}
          >
            {linkCopied ? t('link_copied') : `🔗 ${t('share')}`}
          </button>
        </div>

        {/* Scrollable sidebar body */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '18px',
          display: 'flex', flexDirection: 'column', gap: 22,
        }}>

          {/* Active Query */}
          <div style={{
            background: 'rgba(0,0,0,0.15)', border: `1px solid ${COLORS.line}`,
            borderRadius: 8, padding: '12px 14px',
          }}>
            <Eyebrow>{t('active_query')}</Eyebrow>
            <div style={{ fontSize: 12.5, color: COLORS.textPrimary, lineHeight: 1.6, margin: '4px 0 10px' }}>
              {result.query ||
                `Analyze composite risk for ${commodity} exports from Brazil to the European Union over ${horizon} days`}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
              <PillChip color={COLORS.amberBright}>{commodity.toUpperCase()}</PillChip>
              <PillChip color={COLORS.amberBright}>{isImport ? `${origin.slice(0, 2).toUpperCase()}→BR` : `BR→${destination.slice(0, 2).toUpperCase()}`}</PillChip>
              <PillChip color={COLORS.amberBright}>{horizon}D</PillChip>
            </div>
          </div>

          {/* Trade Risk Score */}
          <div>
            <Eyebrow>{t('trade_risk_score')}</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0 18px' }}>
              <span style={{ fontFamily: FONT, fontSize: 52, fontWeight: 800, letterSpacing: -1.5, color: COLORS.amberBright, lineHeight: 1 }}>{score}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <PillChip color={RISK_BADGE_COLOR[riskLevel]}>{riskBadge}</PillChip>
                {verdict && <PillChip color={verdictColor} outline>{verdictLabel.toUpperCase()}</PillChip>}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {dims.map(({ key, value }) => {
                const col = riskColor(value);
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11.5, color: COLORS.textSecondary, fontFamily: FONT }}>{t(key)}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: col, fontFamily: FONT }}>{value}</span>
                    </div>
                    <ProgressMeter value={value} color={col} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Intelligence Hive */}
          <div>
            <Eyebrow>{t('agent_pipeline')}</Eyebrow>
            <div style={{ marginTop: 10 }}>
              <PipelineStrip steps={PIPELINE_STEPS} activeCount={pipelineActive} justify="flex-start" />
            </div>
          </div>

        </div>
      </aside>

      {/* ═══════════════════════════════════════
          RIGHT CONTENT — flex, scrollable
      ═══════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Right header + tabs */}
        <div style={{
          borderBottom: `1px solid ${COLORS.line}`,
          padding: '0 28px',
          display: 'flex', alignItems: 'center',
          flexShrink: 0,
        }}>
          {(['analysis', 'map', 'global', 'ai'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '14px 20px', fontSize: 12, fontWeight: 700,
                letterSpacing: 0.5, fontFamily: FONT,
                textTransform: 'uppercase' as const, background: 'none', border: 'none',
                borderBottom: activeTab === tab ? `2px solid ${COLORS.amberBright}` : '2px solid transparent',
                color: activeTab === tab ? COLORS.textPrimary : COLORS.textSecondary,
                cursor: 'pointer', marginBottom: -1, transition: 'color 0.15s',
              }}
            >
              {tab === 'analysis' ? t('analysis_tab') : tab === 'map' ? t('map_tab') : tab === 'global' ? t('global_tab') : t('ai_tab')}
            </button>
          ))}

          {activeTab === 'map' && (
            <span style={{
              marginLeft: 20, fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
              color: COLORS.textSecondary, fontFamily: FONT,
              textTransform: 'uppercase' as const,
            }}>
              {mapTitle}
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: 0.5, color: COLORS.textSecondary,
              fontFamily: FONT,
            }}>
              {commodity.toUpperCase()} · {isImport ? `${origin.toUpperCase()} → BRAZIL` : `BRAZIL → ${destination.toUpperCase()}`} · {horizon} DAYS
              {isImport && <span style={{ color: COLORS.amberBright, marginLeft: 8 }}>· IMPORT</span>}
            </span>
            <LangToggle />
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
              fontFamily: FONT,
              color: COLORS.petroleo, background: 'rgba(15,118,110,0.16)',
              padding: '4px 10px', borderRadius: 20,
              display: 'flex', alignItems: 'center', gap: 5,
            }}><span className="fa-solid fa-circle" style={{ fontSize: 6 }} /> 6 AGENTS ACTIVE</span>
          </div>
        </div>

        {/* Scrollable content */}
        <main style={{
          flex: 1,
          overflowY: (activeTab === 'map' || activeTab === 'global') ? 'hidden' : 'auto',
          padding:   (activeTab === 'map' || activeTab === 'global') ? 0 : '28px',
        }}>

          {activeTab === 'map' && <HexMap onAnalyzeRegion={handleAnalyzeRegion} commodity={commodity} tradeDirection={tradeDirection} propagationData={result.propagation} />}

          {activeTab === 'global' && <GlobalHeatMap commodity={commodity} tradeDirection={tradeDirection} onAnalyzeRoute={onAnalyzeRoute} />}

          {activeTab === 'analysis' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: '100%', maxWidth: 1000, margin: '0 auto' }}>

              {/* ── Hero ── */}
              <RevealSection visible={revealedSections.has('hero')}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 50, alignItems: 'center', padding: '12px 0 28px' }}>
                  <div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary, letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 8, fontFamily: FONT }}>
                      {isImport ? 'Supply Risk' : 'Trade Risk'}
                    </div>
                    <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1, letterSpacing: -2.5, color: COLORS.amberBright, fontFamily: FONT }}>{score}</div>
                    <div style={{ marginTop: 10 }}>
                      <PillChip color={RISK_BADGE_COLOR[riskLevel]}>{riskBadge}</PillChip>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <SignalRow {...marketSignal} />
                    <SignalRow {...climateSignal} />
                    <SignalRow {...gapSignal} />
                  </div>
                </div>
              </RevealSection>

              <HexDivider />

              {/* ── 3 Metric cards ── */}
              <RevealSection visible={revealedSections.has('metrics')}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '28px 0' }}>
                  <MetricCard
                    label={isImport ? 'SUPPLY RELIABILITY' : t('export_readiness')}
                    value={String(isImport ? (result.supply_reliability ?? readiness) : readiness)}
                    unit="/100"
                    color={goodColor(readiness)}
                    sub={isImport ? 'Buyer reliability score' : `Risk score: ${score}/100`}
                  />
                  <MetricCard
                    label={t('market_risk')}
                    value={String(marketScore)}
                    unit="/100"
                    color={riskColor(marketScore)}
                    sub={result.market?.price_trend ?? 'Stable'}
                  />
                  <MetricCard
                    label={t('gps_coverage')}
                    value={String(gpsPct)}
                    unit="%"
                    color={gpsPct >= 100 ? COLORS.petroleo : COLORS.danger}
                    sub={gpsPct >= 100 ? 'All suppliers mapped' : 'Incomplete traceability'}
                  />
                </div>
              </RevealSection>

              <HexDivider />

              {/* ── Risk Priorities ── */}
              {exec?.key_risks && exec.key_risks.length > 0 && (
                <>
                  <RevealSection visible={revealedSections.has('priorities')}>
                    <div style={{ padding: '28px 0' }}>
                      <Eyebrow>Risk Priorities</Eyebrow>
                      <h2 style={{ margin: '0 0 20px 0', fontSize: 19, fontWeight: 700, color: COLORS.textPrimary, fontFamily: FONT }}>Where to act first</h2>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {exec.key_risks.slice(0, 3).map((risk, i) => (
                          <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '18px 0', borderBottom: i < Math.min(exec!.key_risks.length, 3) - 1 ? `1px solid ${COLORS.line}` : 'none',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                              <span style={{ fontSize: 12, color: COLORS.textSecondary, width: 20, fontFamily: FONT }}>{String(i + 1).padStart(2, '0')}</span>
                              <div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.textPrimary, fontFamily: FONT }}>{risk.title}</div>
                                <div style={{ fontSize: 12.5, color: COLORS.textSecondary, marginTop: 2, fontFamily: FONT }}>{risk.description}</div>
                              </div>
                            </div>
                            <span style={{
                              fontSize: 12, fontWeight: 800, letterSpacing: 1, color: SEV_COLORS[risk.severity] ?? COLORS.textSecondary,
                              fontFamily: FONT, textTransform: 'uppercase' as const, flexShrink: 0, marginLeft: 12,
                            }}>{risk.severity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </RevealSection>
                  <HexDivider />
                </>
              )}

              {/* ── Honeycomb Efficiency Score ── */}
              {result.honeycomb && (() => {
                const hc = result.honeycomb!;
                const hesCol = HES_COLORS[hc.hes_label] ?? COLORS.textSecondary;
                const hesLabelText = hc.hes_label === 'Critical' ? t('hes_critical')
                  : hc.hes_label === 'Low' ? t('hes_low')
                  : hc.hes_label === 'Moderate' ? t('hes_moderate')
                  : t('hes_good');
                const unlockKt = Math.round(hc.critical_cells.reduce((sum, c) => sum + c.volume_kt, 0) * 10) / 10;

                return (
                  <>
                  <RevealSection visible={revealedSections.has('hes')}>
                    <div style={{ padding: '28px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Eyebrow>⬢ {t('hes_title')}</Eyebrow>
                        <span title={t('hes_tooltip')} style={{
                          fontSize: 10, color: COLORS.textSecondary, cursor: 'help',
                          border: `1px solid ${COLORS.line}`, borderRadius: '50%',
                          width: 14, height: 14, display: 'inline-flex',
                          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>?</span>
                      </div>
                      <h2 style={{ margin: '0 0 4px 0', fontSize: 19, fontWeight: 700, color: COLORS.textPrimary, fontFamily: FONT }}>Honeycomb Efficiency Score</h2>
                      <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 20, fontFamily: FONT }}>
                        {hc.context_label} · {hc.trade_direction === 'import' ? 'Worldwide' : 'Brazil'}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 44, alignItems: 'center' }}>
                        {/* Left — main score */}
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 22 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                              <div style={{ fontSize: 40, fontWeight: 800, color: COLORS.textPrimary, fontFamily: FONT }}>{hc.hes_score}%</div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: hesCol, fontFamily: FONT }}>{hesLabelText}</span>
                            </div>
                            <div style={{ fontSize: 10.5, color: COLORS.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginTop: 4, fontFamily: FONT }}>{hc.trade_direction === 'import' ? t('volume_safe_origins') : t('volume_safe_cells')}</div>
                          </div>
                          <i className="fas fa-arrow-right" style={{ color: COLORS.textSecondary, fontSize: 18 }} />
                          <div>
                            <div style={{ fontSize: 40, fontWeight: 800, color: hesCol, fontFamily: FONT }}>{hc.potential_hes}%</div>
                            <div style={{ fontSize: 10.5, color: COLORS.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginTop: 4, fontFamily: FONT }}>Potencial</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 30, fontWeight: 800, color: COLORS.petroleo, fontFamily: FONT }}>+{hc.potential_gain}%</div>
                            <div style={{ fontSize: 10.5, color: COLORS.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginTop: 4, fontFamily: FONT }}>{t('potential_gain')}</div>
                          </div>
                        </div>

                        {/* Right — breakdown */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {[
                            { label: 'High risk', vol: hc.high_risk_volume_kt, cells: hc.high_risk_cells, color: COLORS.danger },
                            { label: 'Mid risk',  vol: hc.mid_risk_volume_kt,  cells: hc.mid_risk_cells,  color: COLORS.amberBright },
                            { label: 'Low risk',  vol: hc.low_risk_volume_kt,  cells: hc.low_risk_cells,  color: COLORS.petroleo },
                          ].map(row => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontFamily: FONT, paddingBottom: 12, borderBottom: `1px solid ${COLORS.line}` }}>
                              <span style={{ color: row.color, fontWeight: 600 }}>● {row.label}</span>
                              <span style={{ color: COLORS.textPrimary }}>{row.vol} kt <span style={{ color: COLORS.textSecondary }}>({row.cells} cells)</span></span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 700, fontFamily: FONT }}>
                            <span style={{ color: COLORS.textSecondary }}>Total</span>
                            <span style={{ color: COLORS.textPrimary }}>{hc.total_volume_kt} kt</span>
                          </div>
                        </div>
                      </div>

                      {/* Critical cells */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 26 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: COLORS.textSecondary, textTransform: 'uppercase' as const, fontFamily: FONT }}>{hc.trade_direction === 'import' ? t('import_origins_label') : t('critical_cells')}</div>
                        {hc.critical_cells.map((c, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontFamily: FONT }}>
                            <span style={{ color: COLORS.textPrimary }}>{c.region}</span>
                            <span style={{ color: COLORS.textSecondary }}>Risk {c.risk_score} · {c.volume_kt} kt</span>
                          </div>
                        ))}
                        <div style={{ fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2, fontFamily: FONT }}>+{unlockKt} {t('unlock_exports')}</div>
                      </div>

                      {/* Insight box */}
                      <div style={{ ...CALLOUT, marginTop: 20 }}>
                        <span style={{ color: COLORS.amberBright, flexShrink: 0 }}>⬢</span>
                        <span>{hc.insight}</span>
                      </div>
                    </div>
                  </RevealSection>
                    <HexDivider />
                  </>
                );
              })()}

              {/* ── Cellular Risk Propagation ── */}
              {result.propagation && (() => {
                const prop = result.propagation!;
                const statusColor = prop.propagation_active ? COLORS.amberBright : COLORS.petroleo;
                const affected = prop.most_affected_by_propagation;

                return (
                  <>
                  <RevealSection visible={revealedSections.has('propagation')}>
                    <div style={{ padding: '28px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Eyebrow>Cellular Risk Propagation</Eyebrow>
                        <span title={t('propagation_tooltip')} style={{
                          fontSize: 10, color: COLORS.textSecondary, cursor: 'help',
                          border: `1px solid ${COLORS.line}`, borderRadius: '50%',
                          width: 14, height: 14, display: 'inline-flex',
                          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>?</span>
                      </div>
                      <h2 style={{ margin: '0 0 20px 0', fontSize: 19, fontWeight: 700, color: COLORS.textPrimary, fontFamily: FONT }}>{t('propagation_title')}</h2>

                      <div style={{ marginBottom: 18 }}>
                        <PillChip color={statusColor}>{prop.propagation_active ? t('propagation_active') : t('propagation_stable')}</PillChip>
                      </div>

                      {prop.propagation_active ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap' as const, gap: 0 }}>
                            {affected.map((m, i) => (
                              <div key={m.region} style={{ display: 'flex', alignItems: 'flex-start' }}>
                                <div style={{ textAlign: 'center', padding: '0 22px', maxWidth: 140 }}>
                                  <div style={{ width: 14, height: 14, borderRadius: '50%', margin: '0 auto 10px', background: riskColor(m.composite_score) }} />
                                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, fontFamily: FONT }}>{m.region}</div>
                                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontFamily: FONT }}>{m.composite_score}</div>
                                  {m.risk_sources.length > 0 && (
                                    <div style={{ fontSize: 9.5, color: COLORS.textSecondary, marginTop: 4, lineHeight: 1.4, fontFamily: FONT }}>
                                      {t('propagated_from')}: {m.risk_sources.join(', ')}
                                    </div>
                                  )}
                                </div>
                                {i < affected.length - 1 && (
                                  <i className="fas fa-arrow-right" style={{ color: COLORS.textSecondary, fontSize: 16, marginTop: 4 }} />
                                )}
                              </div>
                            ))}
                          </div>
                          <p style={{ marginTop: 18, fontSize: 13.5, color: COLORS.textSecondary, lineHeight: 1.75, fontFamily: FONT, maxWidth: 760 }}>{prop.insight}</p>
                        </>
                      ) : (
                        <div style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: FONT }}>Adjacent cells show stable risk patterns</div>
                      )}
                    </div>
                  </RevealSection>
                    <HexDivider />
                  </>
                );
              })()}

              {/* ── Trade Route ── */}
              <RevealSection visible={revealedSections.has('traderoute')}>
              <div style={{ padding: '28px 0' }}>
                <Eyebrow>{t('trade_route')}</Eyebrow>
                <div style={{ ...CARD, marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {/* Origin */}
                    <div style={{ textAlign: 'center', minWidth: 110 }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: COLORS.amberBright, margin: '0 auto 8px',
                        boxShadow: `0 0 10px ${COLORS.amberBright}88`,
                      }} />
                      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary, fontFamily: FONT }}>{originPort}</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 3, fontFamily: FONT }}>
                        {isImport ? origin : 'Brazil'}
                      </div>
                    </div>

                    {/* Connecting line */}
                    <div style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <div style={{ position: 'relative', width: '100%', height: 2 }}>
                        <div style={{ width: '100%', height: 2, background: `${COLORS.amber}33`, borderRadius: 1 }} />
                        <div style={{
                          position: 'absolute', top: '50%', left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 8, height: 8, borderRadius: '50%',
                          background: COLORS.petroleo, border: `2px solid ${COLORS.bg}`,
                          boxShadow: `0 0 8px ${COLORS.petroleo}77`,
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: COLORS.amberBright, fontFamily: FONT, fontWeight: 600, letterSpacing: 0.3 }}>~{transitDays} days transit</span>
                    </div>

                    {/* Destination */}
                    <div style={{ textAlign: 'center', minWidth: 110 }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: COLORS.petroleo, margin: '0 auto 8px',
                        boxShadow: `0 0 10px ${COLORS.petroleo}88`,
                      }} />
                      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary, fontFamily: FONT }}>{destPort}</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 3, fontFamily: FONT }}>
                        {isImport ? 'Brazil' : destination}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </RevealSection>

              {/* ── Tariff Calculation ── */}
              {isImport && result.tariff && result.tariff.ncm_code && (
                <>
                  <HexDivider />
                  <RevealSection visible={revealedSections.has('tariff')}>
                  <div style={{ padding: '28px 0' }}>
                    <Eyebrow>{t('tariff_calculation')}</Eyebrow>
                    <div style={{ ...CARD, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 13, color: COLORS.textPrimary, fontFamily: FONT }}>
                          {t('ncm_code')}: {result.tariff.ncm_code} · {result.tariff.ncm_description}
                        </div>
                        <div style={{ fontSize: 13, color: COLORS.amberBright, fontFamily: FONT }}>
                          {t('trade_agreement')}: {result.tariff.trade_agreement} · {t('ii_reduction')}: {result.tariff.ii_reduction_pct}%
                        </div>
                      </div>

                      {'total_landed_brl' in result.tariff.calculation && (() => {
                        const c = result.tariff!.calculation as TariffCalculation;
                        const rows: { label: string; value: string; note?: string }[] = [
                          { label: 'CIF Value (USD)', value: `$${c.cif_usd.toLocaleString('en-US')}`, note: fmtBRL(c.cif_brl) },
                          {
                            label: `II (${c.ii_rate_tec}% → ${c.ii_rate_applied}%)`,
                            value: fmtBRL(c.ii_value),
                            note: result.tariff!.ii_reduction_pct === 100 ? `${result.tariff!.trade_agreement} exempt` : undefined,
                          },
                          { label: `IPI (${c.ipi_rate}%)`, value: fmtBRL(c.ipi_value) },
                          { label: 'PIS/COFINS (9.65%)', value: fmtBRL(c.pis_cofins_value) },
                          { label: 'ICMS (18%)', value: fmtBRL(c.icms_value) },
                        ];
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {rows.map((row, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12.5, fontFamily: FONT }}>
                                <span style={{ color: COLORS.textSecondary }}>{row.label}</span>
                                <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                                  {row.note && <span style={{ color: COLORS.textSecondary, fontSize: 10.5 }}>{row.note}</span>}
                                  <span style={{ color: COLORS.textPrimary, fontWeight: 600 }}>{row.value}</span>
                                </span>
                              </div>
                            ))}
                            <div style={{ height: 1, background: COLORS.line, margin: '4px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13.5, fontFamily: FONT }}>
                              <span style={{ color: COLORS.textSecondary, fontWeight: 700 }}>{t('total_taxes')}</span>
                              <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                                <span style={{ color: COLORS.amberBright, fontSize: 11 }}>{c.tax_burden_pct}%</span>
                                <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>{fmtBRL(c.total_taxes_brl)}</span>
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 15, fontFamily: FONT }}>
                              <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>{t('landed_cost')}</span>
                              <span style={{ color: COLORS.amberBright, fontWeight: 800 }}>{fmtBRL(c.total_landed_brl)}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  </RevealSection>
                </>
              )}

              <HexDivider />

              {/* ── Executive Memorandum — no colored boxes ── */}
              <RevealSection visible={revealedSections.has('memo')}>
              <div style={{ padding: '28px 0 40px' }}>
                <Eyebrow>⬢ {t('executive_briefing')}</Eyebrow>
                <h2 style={{ margin: '0 0 8px 0', fontSize: 19, fontWeight: 700, color: COLORS.textPrimary, fontFamily: FONT }}>Executive Memorandum</h2>

                {exec?.executive_summary && (
                  <BriefingBlock title="Executive Assessment">{exec.executive_summary}</BriefingBlock>
                )}

                {exec?.recommended_actions && exec.recommended_actions.length > 0 && (
                  <BriefingBlock title={t('recommended_actions')} last={!exec?.trade_window}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {exec.recommended_actions.map((act, i) => (
                        <div key={i}>
                          <strong style={{ color: COLORS.textPrimary }}>{act.timeline}:</strong> {act.action}
                        </div>
                      ))}
                    </div>
                  </BriefingBlock>
                )}

                {exec?.trade_window && (
                  <BriefingBlock title="Trade Window" last>{exec.trade_window}</BriefingBlock>
                )}
              </div>
              </RevealSection>
            </div>
          )}

          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', maxWidth: 900, margin: '0 auto' }}>
              {!obs && (
                <div style={{ color: COLORS.textSecondary, fontSize: 13, fontFamily: FONT }}>
                  {t('no_observability_data')}
                </div>
              )}

              {obs && (() => {
                const regAgent = obs.agents.find((a: AgentObservability) => a.name === 'Regulatory Intelligence');
                const ragChunks = regAgent?.rag_chunks ?? obs.rag_evidence;
                const allCompleted = obs.agents.every(a => a.status === 'completed');
                const completedPct = Math.round(
                  (obs.agents.filter(a => a.status === 'completed').length / obs.agents.length) * 100
                );
                const totalTokens = obs.total_tokens.input + obs.total_tokens.output;

                return (
                  <>
                    {/* Pipeline Overview */}
                    <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <Eyebrow>{t('pipeline_overview')}</Eyebrow>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: COLORS.textSecondary, fontFamily: FONT, marginBottom: 4 }}>{t('total_duration')}</div>
                          <div style={{ fontFamily: FONT, fontSize: 24, fontWeight: 800, color: COLORS.amberBright }}>{(obs.total_duration_ms / 1000).toFixed(1)}s</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: COLORS.textSecondary, fontFamily: FONT, marginBottom: 4 }}>{t('total_tokens')}</div>
                          <div style={{ fontFamily: FONT, fontSize: 24, fontWeight: 800, color: COLORS.textPrimary }}>{totalTokens.toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: COLORS.textSecondary, fontFamily: FONT, marginBottom: 4 }}>PIPELINE STATUS</div>
                          <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: allCompleted ? COLORS.petroleo : COLORS.amberBright }}>
                            {allCompleted ? 'COMPLETED' : 'PARTIAL'}
                          </div>
                        </div>
                      </div>
                      <ProgressMeter value={completedPct} color={allCompleted ? COLORS.petroleo : COLORS.amberBright} height={6} />
                    </div>

                    {/* Agent Timeline */}
                    <div>
                      <Eyebrow>{t('agent_cards')}</Eyebrow>
                      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
                        {obs.agents.map((agent, i) => {
                          const failed = agent.status === 'failed';
                          const isLast = i === obs.agents.length - 1;
                          const confColor = confidenceColor(agent.confidence);
                          return (
                            <div key={agent.name} style={{ display: 'flex', gap: 18, padding: '16px 0' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: failed ? COLORS.danger : COLORS.petroleo, flexShrink: 0 }} />
                                {!isLast && <div style={{ width: 1, flex: 1, background: COLORS.line, marginTop: 4 }} />}
                              </div>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: isLast ? 0 : 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: 14.5, fontWeight: 700, color: COLORS.textPrimary, fontFamily: FONT }}>
                                    {AGENT_ICONS[agent.name] ?? '⬢'} {agent.name}
                                  </span>
                                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: failed ? COLORS.danger : COLORS.petroleo, fontFamily: FONT, textTransform: 'uppercase' as const }}>
                                    {failed ? 'Failed' : 'Verified'}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11.5, color: COLORS.textSecondary, fontFamily: FONT }}>{agent.model} · {agent.duration_ms}ms</div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: 10.5, color: COLORS.textSecondary, fontFamily: FONT }}>{t('confidence')}</span>
                                    <span style={{ fontSize: 10.5, fontWeight: 700, color: confColor, fontFamily: FONT }}>{agent.confidence}%</span>
                                  </div>
                                  <ProgressMeter value={agent.confidence} color={confColor} />
                                </div>
                                <div style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.5, fontFamily: FONT }}>{agent.data_sources.join(' · ')}</div>
                                {agent.tokens_used && (
                                  <div style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: FONT }}>
                                    {t('tokens_input')}: {agent.tokens_used.input.toLocaleString()} · {t('tokens_output')}: {agent.tokens_used.output.toLocaleString()}
                                  </div>
                                )}
                                <div style={{ fontSize: 12.5, color: COLORS.textPrimary, lineHeight: 1.55, fontFamily: FONT }}>{agent.output_summary}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* RAG Evidence */}
                    {ragChunks && ragChunks.length > 0 && (
                      <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <Eyebrow>{t('rag_evidence')} — {ragChunks.length} {t('chunks_retrieved')}</Eyebrow>
                        {ragChunks.map((chunk, i) => (
                          <div key={i} style={{
                            display: 'flex', flexDirection: 'column', gap: 6,
                            borderTop: i > 0 ? `1px solid ${COLORS.line}` : 'none',
                            paddingTop: i > 0 ? 12 : 0,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.amberBright, fontFamily: FONT }}>{chunk.article || 'EUDR 2023/1115'}</span>
                              <span style={{ fontSize: 10.5, color: COLORS.textSecondary, fontFamily: FONT }}>{chunk.source}</span>
                            </div>
                            <div style={{ fontSize: 12.5, color: COLORS.textPrimary, lineHeight: 1.6, fontFamily: FONT }}>{chunk.text}…</div>
                            <ProgressMeter value={chunk.score} color={COLORS.amberBright} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Data Freshness */}
                    <div>
                      <Eyebrow>{t('data_freshness')}</Eyebrow>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                        {Object.entries(obs.data_freshness).map(([key, value]) => (
                          <div key={key} style={{
                            background: COLORS.panel, border: '1px solid rgba(255,255,255,0.04)',
                            borderRadius: 8, padding: '12px 16px',
                            display: 'flex', alignItems: 'center', gap: 10,
                          }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: key === 'climate' ? COLORS.petroleo : COLORS.amberBright }} />
                            <div>
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.textPrimary, fontFamily: FONT }}>{FRESHNESS_LABELS[key] ?? key}</div>
                              <div style={{ fontSize: 10.5, color: COLORS.textSecondary, fontFamily: FONT }}>{value}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Decision Trace */}
                    <div style={CALLOUT}>
                      <span style={{ color: COLORS.amberBright, flexShrink: 0 }}>⬢</span>
                      <div>
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: COLORS.amberBright, textTransform: 'uppercase' as const, marginBottom: 6, fontFamily: FONT }}>{t('decision_trace')}</div>
                        <div style={{ fontSize: 12.5, color: COLORS.textPrimary, lineHeight: 1.7, fontFamily: FONT }}>{decisionTrace}</div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
