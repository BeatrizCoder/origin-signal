import { useState } from 'react';
import type { AnalyzeResponse } from '../types';
import { getRiskLevel } from '../types';
import HexMap from './HexMap';
import { analyzeRoute } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import LangToggle from './LangToggle';

type Tab = 'analysis' | 'map';

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

const AGENTS = [
  'Climate Engine',
  'Regulatory Engine',
  'Market Engine',
  'Logistics Engine',
  'Gap Analysis Engine',
  'Executive Intelligence',
];

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

function dimColor(v: number): string {
  if (v >= 70) return '#F87171';
  if (v >= 40) return '#FBBF24';
  return '#34D399';
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

interface Props {
  result: AnalyzeResponse;
  commodity: string;
  horizon: string;
  origin: string;
  destination: string;
  tradeDirection: 'export' | 'import';
  onNewAnalysis: () => void;
}

export default function DashboardScreen({ result, commodity, horizon, origin, destination, tradeDirection, onNewAnalysis }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('analysis');
  const { t } = useLanguage();
  const isImport = tradeDirection === 'import';

  async function handleAnalyzeRegion(regionName: string) {
    const data = await analyzeRoute({
      query: `Trade risk assessment for ${regionName} region`,
      commodity,
      origin: 'Brazil',
      destination,
      origin_region: regionName,
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

  const dims = [
    { key: 'regulatory' as const, value: clamp(result.regulatory?.risk_score ?? result.risk_score) },
    { key: 'market'     as const, value: clamp(result.market?.market_risk_score ?? 50) },
    { key: 'climate'    as const, value: clamp(result.climate?.climate_risk_score ?? 55) },
    { key: 'logistics'  as const, value: clamp(result.logistics?.logistics_risk_score ?? 44) },
  ];

  const gpsPct      = result.gap?.supplier_profile?.gps_coverage_pct ?? 0;
  const originPort  = result.logistics?.origin_port ?? 'Santos';
  const destPort    = result.logistics?.destination_port ?? 'Hamburg';
  const transitDays = result.logistics?.estimated_transit_days ?? 18;
  const marketScore = clamp(result.market?.market_risk_score ?? 50);

  const riskBadge = riskLevel === 'HIGH' ? t('high') : riskLevel === 'MEDIUM' ? t('medium') : t('low');
  const verdictLabel = verdict === 'Go' ? t('go') : verdict === 'Hold' ? t('hold') : t('caution');

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: BG, color: TEXT, fontFamily: 'system-ui, sans-serif',
    }}>

      {/* ═══════════════════════════════════════
          LEFT SIDEBAR — 280px fixed
      ═══════════════════════════════════════ */}
      <aside style={{
        width: 280, flexShrink: 0,
        background: SIDEBAR_BG,
        borderRight: `1px solid ${BORDER}`,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Logo + New Analysis */}
        <div style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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
          <button
            onClick={onNewAnalysis}
            style={{
              background: 'none', border: `1px solid ${BORDER}`,
              borderRadius: 4, color: TEXT_MUTED,
              padding: '4px 9px', cursor: 'pointer',
              fontSize: 10, fontFamily: 'ui-monospace, Consolas, monospace',
              letterSpacing: 0.8, transition: 'color 0.15s',
            }}
          >
            {t('new_analysis')}
          </button>
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
          {(['analysis', 'map'] as Tab[]).map(tab => (
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
              {tab === 'analysis' ? t('analysis_tab') : t('map_tab')}
            </button>
          ))}

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
          overflowY: activeTab === 'map' ? 'hidden' : 'auto',
          padding:   activeTab === 'map' ? 0 : '24px 28px 60px',
        }}>

          {activeTab === 'map' && <HexMap onAnalyzeRegion={handleAnalyzeRegion} commodity={commodity} />}

          {activeTab === 'analysis' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 820 }}>

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
                          fontSize: 9, fontWeight: 700, letterSpacing: 1,
                          fontFamily: 'ui-monospace, Consolas, monospace',
                          color: col, textTransform: 'uppercase' as const,
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
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: '#000',
                          background: AMBER, borderRadius: 3,
                          padding: '2px 7px', flexShrink: 0, marginTop: 2,
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
        </main>
      </div>
    </div>
  );
}
