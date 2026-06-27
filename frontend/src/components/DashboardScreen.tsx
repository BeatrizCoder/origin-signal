import { useState } from 'react';
import type { AnalyzeResponse } from '../types';
import { getRiskLevel } from '../types';
import HexMap from './HexMap';

type Tab = 'analysis' | 'map';

const AMBER      = '#D4900A';
const BG         = '#0B1120';
const SURFACE    = '#131C2E';
const BORDER     = '#1E2D45';
const TEXT       = '#F1F5F9';
const TEXT_MUTED = '#7A90A8';

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  LOW:    { bg: '#0D3321', text: '#34D399' },
  MEDIUM: { bg: '#2D1F00', text: '#FBBF24' },
  HIGH:   { bg: '#2D0D0D', text: '#F87171' },
};

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

function dimColor(v: number): string {
  if (v >= 70) return '#F87171';
  if (v >= 40) return '#FBBF24';
  return '#34D399';
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 2,
      color: TEXT_MUTED, textTransform: 'uppercase' as const,
      borderBottom: `1px solid ${BORDER}`, paddingBottom: 8,
      fontFamily: 'ui-monospace, Consolas, monospace',
    }}>
      {children}
    </div>
  );
}

interface Props {
  result: AnalyzeResponse;
  commodity: string;
  horizon: string;
  onReset: () => void;
}

export default function DashboardScreen({ result, commodity, horizon, onReset }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('analysis');

  const riskLevel  = getRiskLevel(clamp(result.overall_risk_score ?? result.risk_score));
  const riskColor  = RISK_COLORS[riskLevel];
  const readiness  = clamp(result.export_readiness ?? (100 - result.risk_score));
  const verdict    = result.executive?.overall_verdict;
  const verdictColor = verdict === 'Go' ? '#34D399' : verdict === 'Hold' ? '#F87171' : '#FBBF24';

  const dims = [
    { label: 'Regulatory', value: clamp(result.regulatory?.risk_score ?? result.risk_score) },
    { label: 'Climate',    value: clamp(result.climate?.climate_risk_score ?? 55) },
    { label: 'Market',     value: clamp(result.market?.market_risk_score ?? 50) },
    { label: 'Logistics',  value: clamp(result.logistics?.logistics_risk_score ?? 44) },
  ];

  const gap     = result.gap;
  const exec    = result.executive;
  const profile = gap?.supplier_profile;

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: 'system-ui, sans-serif' }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: BG, borderBottom: `1px solid ${BORDER}`,
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 24px',
      }}>
        <span style={{
          background: AMBER, color: '#000',
          fontFamily: 'ui-monospace, Consolas, monospace',
          fontWeight: 700, fontSize: 12, letterSpacing: 1,
          padding: '4px 8px', borderRadius: 3, flexShrink: 0,
        }}>OS</span>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, color: TEXT }}>ORIGINSIGNAL</span>

        <span style={{
          fontFamily: 'ui-monospace, Consolas, monospace',
          fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
          color: TEXT_MUTED, marginLeft: 4,
        }}>
          {commodity.toUpperCase()} · BRAZIL → EU · {horizon} DAYS
        </span>

        <div style={{ flex: 1 }} />

        <button
          onClick={onReset}
          style={{
            background: 'none', border: `1px solid ${BORDER}`,
            borderRadius: 4, color: TEXT_MUTED,
            padding: '5px 12px', cursor: 'pointer',
            fontSize: 11, fontFamily: 'ui-monospace, Consolas, monospace',
            letterSpacing: 1, textTransform: 'uppercase' as const,
            transition: 'color 0.15s',
          }}
        >
          ← New Analysis
        </button>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', borderBottom: `1px solid ${BORDER}`,
        padding: '0 24px', maxWidth: 880, margin: '0 auto',
      }}>
        {(['analysis', 'map'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px', fontSize: 11, fontWeight: 700,
              letterSpacing: 1.5, fontFamily: 'ui-monospace, Consolas, monospace',
              textTransform: 'uppercase' as const, background: 'none', border: 'none',
              borderBottom: activeTab === tab ? `2px solid ${AMBER}` : '2px solid transparent',
              color: activeTab === tab ? TEXT : TEXT_MUTED,
              cursor: 'pointer', marginBottom: -1, transition: 'color 0.15s',
            }}
          >
            {tab === 'analysis' ? 'Analysis' : 'Map'}
          </button>
        ))}
      </div>

      {/* Main content */}
      <main style={{
        width: '100%', maxWidth: activeTab === 'map' ? 880 : 760,
        margin: '0 auto', padding: '28px 24px 60px',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        {activeTab === 'map' && <HexMap />}

        {activeTab === 'analysis' && (
          <div style={{
            background: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 8, padding: 28,
            display: 'flex', flexDirection: 'column', gap: 28,
          }}>
            {/* ── Score row ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 600, letterSpacing: 2,
                  color: '#475569', textTransform: 'uppercase' as const,
                  marginBottom: 4, fontFamily: 'ui-monospace, Consolas, monospace',
                }}>Export Readiness</div>
                <span style={{
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  fontSize: 52, fontWeight: 700, color: AMBER, lineHeight: 1,
                }}>
                  {readiness}
                </span>
              </div>

              <span style={{
                fontFamily: 'ui-monospace, Consolas, monospace', fontWeight: 700,
                fontSize: 12, letterSpacing: 1.5, padding: '4px 10px', borderRadius: 4,
                background: riskColor.bg, color: riskColor.text,
              }}>
                {riskLevel}
              </span>

              {verdict && (
                <span style={{
                  fontFamily: 'ui-monospace, Consolas, monospace', fontWeight: 700,
                  fontSize: 14, letterSpacing: 2, padding: '4px 12px', borderRadius: 4,
                  color: verdictColor, border: `1.5px solid ${verdictColor}`,
                }}>
                  {verdict.toUpperCase()}
                </span>
              )}

              {exec?.trade_window && (
                <span style={{
                  fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 10,
                  fontWeight: 600, letterSpacing: 0.8, color: AMBER,
                  border: `1px solid ${AMBER}55`, borderRadius: 4,
                  padding: '3px 8px', maxWidth: 280, lineHeight: 1.4,
                }}>
                  ⬡ {exec.trade_window}
                </span>
              )}
            </div>

            {/* ── 4 dimension cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {dims.map(({ label, value }) => {
                const col = dimColor(value);
                return (
                  <div key={label} style={{
                    background: BG, border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 6, padding: '10px 12px',
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    <div style={{
                      fontSize: 9, fontWeight: 600, letterSpacing: 1.5,
                      color: '#475569', textTransform: 'uppercase' as const,
                      fontFamily: 'ui-monospace, Consolas, monospace',
                    }}>{label}</div>
                    <div style={{
                      fontFamily: 'ui-monospace, Consolas, monospace',
                      fontSize: 28, fontWeight: 700, lineHeight: 1, color: col,
                    }}>{value}</div>
                    <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${value}%`, background: col, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── GAP ANALYSIS ── */}
            {gap && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <SectionTitle>Gap Analysis · EUDR Compliance</SectionTitle>

                {/* Supplier profile meters */}
                {profile && (
                  <div style={{
                    background: BG, border: `1px solid ${BORDER}`,
                    borderRadius: 6, padding: '14px 16px',
                    display: 'flex', flexDirection: 'column', gap: 12,
                  }}>
                    {/* GPS Coverage bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace', letterSpacing: 0.5 }}>GPS Coverage</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          fontFamily: 'ui-monospace, Consolas, monospace',
                          color: profile.gps_coverage_pct >= 100 ? '#34D399' : '#F87171',
                        }}>{profile.gps_coverage_pct}%</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${profile.gps_coverage_pct}%`,
                          background: profile.gps_coverage_pct >= 100 ? '#34D399' : '#F87171',
                          borderRadius: 2,
                        }} />
                      </div>
                    </div>

                    {/* Deforestation docs */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace' }}>Deforestation Docs</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: profile.deforestation_docs ? '#34D399' : '#F87171' }}>
                        {profile.deforestation_docs ? '✓ Present' : '✗ Missing'}
                      </span>
                    </div>

                    {/* Supply chain */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace' }}>Supply Chain Mapped</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: profile.supply_chain_mapped ? '#34D399' : '#F87171' }}>
                        {profile.supply_chain_mapped ? '✓ Yes' : '✗ No'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Gaps identified */}
                {gap.gaps_identified?.map((g, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    fontSize: 13, color: '#F87171', lineHeight: 1.6,
                    paddingLeft: 4,
                  }}>
                    <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
                    <span>{g}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Findings ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SectionTitle>Findings</SectionTitle>
              {result.findings.map((f, i) => (
                <div key={i} style={{ fontSize: 14, color: TEXT, paddingLeft: 16, lineHeight: 1.6 }}>· {f}</div>
              ))}
            </div>

            {/* ── Articles Cited ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SectionTitle>Articles Cited</SectionTitle>
              {result.articles_cited.map((a, i) => (
                <div key={i} style={{
                  fontSize: 12, color: TEXT_MUTED, paddingLeft: 16, lineHeight: 1.6,
                  fontFamily: 'ui-monospace, Consolas, monospace',
                }}>· {a}</div>
              ))}
            </div>

            {/* ── Recommendations ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SectionTitle>Recommendations</SectionTitle>
              {result.recommendations.map((r, i) => (
                <div key={i} style={{ fontSize: 14, color: TEXT, paddingLeft: 16, lineHeight: 1.6 }}>· {r}</div>
              ))}
            </div>

            {/* ── Executive Briefing ── */}
            {exec && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <SectionTitle>Executive Briefing</SectionTitle>

                {/* Summary */}
                <p style={{ fontSize: 14, color: TEXT_MUTED, lineHeight: 1.75, margin: 0 }}>
                  {exec.executive_summary}
                </p>

                {/* Key Risks */}
                {exec.key_risks?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#475569', textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                      Key Risks
                    </div>
                    {exec.key_risks.map((risk, i) => {
                      const sev = risk.severity;
                      const sevColor = sev === 'critical' ? '#F87171' : sev === 'high' ? '#FBBF24' : '#94A3B8';
                      return (
                        <div key={i} style={{
                          display: 'flex', gap: 0,
                          background: BG, borderRadius: 6,
                          border: `1px solid ${BORDER}`,
                          borderLeft: `3px solid ${sevColor}`,
                          overflow: 'hidden',
                        }}>
                          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                fontFamily: 'ui-monospace, Consolas, monospace',
                                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                                color: sevColor, textTransform: 'uppercase' as const,
                              }}>{sev}</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{risk.title}</span>
                            </div>
                            <div style={{ fontSize: 13, color: TEXT_MUTED, lineHeight: 1.5 }}>{risk.description}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Recommended Actions */}
                {exec.recommended_actions?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#475569', textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                      Recommended Actions
                    </div>
                    {exec.recommended_actions.map((act, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <span style={{
                          fontFamily: 'ui-monospace, Consolas, monospace',
                          fontSize: 9, fontWeight: 700, color: '#000',
                          background: AMBER, borderRadius: 3,
                          padding: '2px 7px', flexShrink: 0, marginTop: 2,
                          whiteSpace: 'nowrap' as const,
                        }}>
                          {act.timeline}
                        </span>
                        <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{act.action}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
