import { useState, useRef, useEffect } from 'react';
import type { AuditPathResult } from '../types';
import { calculateAuditPath } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import LangToggle from './LangToggle';
import ScreenHeader from './ui/ScreenHeader';
import Eyebrow from './ui/Eyebrow';
import { COLORS, FONT, riskColor } from '../theme';

const REGIONS = [
  'Cerrado Mineiro', 'Sul de Minas', 'Chapada Diamantina', 'Mogiana',
  'Zona da Mata', 'Norte PR', 'Triângulo MG', 'Serra Gaúcha',
  'Rondônia', 'Planalto Sul', 'Oeste da Bahia', 'Sul ES',
];

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
  color: COLORS.textSecondary, marginBottom: 10, textTransform: 'uppercase' as const,
  fontFamily: FONT,
};

const CARD: React.CSSProperties = {
  background: COLORS.panel, border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: 10, padding: '20px 24px',
};

const STAT_CARD: React.CSSProperties = {
  ...CARD, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6,
};

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
    ctx.fillStyle = COLORS.bg;
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

    ctx.strokeStyle = `${COLORS.amber}88`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    points.forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.amber;
      ctx.fill();
      ctx.strokeStyle = COLORS.bg;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#1A1204';
      ctx.font = 'bold 11px "Manrope", "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x, y);

      ctx.fillStyle = COLORS.textSecondary;
      ctx.font = '9px "Manrope", "IBM Plex Sans", sans-serif';
      ctx.fillText(result.route[i].region, x, y + 22);
    });
  }, [result]);

  return (
    <div style={{ minHeight: '100vh', color: COLORS.textPrimary, fontFamily: FONT }}>
      <ScreenHeader
        title={t('min_coverage_path')}
        backLabel={t('back')}
        onBack={onBack}
        right={<LangToggle />}
      />

      <main style={{ padding: '24px 28px 60px', maxWidth: 1100, margin: '0 auto' }}>

        <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 24, fontFamily: FONT }}>
          {t('audit_subtitle')}
        </div>

        {/* Config section */}
        <div style={{ ...CARD, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 24 }}>
            <div>
              <label style={LABEL_STYLE}>{t('coverage_target')}</label>
              <input
                type="range"
                min={60}
                max={100}
                step={5}
                value={coverage}
                onChange={e => setCoverage(Number(e.target.value))}
                style={{ width: '100%', accentColor: COLORS.amber, cursor: 'pointer' }}
              />
              <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 800, color: COLORS.amberBright, marginTop: 8 }}>
                {coverage}%
              </div>
            </div>

            <div>
              <label style={LABEL_STYLE}>{t('start_region')}</label>
              <select
                value={startRegion}
                onChange={e => setStartRegion(e.target.value)}
                style={{
                  width: '100%', background: COLORS.bg, border: `1px solid ${COLORS.line}`,
                  borderRadius: 6, color: COLORS.textPrimary, fontSize: 13,
                  padding: '10px 12px', outline: 'none', cursor: 'pointer', fontFamily: FONT,
                }}
              >
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label style={LABEL_STYLE}>{t('commodity_label')}</label>
              <select
                value={commodity}
                onChange={e => setCommodity(e.target.value)}
                style={{
                  width: '100%', background: COLORS.bg, border: `1px solid ${COLORS.line}`,
                  borderRadius: 6, color: COLORS.textPrimary, fontSize: 14,
                  padding: '10px 12px', outline: 'none', cursor: 'pointer', fontFamily: FONT,
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
              background: loading ? 'rgba(217,119,6,0.25)' : COLORS.amber,
              color: loading ? '#7A5F1E' : '#1A1204',
              fontWeight: 700, fontSize: 12, letterSpacing: 2,
              fontFamily: FONT,
              border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
              padding: '11px 28px', textTransform: 'uppercase' as const,
            }}
          >
            {loading ? '...' : t('calculate_route')}
          </button>
        </div>

        {error && (
          <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {/* Results */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Impact cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={STAT_CARD}>
                <Eyebrow>{t('total_stops')}</Eyebrow>
                <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 800, color: COLORS.amberBright }}>{result.total_stops}</div>
              </div>
              <div style={STAT_CARD}>
                <Eyebrow>{t('coverage_achieved')}</Eyebrow>
                <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 800, color: COLORS.petroleo }}>
                  {result.achieved_coverage_pct}<span style={{ fontSize: 16 }}>%</span>
                  <span style={{ fontSize: 12, color: COLORS.textSecondary }}> / {result.target_coverage_pct}%</span>
                </div>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, fontFamily: FONT }}>
                  {result.volume_covered_kt} kt · {t('volume_unlocked')}: <span style={{ color: COLORS.petroleo }}>{result.volume_unlocked_kt} kt</span>
                </div>
              </div>
              <div style={STAT_CARD}>
                <Eyebrow>{t('route_distance')}</Eyebrow>
                <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 800, color: COLORS.textPrimary }}>{result.total_distance_km} <span style={{ fontSize: 13, color: COLORS.textSecondary }}>km</span></div>
              </div>
              <div style={STAT_CARD}>
                <Eyebrow>{t('audit_duration')}</Eyebrow>
                <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 800, color: COLORS.textPrimary }}>{result.audit_days} <span style={{ fontSize: 13, color: COLORS.textSecondary }}>days</span></div>
              </div>
              <div style={STAT_CARD}>
                <Eyebrow>{t('mission_cost')}</Eyebrow>
                <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 800, color: COLORS.textPrimary }}>{fmtBRL(result.mission_cost_brl)}</div>
              </div>
              <div style={STAT_CARD}>
                <Eyebrow>{t('eudr_fine_risk')}</Eyebrow>
                <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 800, color: COLORS.danger }}>{fmtBRL(result.eudr_fine_risk_brl)}</div>
              </div>
              <div style={STAT_CARD}>
                <Eyebrow>ROI</Eyebrow>
                <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 800, color: COLORS.petroleo }}>{result.roi_ratio}<span style={{ fontSize: 16 }}>×</span></div>
              </div>
            </div>

            {/* Route timeline */}
            <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Eyebrow>Route Timeline</Eyebrow>
              <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', gap: 0, paddingBottom: 8 }}>
                {result.route.map((stop, i) => (
                  <div key={stop.stop} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 140 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: COLORS.amber, color: '#1A1204',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 13, fontFamily: FONT,
                      }}>{stop.stop}</div>
                      <div style={{ textAlign: 'center' as const, fontSize: 12, fontWeight: 700, color: COLORS.textPrimary, fontFamily: FONT }}>
                        {stop.region}
                      </div>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
                        padding: '2px 7px', borderRadius: 3,
                        color: riskColor(stop.risk_score), border: `1px solid ${riskColor(stop.risk_score)}55`,
                        fontFamily: FONT,
                      }}>RISK {stop.risk_score}</span>
                      <div style={{ fontSize: 10, color: COLORS.textSecondary, fontFamily: FONT, textAlign: 'center' as const }}>
                        {stop.volume_kt} kt · <span style={{ color: COLORS.petroleo }}>{stop.unlock_kt} kt</span>
                      </div>
                      <div style={{ fontSize: 10, color: COLORS.textSecondary, fontFamily: FONT }}>
                        {stop.days_on_site} {t('days_on_site')}
                      </div>
                    </div>
                    {i < result.route_segments.length && (
                      <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', width: 90, marginTop: 15, gap: 4,
                      }}>
                        <div style={{ width: '100%', height: 2, background: `${COLORS.amber}44` }} />
                        <span style={{ fontSize: 14 }}>
                          {result.route_segments[i].transport === 'flight' ? '✈' : '🚗'}
                        </span>
                        <span style={{ fontSize: 9, color: COLORS.textSecondary, fontFamily: FONT }}>
                          {result.route_segments[i].distance_km} km
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Route map */}
            <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Eyebrow>Route Map</Eyebrow>
              <canvas ref={canvasRef} style={{ width: '100%', height: 320, display: 'block' }} />
            </div>

            {/* Mathematical basis */}
            <div style={{
              background: 'rgba(245,158,11,0.06)', border: `1px solid ${COLORS.amber}33`,
              borderRadius: 8, padding: '16px 18px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <Eyebrow>{t('mathematical_basis')}</Eyebrow>
              <div style={{ fontSize: 13, color: COLORS.textPrimary, lineHeight: 1.75, fontFamily: FONT }}>{result.mathematical_basis}</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6, fontFamily: FONT }}>{result.insight}</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
