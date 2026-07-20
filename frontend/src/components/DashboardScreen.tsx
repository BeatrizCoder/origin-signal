import { useState } from 'react';
import type { AnalyzeResponse, TariffCalculation, AgentObservability } from '../types';
import { getRiskLevel } from '../types';
import HexMap from './HexMap';
import GlobalHeatMap from './GlobalHeatMap';
import { analyzeRoute } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import LangToggle from './LangToggle';

type Tab = 'analysis' | 'map' | 'global' | 'ai';

const AMBER       = '#D4900A';
const AMBER_LIGHT = '#F5B731';
const BG          = '#0B1120';
const SIDEBAR_BG  = '#0F1A2E';
const SURFACE     = '#131C2E';
const BORDER      = 'rgba(255,255,255,0.06)';
const TEXT        = '#F1F5F9';
const TEXT_MUTED  = '#7A90A8';

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  LOW:    { bg: '#0D3321', text: '#34D399' },
  MEDIUM: { bg: '#2D1F00', text: '#FBBF24' },
  HIGH:   { bg: '#2D0D0D', text: '#F87171' },
};

const SEV_COLORS: Record<string, string> = {
  critical: '#F87171',
  high:     '#FBBF24',
  medium:   '#34D399',
};

const HES_COLORS: Record<string, { bg: string; text: string }> = {
  Critical: { bg: '#2D0D0D', text: '#F87171' },
  Low:      { bg: '#3D1F00', text: '#FB923C' },
  Moderate: { bg: '#2D1F00', text: '#FBBF24' },
  Good:     { bg: '#0D3321', text: '#34D399' },
};

const ORANGE = '#FB923C';

const AGENTS = [
  'Climate Engine',
  'Regulatory Engine',
  'Market Engine',
  'Logistics Engine',
  'Gap Analysis Engine',
  'Executive Intelligence',
];

const AGENT_ICONS: Record<string, string> = {
  'Climate Engine':          '☁',
  'Regulatory Engine':       '📄',
  'Market Engine':           '📈',
  'Logistics Engine':        '🚢',
  'Gap Analysis Engine':     '⚠',
  'Executive Intelligence':  '🧠',
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

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function dimColor(v: number): string {
  if (v >= 70) return '#F87171';
  if (v >= 40) return '#FBBF24';
  return '#34D399';
}

function confidenceColor(v: number): string {
  if (v >= 75) return '#34D399';
  if (v >= 50) return '#FBBF24';
  return '#F87171';
}

const AMBER_BTN_STYLE: React.CSSProperties = {
  flex: '0 1 auto',
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

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: 1,
      fontFamily: 'ui-monospace, Consolas, monospace',
      color: AMBER, background: `${AMBER}1A`,
      border: `1px solid ${AMBER}33`,
      padding: '2px 7px', borderRadius: 3,
    }}>{children}</span>
  );
}

function MetricCard({ label, value, unit, color, sub }: {
  label: string; value: string; unit: string; color: string; sub: string;
}) {
  return (
    <div style={{
      background: SURFACE, border: `1px solid ${BORDER}`,
      borderRadius: 8, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
        textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace',
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{
          fontFamily: 'ui-monospace, Consolas, monospace',
          fontSize: 36, fontWeight: 700, color, lineHeight: 1,
        }}>{value}</span>
        <span style={{
          fontFamily: 'ui-monospace, Consolas, monospace',
          fontSize: 14, color: TEXT_MUTED,
        }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11, color: TEXT_MUTED }}>{sub}</div>
    </div>
  );
}

function AgentCard({ agent, t }: { agent: AgentObservability; t: (k: string) => string }) {
  const failed = agent.status === 'failed';
  return (
    <div style={{
      background: SURFACE, border: `1px solid ${BORDER}`,
      borderRadius: 8, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{AGENT_ICONS[agent.name] ?? '⬡'}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: TEXT, fontFamily: 'ui-monospace, Consolas, monospace' }}>
            {agent.name}
          </span>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
          fontFamily: 'ui-monospace, Consolas, monospace',
          color: failed ? '#F87171' : '#34D399',
          background: failed ? '#2D0D0D' : '#0D3321',
          padding: '2px 7px', borderRadius: 3,
        }}>{failed ? 'FAILED' : 'COMPLETED'}</span>
      </div>

      <div style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace' }}>
        {agent.model} · {agent.duration_ms}ms
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace' }}>{t('confidence')}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: confidenceColor(agent.confidence), fontFamily: 'ui-monospace, Consolas, monospace' }}>
            {agent.confidence}%
          </span>
        </div>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${agent.confidence}%`, background: confidenceColor(agent.confidence), borderRadius: 2 }} />
        </div>
      </div>

      <div style={{ fontSize: 10, color: TEXT_MUTED, lineHeight: 1.5 }}>
        {agent.data_sources.join(' · ')}
      </div>

      {agent.tokens_used && (
        <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace' }}>
          {t('tokens_input')}: {agent.tokens_used.input.toLocaleString()} · {t('tokens_output')}: {agent.tokens_used.output.toLocaleString()}
        </div>
      )}

      <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.5, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
        {agent.output_summary}
      </div>
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
  const { t } = useLanguage();
  const isImport = tradeDirection === 'import';

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
  const riskColor  = RISK_COLORS[riskLevel];
  const readiness  = clamp(result.export_readiness ?? (100 - result.risk_score));
  const exec       = result.executive;
  const verdict    = exec?.overall_verdict;
  const verdictColor = verdict === 'Go' ? '#34D399' : verdict === 'Hold' ? '#F87171' : '#FBBF24';

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

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: BG, color: TEXT, fontFamily: 'system-ui, sans-serif',
    }}>

      {/* ═══════════════════════════════════════
          LEFT SIDEBAR — 300px fixed
      ═══════════════════════════════════════ */}
      <aside style={{
        width: 300, flexShrink: 0,
        background: SIDEBAR_BG,
        borderRight: `1px solid ${BORDER}`,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Logo + History/New Analysis */}
        <div style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${BORDER}`,
          display: 'flex', flexDirection: 'column', gap: 10,
          flexShrink: 0,
        }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
            <button
              onClick={onHistory}
              style={AMBER_BTN_STYLE}
              onMouseEnter={e => handleAmberHover(e, true)}
              onMouseLeave={e => handleAmberHover(e, false)}
            >
              ⏱ {t('history')}
            </button>
            <button
              onClick={onCompare}
              style={AMBER_BTN_STYLE}
              onMouseEnter={e => handleAmberHover(e, true)}
              onMouseLeave={e => handleAmberHover(e, false)}
            >
              ⇄ {t('compare_routes')}
            </button>
            <button
              onClick={onOptimize}
              style={AMBER_BTN_STYLE}
              onMouseEnter={e => handleAmberHover(e, true)}
              onMouseLeave={e => handleAmberHover(e, false)}
            >
              ⬡ {t('optimize')}
            </button>
            <button
              onClick={onAuditPath}
              style={AMBER_BTN_STYLE}
              onMouseEnter={e => handleAmberHover(e, true)}
              onMouseLeave={e => handleAmberHover(e, false)}
            >
              ⬡ {t('audit_path')}
            </button>
            <button
              onClick={onNewAnalysis}
              style={AMBER_BTN_STYLE}
              onMouseEnter={e => handleAmberHover(e, true)}
              onMouseLeave={e => handleAmberHover(e, false)}
            >
              {t('new_analysis')}
            </button>
          </div>
        </div>

        {/* Export buttons */}
        <div style={{
          padding: '8px 18px',
          borderBottom: `1px solid ${BORDER}`,
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
                border: `1px solid ${downloading === fmt ? BORDER : `${AMBER}66`}`,
                borderRadius: 4,
                color: downloading === fmt ? TEXT_MUTED : AMBER,
                padding: '5px 8px',
                cursor: downloading !== null ? 'not-allowed' : 'pointer',
                fontSize: 10,
                fontFamily: 'ui-monospace, Consolas, monospace',
                letterSpacing: 0.8,
                opacity: downloading !== null && downloading !== fmt ? 0.45 : 1,
                transition: 'all 0.15s',
              }}
            >
              {downloading === fmt ? t('generating') : fmt === 'pdf' ? t('export_pdf') : t('export_excel')}
            </button>
          ))}
        </div>

        {/* Scrollable sidebar body */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 18px',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>

          {/* Active Query */}
          <div style={{
            background: BG, border: `1px solid ${BORDER}`,
            borderRadius: 6, padding: '12px 14px',
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
              textTransform: 'uppercase' as const,
              fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 8,
            }}>{t('active_query')}</div>
            <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.65, marginBottom: 10 }}>
              {result.query ||
                `Analyze composite risk for ${commodity} exports from Brazil to the European Union over ${horizon} days`}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
              <Tag>{commodity.toUpperCase()}</Tag>
              <Tag>{isImport ? `${origin.slice(0, 2).toUpperCase()}→BR` : `BR→${destination.slice(0, 2).toUpperCase()}`}</Tag>
              <Tag>{horizon}D</Tag>
            </div>
          </div>

          {/* Trade Risk Score */}
          <div>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
              textTransform: 'uppercase' as const,
              fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 12,
            }}>{t('trade_risk_score')}</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <span style={{
                fontFamily: 'ui-monospace, Consolas, monospace',
                fontSize: 56, fontWeight: 700, color: AMBER, lineHeight: 1,
              }}>{score}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  fontSize: 10, fontWeight: 700, letterSpacing: 1,
                  padding: '3px 8px', borderRadius: 3,
                  background: riskColor.bg, color: riskColor.text,
                }}>
                  {riskBadge}
                </span>
                {verdict && (
                  <span style={{
                    fontFamily: 'ui-monospace, Consolas, monospace',
                    fontSize: 10, fontWeight: 700, letterSpacing: 1,
                    padding: '3px 8px', borderRadius: 3,
                    color: verdictColor, border: `1px solid ${verdictColor}44`,
                  }}>{verdictLabel.toUpperCase()}</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {dims.map(({ key, value }) => {
                const col = dimColor(value);
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{
                        fontSize: 11, color: TEXT_MUTED,
                        fontFamily: 'ui-monospace, Consolas, monospace',
                      }}>{t(key)}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: col,
                        fontFamily: 'ui-monospace, Consolas, monospace',
                      }}>{value}</span>
                    </div>
                    <div style={{
                      height: 3, background: 'rgba(255,255,255,0.06)',
                      borderRadius: 2, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', width: `${value}%`,
                        background: col, borderRadius: 2,
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agent Pipeline */}
          <div>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
              textTransform: 'uppercase' as const,
              fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 12,
            }}>{t('agent_pipeline')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {AGENTS.map(agent => (
                <div key={agent} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{
                    fontSize: 11, color: TEXT,
                    fontFamily: 'ui-monospace, Consolas, monospace',
                  }}>{agent}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
                    fontFamily: 'ui-monospace, Consolas, monospace',
                    color: '#34D399', background: '#0D3321',
                    padding: '2px 7px', borderRadius: 3,
                  }}>{t('done')}</span>
                </div>
              ))}
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
          borderBottom: `1px solid ${BORDER}`,
          padding: '0 28px',
          display: 'flex', alignItems: 'center',
          flexShrink: 0, background: BG,
        }}>
          {(['analysis', 'map', 'global', 'ai'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 20px', fontSize: 11, fontWeight: 700,
                letterSpacing: 1.5, fontFamily: 'ui-monospace, Consolas, monospace',
                textTransform: 'uppercase' as const, background: 'none', border: 'none',
                borderBottom: activeTab === tab ? `2px solid ${AMBER}` : '2px solid transparent',
                color: activeTab === tab ? TEXT : TEXT_MUTED,
                cursor: 'pointer', marginBottom: -1, transition: 'color 0.15s',
              }}
            >
              {tab === 'analysis' ? t('analysis_tab') : tab === 'map' ? t('map_tab') : tab === 'global' ? t('global_tab') : t('ai_tab')}
            </button>
          ))}

          {activeTab === 'map' && (
            <span style={{
              marginLeft: 20, fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
              color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace',
              textTransform: 'uppercase' as const,
            }}>
              {mapTitle}
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: TEXT_MUTED,
              fontFamily: 'ui-monospace, Consolas, monospace',
            }}>
              {commodity.toUpperCase()} · {isImport ? `${origin.toUpperCase()} → BRAZIL` : `BRAZIL → ${destination.toUpperCase()}`} · {horizon} DAYS
              {isImport && <span style={{ color: AMBER, marginLeft: 8 }}>· IMPORT</span>}
            </span>
            <LangToggle />
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1,
              fontFamily: 'ui-monospace, Consolas, monospace',
              color: '#34D399', background: '#0D3321',
              padding: '3px 9px', borderRadius: 3,
            }}>⬡ 6 AGENTS ACTIVE</span>
          </div>
        </div>

        {/* Scrollable content */}
        <main style={{
          flex: 1,
          overflowY: (activeTab === 'map' || activeTab === 'global') ? 'hidden' : 'auto',
          padding:   (activeTab === 'map' || activeTab === 'global') ? 0 : '24px 28px 60px',
        }}>

          {activeTab === 'map' && <HexMap onAnalyzeRegion={handleAnalyzeRegion} commodity={commodity} tradeDirection={tradeDirection} propagationData={result.propagation} />}

          {activeTab === 'global' && <GlobalHeatMap commodity={commodity} tradeDirection={tradeDirection} onAnalyzeRoute={onAnalyzeRoute} />}

          {activeTab === 'analysis' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>

              {/* ── 3 Metric cards ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <MetricCard
                  label={isImport ? 'SUPPLY RELIABILITY' : t('export_readiness')}
                  value={String(isImport ? (result.supply_reliability ?? readiness) : readiness)}
                  unit="/100"
                  color={readiness >= 70 ? '#34D399' : readiness >= 40 ? '#FBBF24' : '#F87171'}
                  sub={isImport ? 'Buyer reliability score' : `Risk score: ${score}/100`}
                />
                <MetricCard
                  label={t('market_risk')}
                  value={String(marketScore)}
                  unit="/100"
                  color={dimColor(marketScore)}
                  sub={result.market?.price_trend ?? 'Stable'}
                />
                <MetricCard
                  label={t('gps_coverage')}
                  value={String(gpsPct)}
                  unit="%"
                  color={gpsPct >= 100 ? '#34D399' : '#F87171'}
                  sub={gpsPct >= 100 ? 'All suppliers mapped' : 'Incomplete traceability'}
                />
              </div>

              {/* ── Trade Route ── */}
              <div style={{
                background: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: '20px 24px',
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
                  textTransform: 'uppercase' as const,
                  fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 20,
                }}>{t('trade_route')}</div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {/* Origin */}
                  <div style={{ textAlign: 'center', minWidth: 110 }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: '50%',
                      background: AMBER, margin: '0 auto 8px',
                      boxShadow: `0 0 10px ${AMBER}88`,
                    }} />
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: TEXT,
                      fontFamily: 'ui-monospace, Consolas, monospace',
                    }}>{originPort}</div>
                    <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 3 }}>
                      {isImport ? origin : 'Brazil'}
                    </div>
                  </div>

                  {/* Connecting line */}
                  <div style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ position: 'relative', width: '100%', height: 2 }}>
                      <div style={{ width: '100%', height: 2, background: `${AMBER}33`, borderRadius: 1 }} />
                      <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#34D399', border: '2px solid #0B1120',
                        boxShadow: '0 0 8px #34D39977',
                      }} />
                    </div>
                    <span style={{
                      fontSize: 10, color: AMBER_LIGHT,
                      fontFamily: 'ui-monospace, Consolas, monospace',
                      fontWeight: 600, letterSpacing: 0.5,
                    }}>~{transitDays} days transit</span>
                  </div>

                  {/* Destination */}
                  <div style={{ textAlign: 'center', minWidth: 110 }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: '50%',
                      background: '#34D399', margin: '0 auto 8px',
                      boxShadow: '0 0 10px #34D39988',
                    }} />
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: TEXT,
                      fontFamily: 'ui-monospace, Consolas, monospace',
                    }}>{destPort}</div>
                    <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 3 }}>
                      {isImport ? 'Brazil' : destination}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Tariff Calculation ── */}
              {isImport && result.tariff && result.tariff.ncm_code && (
                <div style={{
                  background: BG, border: `1px solid ${AMBER}55`,
                  borderRadius: 8, padding: '20px 24px',
                  display: 'flex', flexDirection: 'column', gap: 16,
                }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
                    textTransform: 'uppercase' as const,
                    fontFamily: 'ui-monospace, Consolas, monospace',
                  }}>{t('tariff_calculation')}</div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 13, color: TEXT, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                      {t('ncm_code')}: {result.tariff.ncm_code} · {result.tariff.ncm_description}
                    </div>
                    <div style={{ fontSize: 13, color: AMBER_LIGHT, fontFamily: 'ui-monospace, Consolas, monospace' }}>
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
                          <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                            fontSize: 12, fontFamily: 'ui-monospace, Consolas, monospace',
                          }}>
                            <span style={{ color: TEXT_MUTED }}>{row.label}</span>
                            <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                              {row.note && <span style={{ color: TEXT_MUTED, fontSize: 10 }}>{row.note}</span>}
                              <span style={{ color: TEXT, fontWeight: 600 }}>{row.value}</span>
                            </span>
                          </div>
                        ))}
                        <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                          fontSize: 13, fontFamily: 'ui-monospace, Consolas, monospace',
                        }}>
                          <span style={{ color: TEXT_MUTED, fontWeight: 700 }}>{t('total_taxes')}</span>
                          <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                            <span style={{ color: AMBER_LIGHT, fontSize: 11 }}>{c.tax_burden_pct}%</span>
                            <span style={{ color: TEXT, fontWeight: 700 }}>{fmtBRL(c.total_taxes_brl)}</span>
                          </span>
                        </div>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                          fontSize: 14, fontFamily: 'ui-monospace, Consolas, monospace',
                        }}>
                          <span style={{ color: TEXT, fontWeight: 700 }}>{t('landed_cost')}</span>
                          <span style={{ color: AMBER_LIGHT, fontWeight: 700 }}>{fmtBRL(c.total_landed_brl)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── Honeycomb Efficiency Score ── */}
              {result.honeycomb && (() => {
                const hc = result.honeycomb!;
                const hesCol = HES_COLORS[hc.hes_label];
                const hesLabelText = hc.hes_label === 'Critical' ? t('hes_critical')
                  : hc.hes_label === 'Low' ? t('hes_low')
                  : hc.hes_label === 'Moderate' ? t('hes_moderate')
                  : t('hes_good');
                const unlockKt = Math.round(hc.critical_cells.reduce((sum, c) => sum + c.volume_kt, 0) * 10) / 10;

                return (
                  <div style={{
                    background: SURFACE, border: `1px solid ${BORDER}`,
                    borderRadius: 8, padding: '20px 24px',
                    display: 'flex', flexDirection: 'column', gap: 18,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: AMBER,
                        textTransform: 'uppercase' as const,
                        fontFamily: 'ui-monospace, Consolas, monospace',
                      }}>⬡ {t('hes_title')}</span>
                      <span title={t('hes_tooltip')} style={{
                        fontSize: 10, color: TEXT_MUTED, cursor: 'help',
                        border: `1px solid ${BORDER}`, borderRadius: '50%',
                        width: 14, height: 14, display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>?</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
                      {/* Left — main score */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                          <span style={{
                            fontFamily: 'ui-monospace, Consolas, monospace',
                            fontSize: 40, fontWeight: 700, color: hesCol.text, lineHeight: 1,
                          }}>{hc.hes_score}%</span>
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: 1,
                            padding: '3px 8px', borderRadius: 3,
                            background: hesCol.bg, color: hesCol.text,
                            fontFamily: 'ui-monospace, Consolas, monospace',
                          }}>{hesLabelText.toUpperCase()}</span>
                        </div>
                        <div style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: TEXT_MUTED,
                          textTransform: 'uppercase' as const,
                          fontFamily: 'ui-monospace, Consolas, monospace',
                        }}>{t('volume_safe_cells')}</div>
                        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${hc.hes_score}%`, background: AMBER, borderRadius: 3 }} />
                        </div>
                        <div style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                          {t('potential_gain')}: <span style={{ color: AMBER_LIGHT, fontWeight: 700 }}>{hc.potential_hes}%</span> (+{hc.potential_gain}pp)
                        </div>
                      </div>

                      {/* Right — breakdown */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                          { icon: '🔴', label: 'High risk', vol: hc.high_risk_volume_kt, cells: hc.high_risk_cells },
                          { icon: '🟡', label: 'Mid risk',  vol: hc.mid_risk_volume_kt,  cells: hc.mid_risk_cells },
                          { icon: '🟢', label: 'Low risk',  vol: hc.low_risk_volume_kt,  cells: hc.low_risk_cells },
                        ].map(row => (
                          <div key={row.label} style={{
                            display: 'flex', justifyContent: 'space-between',
                            fontSize: 12, fontFamily: 'ui-monospace, Consolas, monospace',
                          }}>
                            <span style={{ color: TEXT }}>{row.icon} {row.label}</span>
                            <span style={{ color: TEXT_MUTED }}>{row.vol} kt ({row.cells} cells)</span>
                          </div>
                        ))}
                        <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          fontSize: 12, fontWeight: 700, fontFamily: 'ui-monospace, Consolas, monospace',
                        }}>
                          <span style={{ color: TEXT_MUTED }}>Total</span>
                          <span style={{ color: TEXT }}>{hc.total_volume_kt} kt</span>
                        </div>
                      </div>
                    </div>

                    {/* Critical cells */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: TEXT_MUTED,
                        textTransform: 'uppercase' as const,
                        fontFamily: 'ui-monospace, Consolas, monospace',
                      }}>{t('critical_cells')}</div>
                      {hc.critical_cells.map((c, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between',
                          fontSize: 12, fontFamily: 'ui-monospace, Consolas, monospace',
                        }}>
                          <span style={{ color: TEXT }}>{c.region}</span>
                          <span style={{ color: TEXT_MUTED }}>Risk {c.risk_score} · {c.volume_kt} kt</span>
                        </div>
                      ))}
                      <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
                        +{unlockKt} {t('unlock_exports')}
                      </div>
                    </div>

                    {/* Insight box */}
                    <div style={{
                      background: `${AMBER}0D`, border: `1px solid ${AMBER}33`,
                      borderRadius: 6, padding: '14px 16px',
                      fontSize: 13, color: TEXT, lineHeight: 1.7,
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                      <span style={{ color: AMBER, flexShrink: 0 }}>⬡</span>
                      <span>{hc.insight}</span>
                    </div>
                  </div>
                );
              })()}

              {/* ── Cellular Risk Propagation ── */}
              {result.propagation && (() => {
                const prop = result.propagation!;
                const badgeCol = prop.propagation_active
                  ? { bg: '#3D1F00', text: ORANGE }
                  : { bg: '#0D3321', text: '#34D399' };

                return (
                  <div style={{
                    background: SURFACE, border: `1px solid ${BORDER}`,
                    borderRadius: 8, padding: '20px 24px',
                    display: 'flex', flexDirection: 'column', gap: 14,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: AMBER,
                        textTransform: 'uppercase' as const,
                        fontFamily: 'ui-monospace, Consolas, monospace',
                      }}>⬡ {t('propagation_title')}</span>
                      <span title={t('propagation_tooltip')} style={{
                        fontSize: 10, color: TEXT_MUTED, cursor: 'help',
                        border: `1px solid ${BORDER}`, borderRadius: '50%',
                        width: 14, height: 14, display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>?</span>
                    </div>

                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: 1,
                      padding: '3px 8px', borderRadius: 3, alignSelf: 'flex-start',
                      background: badgeCol.bg, color: badgeCol.text,
                      fontFamily: 'ui-monospace, Consolas, monospace',
                    }}>{prop.propagation_active ? t('propagation_active') : t('propagation_stable')}</span>

                    {prop.propagation_active ? (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: TEXT_MUTED,
                            textTransform: 'uppercase' as const,
                            fontFamily: 'ui-monospace, Consolas, monospace',
                          }}>{t('most_affected')}</div>
                          {prop.most_affected_by_propagation.map((m, i) => (
                            <div key={i} style={{ fontSize: 12, color: TEXT, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                              {m.region} ({m.composite_score}) {m.risk_sources.length > 0 && (
                                <span style={{ color: TEXT_MUTED }}>← {t('propagated_from')} {m.risk_sources.join(' + ')}</span>
                              )}
                            </div>
                          ))}
                        </div>

                        <div style={{
                          background: `${AMBER}0D`, border: `1px solid ${AMBER}33`,
                          borderRadius: 6, padding: '14px 16px',
                          fontSize: 13, color: TEXT, lineHeight: 1.7,
                          display: 'flex', gap: 10, alignItems: 'flex-start',
                        }}>
                          <span style={{ color: AMBER, flexShrink: 0 }}>⬡</span>
                          <span>{prop.insight}</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                        Adjacent cells show stable risk patterns
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Executive Intelligence Briefing ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
                  textTransform: 'uppercase' as const,
                  fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 4,
                }}>{t('executive_briefing')}</div>

                {/* Risk cards — up to 3 */}
                {exec?.key_risks?.slice(0, 3).map((risk, i) => {
                  const col = SEV_COLORS[risk.severity] ?? '#94A3B8';
                  return (
                    <div key={i} style={{
                      background: SURFACE,
                      border: `1px solid ${BORDER}`,
                      borderLeft: `3px solid ${col}`,
                      borderRadius: 6, padding: '14px 16px',
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          display: 'inline-flex',
                          fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
                          padding: '1px 6px', borderRadius: 10,
                          background: hexToRgba(col, 0.12),
                          border: `0.5px solid ${hexToRgba(col, 0.3)}`,
                          color: col,
                          fontFamily: 'ui-monospace, Consolas, monospace',
                          textTransform: 'uppercase' as const,
                        }}>{risk.severity}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{risk.title}</span>
                      </div>
                      <div style={{ fontSize: 13, color: TEXT_MUTED, lineHeight: 1.65 }}>
                        {risk.description}
                      </div>
                    </div>
                  );
                })}

                {/* Executive recommendation box */}
                {exec?.executive_summary && (
                  <div style={{
                    background: `${AMBER}0D`,
                    border: `1px solid ${AMBER}33`,
                    borderRadius: 6, padding: '16px 18px',
                    display: 'flex', flexDirection: 'column', gap: 10,
                    marginTop: 4,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                        fontFamily: 'ui-monospace, Consolas, monospace',
                        color: AMBER_LIGHT, textTransform: 'uppercase' as const,
                      }}>{t('executive_recommendation')}</span>
                      {verdict && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: 1,
                          fontFamily: 'ui-monospace, Consolas, monospace',
                          color: verdictColor, border: `1px solid ${verdictColor}55`,
                          padding: '2px 8px', borderRadius: 3,
                        }}>{verdictLabel.toUpperCase()}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.75 }}>
                      {exec.executive_summary}
                    </div>
                    {exec.trade_window && (
                      <div style={{
                        fontSize: 11, color: AMBER,
                        fontFamily: 'ui-monospace, Consolas, monospace',
                        letterSpacing: 0.5,
                      }}>⬡ {exec.trade_window}</div>
                    )}
                  </div>
                )}

                {/* Recommended actions */}
                {exec?.recommended_actions?.length > 0 && (
                  <div style={{
                    background: SURFACE, border: `1px solid ${BORDER}`,
                    borderRadius: 6, padding: '14px 16px',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
                      textTransform: 'uppercase' as const,
                      fontFamily: 'ui-monospace, Consolas, monospace',
                    }}>{t('recommended_actions')}</div>
                    {exec.recommended_actions.map((act, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <span style={{
                          display: 'inline-flex',
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                          padding: '2px 7px', borderRadius: 10,
                          background: hexToRgba(AMBER, 0.12),
                          border: `0.5px solid ${hexToRgba(AMBER, 0.3)}`,
                          color: AMBER,
                          marginRight: 8, marginTop: 2, flexShrink: 0,
                          fontFamily: 'ui-monospace, Consolas, monospace',
                          whiteSpace: 'nowrap' as const,
                        }}>{act.timeline}</span>
                        <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{act.action}</div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
              {!obs && (
                <div style={{ color: TEXT_MUTED, fontSize: 13 }}>
                  {t('no_observability_data')}
                </div>
              )}

              {obs && (() => {
                const regAgent = obs.agents.find(a => a.name === 'Regulatory Engine');
                const ragChunks = regAgent?.rag_chunks ?? obs.rag_evidence;
                const allCompleted = obs.agents.every(a => a.status === 'completed');
                const completedPct = Math.round(
                  (obs.agents.filter(a => a.status === 'completed').length / obs.agents.length) * 100
                );
                const totalTokens = obs.total_tokens.input + obs.total_tokens.output;

                return (
                  <>
                    {/* SEÇÃO 1 — Pipeline Overview */}
                    <div style={{
                      background: SURFACE, border: `1px solid ${BORDER}`,
                      borderRadius: 8, padding: '20px 24px',
                      display: 'flex', flexDirection: 'column', gap: 16,
                    }}>
                      <div style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
                        textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace',
                      }}>{t('pipeline_overview')}</div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 4 }}>
                            {t('total_duration')}
                          </div>
                          <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 26, fontWeight: 700, color: AMBER_LIGHT }}>
                            {(obs.total_duration_ms / 1000).toFixed(1)}s
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 4 }}>
                            {t('total_tokens')}
                          </div>
                          <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 26, fontWeight: 700, color: TEXT }}>
                            {totalTokens.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 4 }}>
                            PIPELINE STATUS
                          </div>
                          <div style={{
                            fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 16, fontWeight: 700,
                            color: allCompleted ? '#34D399' : '#FBBF24',
                          }}>
                            {allCompleted ? 'COMPLETED' : 'PARTIAL'}
                          </div>
                        </div>
                      </div>

                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${completedPct}%`,
                          background: allCompleted ? '#34D399' : '#FBBF24', borderRadius: 3,
                        }} />
                      </div>
                    </div>

                    {/* SEÇÃO 2 — Agent Cards */}
                    <div>
                      <div style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
                        textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 12,
                      }}>{t('agent_cards')}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        {obs.agents.map(agent => (
                          <AgentCard key={agent.name} agent={agent} t={t} />
                        ))}
                      </div>
                    </div>

                    {/* SEÇÃO 3 — RAG Evidence */}
                    {ragChunks && ragChunks.length > 0 && (
                      <div style={{
                        background: SURFACE, border: `1px solid ${BORDER}`,
                        borderRadius: 8, padding: '20px 24px',
                        display: 'flex', flexDirection: 'column', gap: 14,
                      }}>
                        <div style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
                          textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace',
                        }}>
                          {t('rag_evidence')} — {ragChunks.length} {t('chunks_retrieved')}
                        </div>
                        {ragChunks.map((chunk, i) => (
                          <div key={i} style={{
                            display: 'flex', flexDirection: 'column', gap: 6,
                            borderTop: i > 0 ? `1px solid ${BORDER}` : 'none',
                            paddingTop: i > 0 ? 12 : 0,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700, color: AMBER,
                                fontFamily: 'ui-monospace, Consolas, monospace',
                              }}>{chunk.article || 'EUDR 2023/1115'}</span>
                              <span style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                                {chunk.source}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.6 }}>{chunk.text}…</div>
                            <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${chunk.score}%`, background: AMBER, borderRadius: 2 }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* SEÇÃO 4 — Data Freshness */}
                    <div>
                      <div style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
                        textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 12,
                      }}>{t('data_freshness')}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {Object.entries(obs.data_freshness).map(([key, value]) => (
                          <div key={key} style={{
                            background: SURFACE, border: `1px solid ${BORDER}`,
                            borderRadius: 8, padding: '12px 16px',
                            display: 'flex', alignItems: 'center', gap: 10,
                          }}>
                            <span style={{
                              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                              background: key === 'climate' ? '#34D399' : '#FBBF24',
                            }} />
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                                {FRESHNESS_LABELS[key] ?? key}
                              </div>
                              <div style={{ fontSize: 10, color: TEXT_MUTED }}>{value}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SEÇÃO 5 — Decision Trace */}
                    <div style={{
                      background: `${AMBER}0D`, border: `1px solid ${AMBER}33`,
                      borderRadius: 6, padding: '16px 18px',
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                        fontFamily: 'ui-monospace, Consolas, monospace',
                        color: AMBER_LIGHT, textTransform: 'uppercase' as const,
                      }}>{t('decision_trace')}</span>
                      <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.8, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                        {decisionTrace}
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
