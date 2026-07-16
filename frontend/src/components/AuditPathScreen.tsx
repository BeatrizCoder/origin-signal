import { useState, useRef, useEffect } from 'react';
import type { AuditPathResult } from '../types';
import { calculateAuditPath } from '../services/api';
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

const REGIONS = [
  'Cerrado Mineiro', 'Sul de Minas', 'Chapada Diamantina', 'Mogiana',
  'Zona da Mata', 'Norte PR', 'Triângulo MG', 'Serra Gaúcha',
  'Rondônia', 'Planalto Sul', 'Oeste da Bahia', 'Sul ES',
];

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

function dimColor(v: number): string {
  if (v >= 70) return '#F87171';
  if (v >= 40) return '#FBBF24';
  return '#34D399';
}

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

export default function AuditPathScreen({ onBack }: Props) {
  const [coverage,  setCoverage]  = useState(80);
  const [startRegion, setStartRegion] = useState('Cerrado Mineiro');
  const [commodity, setCommodity] = useState('coffee');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [result,    setResult]    = useState<AuditPathResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { t } = useLanguage();

  async function handleCalculate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await calculateAuditPath(coverage, startRegion, commodity);
      setResult(data);
    } catch {
      setError('Failed to calculate audit route. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!result) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr  = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const lats = result.route.map(s => s.coords.lat);
    const lons = result.route.map(s => s.coords.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const latRange = maxLat - minLat || 1;
    const lonRange = maxLon - minLon || 1;
    const pad = 36;

    function project(lat: number, lon: number): [number, number] {
      const x = pad + ((lon - minLon) / lonRange) * (W - pad * 2);
      const y = pad + (1 - (lat - minLat) / latRange) * (H - pad * 2);
      return [x, y];
    }

    const points = result.route.map(s => project(s.coords.lat, s.coords.lon));

    ctx.strokeStyle = `${AMBER}88`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    points.forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fillStyle = AMBER;
      ctx.fill();
      ctx.strokeStyle = BG;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#000';
      ctx.font = 'bold 11px ui-monospace, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x, y);

      ctx.fillStyle = TEXT_MUTED;
      ctx.font = '9px ui-monospace, Consolas, monospace';
      ctx.fillText(result.route[i].region, x, y + 22);
    });
  }, [result]);

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
          }}>⬡ {t('min_coverage_path')}</div>
        </div>
        <LangToggle />
      </div>

      <main style={{ padding: '24px 28px 60px', maxWidth: 1100, margin: '0 auto' }}>

        <div style={{
          fontSize: 12, color: TEXT_MUTED, marginBottom: 24,
          fontFamily: 'ui-monospace, Consolas, monospace',
        }}>{t('audit_subtitle')}</div>

        {/* Config section */}
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: 8, padding: '20px 24px', marginBottom: 24,
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 24 }}>
            <div>
              <label style={{
                display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
                color: TEXT_MUTED, marginBottom: 10, textTransform: 'uppercase' as const,
                fontFamily: 'ui-monospace, Consolas, monospace',
              }}>{t('coverage_target')}</label>
              <input
                type="range"
                min={60}
                max={100}
                step={5}
                value={coverage}
                onChange={e => setCoverage(Number(e.target.value))}
                style={{ width: '100%', accentColor: AMBER, cursor: 'pointer' }}
              />
              <div style={{
                fontFamily: 'ui-monospace, Consolas, monospace',
                fontSize: 22, fontWeight: 700, color: AMBER_LIGHT, marginTop: 8,
              }}>{coverage}%</div>
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
                color: TEXT_MUTED, marginBottom: 10, textTransform: 'uppercase' as const,
                fontFamily: 'ui-monospace, Consolas, monospace',
              }}>{t('start_region')}</label>
              <select
                value={startRegion}
                onChange={e => setStartRegion(e.target.value)}
                style={{
                  width: '100%', background: BG, border: `1px solid ${BORDER}`,
                  borderRadius: 6, color: TEXT, fontSize: 13,
                  padding: '10px 12px', outline: 'none', cursor: 'pointer',
                }}
              >
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
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
            onClick={handleCalculate}
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
            {loading ? '...' : t('calculate_route')}
          </button>
        </div>

        {error && (
          <div style={{ color: '#F87171', fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {/* Results */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Impact cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={{
                background: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED, textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace' }}>{t('total_stops')}</div>
                <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 32, fontWeight: 700, color: AMBER_LIGHT }}>{result.total_stops}</div>
              </div>
              <div style={{
                background: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED, textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace' }}>{t('coverage_achieved')}</div>
                <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 32, fontWeight: 700, color: MOSS }}>
                  {result.achieved_coverage_pct}<span style={{ fontSize: 16 }}>%</span>
                  <span style={{ fontSize: 12, color: TEXT_MUTED }}> / {result.target_coverage_pct}%</span>
                </div>
                <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                  {result.volume_covered_kt} kt · {t('volume_unlocked')}: <span style={{ color: MOSS }}>{result.volume_unlocked_kt} kt</span>
                </div>
              </div>
              <div style={{
                background: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED, textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace' }}>{t('route_distance')}</div>
                <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 32, fontWeight: 700, color: TEXT }}>{result.total_distance_km} <span style={{ fontSize: 13, color: TEXT_MUTED }}>km</span></div>
              </div>
              <div style={{
                background: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED, textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace' }}>{t('audit_duration')}</div>
                <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 32, fontWeight: 700, color: TEXT }}>{result.audit_days} <span style={{ fontSize: 13, color: TEXT_MUTED }}>days</span></div>
              </div>
              <div style={{
                background: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED, textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace' }}>{t('mission_cost')}</div>
                <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 22, fontWeight: 700, color: TEXT }}>{fmtBRL(result.mission_cost_brl)}</div>
              </div>
              <div style={{
                background: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED, textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace' }}>{t('eudr_fine_risk')}</div>
                <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 22, fontWeight: 700, color: '#F87171' }}>{fmtBRL(result.eudr_fine_risk_brl)}</div>
              </div>
              <div style={{
                background: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED, textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace' }}>ROI</div>
                <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 32, fontWeight: 700, color: MOSS }}>{result.roi_ratio}<span style={{ fontSize: 16 }}>×</span></div>
              </div>
            </div>

            {/* Route timeline */}
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: '20px 24px',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
                textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace',
              }}>Route Timeline</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', gap: 0, paddingBottom: 8 }}>
                {result.route.map((stop, i) => (
                  <div key={stop.stop} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 140 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: AMBER, color: '#000',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 13, fontFamily: 'ui-monospace, Consolas, monospace',
                      }}>{stop.stop}</div>
                      <div style={{ textAlign: 'center' as const, fontSize: 12, fontWeight: 700, color: TEXT, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                        {stop.region}
                      </div>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
                        padding: '2px 7px', borderRadius: 3,
                        color: dimColor(stop.risk_score), border: `1px solid ${dimColor(stop.risk_score)}55`,
                        fontFamily: 'ui-monospace, Consolas, monospace',
                      }}>RISK {stop.risk_score}</span>
                      <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace', textAlign: 'center' as const }}>
                        {stop.volume_kt} kt · <span style={{ color: MOSS }}>{stop.unlock_kt} kt</span>
                      </div>
                      <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                        {stop.days_on_site} {t('days_on_site')}
                      </div>
                    </div>
                    {i < result.route_segments.length && (
                      <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', width: 90, marginTop: 15, gap: 4,
                      }}>
                        <div style={{ width: '100%', height: 2, background: `${AMBER}44` }} />
                        <span style={{ fontSize: 14 }}>
                          {result.route_segments[i].transport === 'flight' ? '✈' : '🚗'}
                        </span>
                        <span style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                          {result.route_segments[i].distance_km} km
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Route map */}
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: '20px 24px',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
                textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace',
              }}>Route Map</div>
              <canvas ref={canvasRef} style={{ width: '100%', height: 320, display: 'block' }} />
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
              <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.75 }}>{result.mathematical_basis}</div>
              <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.6 }}>{result.insight}</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
