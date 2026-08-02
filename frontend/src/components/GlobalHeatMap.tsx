import { useEffect, useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import worldAtlas from 'world-atlas/countries-110m.json';
import { getGlobalRisk } from '../services/api';
import type { CountryRiskScores, GlobalRiskResponse } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { COLORS, FONT } from '../theme';

type Direction = 'export' | 'import';
type Dimension = 'regulatory' | 'climate' | 'market' | 'overall';

interface Props {
  commodity: string;
  tradeDirection?: Direction;
  onAnalyzeRoute?: (origin: string, destination: string, tradeDirection: Direction) => void;
}

// [longitude, latitude] — real-world coordinates, projected onto the GeoJSON map below
type LatLon = [number, number];

// Palette from the approved prototype — kept local to this component (distinct visual
// language from the rest of the dashboard's COLORS constants).
const BTN_ACTIVE_BG    = '#D4900A';
const BTN_ACTIVE_TEXT  = '#0B1220';
const BTN_INACTIVE_TXT = '#94A3B8';
const BTN_BORDER       = 'rgba(255,255,255,0.1)';
const DIM_ACTIVE_BG     = 'rgba(212,144,10,0.15)';
const DIM_ACTIVE_TEXT   = '#D4900A';
const DIM_ACTIVE_BORDER = 'rgba(212,144,10,0.4)';

const SCORE_LOW    = '#34D399';
const SCORE_MEDIUM = '#FBBF24';
const SCORE_HIGH   = '#F87171';

const PANEL_BG   = COLORS.panel;
const RANKING_BG = '#0F1A2E';
const MAP_BG     = COLORS.bg;
const CONTINENT_FILL  = COLORS.panel;
const CONTINENT_LINE  = '#26364F';
const TEXT       = COLORS.textPrimary;
const TEXT_MUTED = COLORS.textSecondary;

const RISK_BADGE: Record<string, { bg: string; text: string }> = {
  LOW:    { bg: 'rgba(52,211,153,0.16)', text: SCORE_LOW },
  MEDIUM: { bg: 'rgba(251,191,36,0.16)', text: SCORE_MEDIUM },
  HIGH:   { bg: 'rgba(248,113,113,0.16)', text: SCORE_HIGH },
};

function getColor(score: number): string {
  if (score < 40) return SCORE_LOW;
  if (score <= 65) return SCORE_MEDIUM;
  return SCORE_HIGH;
}
function riskLabel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score < 40) return 'LOW';
  if (score <= 65) return 'MEDIUM';
  return 'HIGH';
}

const EXPORT_COORDS: Record<string, LatLon> = {
  'European Union':   [4.3517,   50.8503],
  Germany:            [10.4515,  51.1657],
  Netherlands:        [5.2913,   52.1326],
  France:             [2.2137,   46.2276],
  Norway:             [8.4689,   60.4720],
  Switzerland:        [8.2275,   46.8182],
  'United Kingdom':   [-3.4360,  55.3781],
  'United States':    [-98.5795, 39.8283],
  China:              [104.1954, 35.8617],
  Japan:              [138.2529, 36.2048],
  'South Korea':      [127.7669, 35.9078],
  'Saudi Arabia':     [45.0792,  23.8859],
  UAE:                [53.8478,  23.4241],
  Argentina:          [-63.6167, -38.4161],
  Colombia:           [-74.2973, 4.5709],
  Chile:              [-71.5430, -35.6751],
  Mexico:             [-102.5528, 23.6345],
  Uruguay:            [-55.7658, -32.5228],
  Paraguay:           [-58.4438, -23.4425],
};

const IMPORT_COORDS: Record<string, LatLon> = {
  'United States':    [-98.5795, 39.8283],
  China:              [104.1954, 35.8617],
  'European Union':   [4.3517,   50.8503],
  Norway:             [8.4689,   60.4720],
  Switzerland:        [8.2275,   46.8182],
  'United Kingdom':   [-3.4360,  55.3781],
  Argentina:          [-63.6167, -38.4161],
  Colombia:           [-74.2973, 4.5709],
  Peru:               [-75.0152, -9.1900],
  Chile:              [-71.5430, -35.6751],
  Uruguay:            [-55.7658, -32.5228],
  Paraguay:           [-58.4438, -23.4425],
  Vietnam:            [108.2772, 14.0583],
  Ethiopia:           [40.4897,  9.1450],
};

const COUNTRY_REGION: Record<string, string> = {
  'European Union': 'Europe', Germany: 'Europe', Netherlands: 'Europe', France: 'Europe',
  Norway: 'Europe', Switzerland: 'Europe', 'United Kingdom': 'Europe',
  'United States': 'N.America', Mexico: 'N.America',
  China: 'Asia', Japan: 'Asia', 'South Korea': 'Asia', Vietnam: 'Asia',
  'Saudi Arabia': 'Middle East', UAE: 'Middle East',
  Argentina: 'S.America', Colombia: 'S.America', Chile: 'S.America',
  Uruguay: 'S.America', Paraguay: 'S.America', Peru: 'S.America',
  Ethiopia: 'Africa',
};

const BRAZIL_LATLON: LatLon = [-51.9253, -14.2350];

const DIRECTIONS: Direction[] = ['export', 'import'];
const DIMENSIONS: Dimension[] = ['regulatory', 'climate', 'market', 'overall'];

export default function GlobalHeatMap({ commodity, tradeDirection = 'export', onAnalyzeRoute }: Props) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);

  const [data,      setData]      = useState<GlobalRiskResponse | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>(tradeDirection);
  const [dimension, setDimension] = useState<Dimension>('overall');
  const [selected,  setSelected]  = useState<string | null>(null);
  const [hovered,   setHovered]   = useState<string | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    getGlobalRisk(commodity)
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setErrorMsg('error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [commodity]);

  useEffect(() => { setSelected(null); }, [direction, commodity]);

  const coords = direction === 'export' ? EXPORT_COORDS : IMPORT_COORDS;

  const activeDataset: Record<string, CountryRiskScores> | undefined =
    data ? (direction === 'export' ? data.export_destinations : data.import_origins) : undefined;

  const countries = activeDataset
    ? Object.keys(activeDataset).filter(name => coords[name])
    : [];

  function scoreFor(scores: CountryRiskScores): number {
    return dimension === 'overall' ? scores.overall : scores[dimension];
  }

  const ranked = activeDataset
    ? countries
        .map(name => ({ name, scores: activeDataset[name], score: scoreFor(activeDataset[name]) }))
        .sort((a, b) => b.score - a.score)
    : [];

  const selectedScores = selected && activeDataset ? activeDataset[selected] : null;
  const hoveredScores   = hovered && activeDataset ? activeDataset[hovered] : null;

  function handleMarkerEnter(e: React.MouseEvent, country: string) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setHovered(country);
    setTooltipVisible(true);
  }
  function handleMarkerMove(e: React.MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  function handleAnalyzeClick() {
    if (!selected || !onAnalyzeRoute) return;
    if (direction === 'export') onAnalyzeRoute('Brazil', selected, 'export');
    else onAnalyzeRoute(selected, 'Brazil', 'import');
  }

  const DIM_BAR_LABELS: Array<{ key: keyof Pick<CountryRiskScores, 'regulatory' | 'climate' | 'market' | 'logistics'>; label: string }> = [
    { key: 'regulatory', label: t('regulatory') },
    { key: 'climate',    label: t('climate') },
    { key: 'market',     label: t('market') },
    { key: 'logistics',  label: t('logistics') },
  ];

  return (
    <div style={{
      position: 'relative', width: '100%', height: 'calc(100vh - 120px)',
      background: MAP_BG, display: 'flex',
    }}>
      <style>{`
        @keyframes os-global-pulse {
          0%, 100% { opacity: 0.45; transform: scale(0.85); }
          50%      { opacity: 1;    transform: scale(1.2); }
        }
      `}</style>

      {/* ── Map area — 2/3 ── */}
      <div ref={containerRef} style={{
        position: 'relative', flex: '2 1 0%', minWidth: 0, overflow: 'hidden',
        borderRight: `1px solid ${COLORS.line}`,
      }}>

        {/* Controls bar — direction toggle (left) + dimension toggle (right), wraps instead of overlapping on narrow widths */}
        <div style={{
          position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10,
          display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '6px 10px',
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {DIRECTIONS.map(d => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                style={{
                  padding: '4px 9px', fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
                  fontFamily: FONT,
                  border: direction === d ? 'none' : `1px solid ${BTN_BORDER}`,
                  borderRadius: 4,
                  background: direction === d ? BTN_ACTIVE_BG : 'transparent',
                  color: direction === d ? BTN_ACTIVE_TEXT : BTN_INACTIVE_TXT,
                  cursor: 'pointer', textTransform: 'uppercase' as const,
                  whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}
              >
                {d === 'export' ? t('export_destinations') : t('import_origins')}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {DIMENSIONS.map(dim => (
              <button
                key={dim}
                onClick={() => setDimension(dim)}
                style={{
                  padding: '4px 9px', fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
                  fontFamily: FONT,
                  border: `1px solid ${dimension === dim ? DIM_ACTIVE_BORDER : BTN_BORDER}`,
                  borderRadius: 4,
                  background: dimension === dim ? DIM_ACTIVE_BG : 'transparent',
                  color: dimension === dim ? DIM_ACTIVE_TEXT : BTN_INACTIVE_TXT,
                  cursor: 'pointer', textTransform: 'uppercase' as const,
                  whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}
              >
                {dim === 'overall' ? t('overall_risk') : t(dim)}
              </button>
            ))}
          </div>
        </div>

        {/* Legend — bottom left (covered by the detail panel while a country is selected) */}
        <div style={{
          position: 'absolute', bottom: 16, left: 16, zIndex: 5,
          background: 'rgba(11,17,32,0.85)', backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6, padding: '7px 12px',
          display: 'flex', gap: 14, alignItems: 'center',
        }}>
          {[{ color: SCORE_LOW, label: 'LOW', range: '< 40' }, { color: SCORE_MEDIUM, label: 'MEDIUM', range: '40–65' }, { color: SCORE_HIGH, label: 'HIGH', range: '> 65' }].map(({ color, label, range }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color + 'CC', border: `1px solid ${color}66` }} />
              <span style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: 0.5 }}>
                {label} {range}
              </span>
            </div>
          ))}
        </div>

        {/* Real-world GeoJSON map (react-simple-maps + world-atlas/Natural Earth) */}
        <ComposableMap width={800} height={450} style={{ width: '100%', height: '100%', display: 'block', background: MAP_BG }}>
          <Geographies geography={worldAtlas}>
            {({ geographies }) =>
              geographies.map(geo => {
                const isBrazil = geo.properties.name === 'Brazil';
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={CONTINENT_FILL}
                    stroke={isBrazil ? BTN_ACTIVE_BG : CONTINENT_LINE}
                    strokeWidth={isBrazil ? 1.25 : 0.6}
                    strokeOpacity={isBrazil ? 0.6 : 1}
                    style={{
                      default: { outline: 'none' },
                      hover: { outline: 'none' },
                      pressed: { outline: 'none' },
                    }}
                  />
                );
              })
            }
          </Geographies>

          <Marker coordinates={BRAZIL_LATLON}>
            <text textAnchor="middle" y={-10} fill={BTN_ACTIVE_BG}
              fontSize={6.5} fontWeight={700} fontFamily={FONT} letterSpacing={0.8}>
              BRAZIL
            </text>
          </Marker>

          {!loading && !errorMsg && activeDataset && countries.map(country => {
            const scores = activeDataset[country];
            const coord  = coords[country];
            const score  = scoreFor(scores);
            const color  = getColor(score);
            const isSelected = selected === country;
            const isHov      = hovered === country;

            return (
              <Marker key={country} coordinates={coord}>
                <g
                  onClick={() => setSelected(country)}
                  onMouseEnter={e => handleMarkerEnter(e, country)}
                  onMouseMove={handleMarkerMove}
                  onMouseLeave={() => { setHovered(null); setTooltipVisible(false); }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle r={8}
                    fill={color} fillOpacity={0.88}
                    stroke={isSelected ? BTN_ACTIVE_BG : isHov ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)'}
                    strokeWidth={isSelected ? 2 : 1.25}
                  />
                  <text y={2.5} textAnchor="middle"
                    fontSize={6.5} fontWeight={700} fill="rgba(0,0,0,0.65)"
                    fontFamily={FONT}>{score}</text>

                  {scores.tariff_alert && (
                    <text x={8} y={-8} textAnchor="middle" fontSize={9}
                      style={{ animation: 'os-global-pulse 1.2s ease-in-out infinite', transformOrigin: '8px -8px' }}>
                      ⚠️
                    </text>
                  )}
                </g>
              </Marker>
            );
          })}
        </ComposableMap>

        {/* Loading / error / empty states */}
        {(loading || errorMsg || (!loading && countries.length === 0)) && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: 1.2, color: TEXT_MUTED,
              fontFamily: FONT, textTransform: 'uppercase' as const,
            }}>
              {loading ? '…' : t('no_data')}
            </span>
          </div>
        )}

        {/* Hover tooltip — only for map marker hover; the ranking sidebar shows its own info inline */}
        {tooltipVisible && hovered && hoveredScores && (
          <div style={{
            position: 'absolute',
            left: tooltipPos.x + 16, top: tooltipPos.y + 16,
            zIndex: 20, pointerEvents: 'none',
            background: 'rgba(11,17,32,0.95)', border: `1px solid ${CONTINENT_LINE}`,
            borderRadius: 6, padding: '10px 12px', minWidth: 170,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: TEXT, letterSpacing: 0.5,
              fontFamily: FONT, marginBottom: 6, textTransform: 'uppercase' as const,
            }}>{hovered}</div>
            {([['regulatory', hoveredScores.regulatory], ['climate', hoveredScores.climate], ['market', hoveredScores.market], ['logistics', hoveredScores.logistics], ['overall_risk', hoveredScores.overall]] as const).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 10, color: TEXT_MUTED, fontFamily: FONT, marginBottom: 2 }}>
                <span style={{ textTransform: 'uppercase' as const }}>{t(key)}</span>
                <span style={{ color: getColor(val), fontWeight: 700 }}>{val}</span>
              </div>
            ))}
            {hoveredScores.tariff_note && (
              <div style={{
                marginTop: 6, paddingTop: 6, borderTop: `1px solid ${CONTINENT_LINE}`,
                fontSize: 9.5, color: BTN_ACTIVE_BG, lineHeight: 1.4, fontFamily: FONT,
              }}>
                ⚠️ {hoveredScores.tariff_note}
              </div>
            )}
          </div>
        )}

        {/* Detail panel — anchored to the bottom of the map, not a cut-off sidebar */}
        {selected && selectedScores && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 15,
            background: PANEL_BG, borderTop: `1px solid ${BTN_ACTIVE_BG}66`,
            padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 10,
            boxShadow: '0 -12px 28px rgba(0,0,0,0.35)',
          }}>
            <button
              onClick={() => setSelected(null)}
              style={{
                position: 'absolute', top: 10, right: 14,
                background: 'none', border: 'none', color: TEXT_MUTED,
                cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0,
              }}
            >×</button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: TEXT,
                  fontFamily: FONT, textTransform: 'uppercase' as const, marginBottom: 4,
                }}>{selected}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: FONT, fontSize: 28, fontWeight: 800, color: BTN_ACTIVE_BG, lineHeight: 1 }}>
                    {selectedScores.overall}
                  </span>
                  <span style={{
                    fontFamily: FONT, fontWeight: 700, fontSize: 9, letterSpacing: 1,
                    padding: '2px 8px', borderRadius: 3,
                    background: RISK_BADGE[riskLabel(selectedScores.overall)].bg,
                    color: RISK_BADGE[riskLabel(selectedScores.overall)].text,
                  }}>{riskLabel(selectedScores.overall)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, flex: 1, minWidth: 0 }}>
                {DIM_BAR_LABELS.map(({ key, label }) => {
                  const val = selectedScores[key];
                  const col = getColor(val);
                  return (
                    <div key={key} style={{ flex: '1 1 0%', minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 4 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: TEXT_MUTED,
                          textTransform: 'uppercase' as const, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: col, fontFamily: FONT, flexShrink: 0 }}>{val}</span>
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${val}%`, background: col, borderRadius: 2 }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleAnalyzeClick}
                disabled={!onAnalyzeRoute}
                style={{
                  flexShrink: 0, padding: '9px 18px',
                  background: !onAnalyzeRoute ? DIM_ACTIVE_BG : BTN_ACTIVE_BG,
                  color: !onAnalyzeRoute ? DIM_ACTIVE_TEXT : BTN_ACTIVE_TEXT,
                  border: `1px solid ${BTN_ACTIVE_BG}`, borderRadius: 4,
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                  fontFamily: FONT, textTransform: 'uppercase' as const, whiteSpace: 'nowrap',
                  cursor: !onAnalyzeRoute ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                }}
              >
                {t('analyze_route')} →
              </button>
            </div>

            {selectedScores.tariff_alert && selectedScores.tariff_note && (
              <div style={{
                paddingTop: 8, borderTop: `1px solid ${CONTINENT_LINE}`,
                fontSize: 10.5, color: BTN_ACTIVE_BG, lineHeight: 1.4, fontFamily: FONT,
              }}>
                ⚠️ {selectedScores.tariff_note}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Ranking sidebar — 1/3 ── */}
      <div style={{
        flex: '1 1 0%', minWidth: 240, height: '100%',
        background: RANKING_BG,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${COLORS.line}`, flexShrink: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: BTN_ACTIVE_BG,
            fontFamily: FONT, textTransform: 'uppercase' as const,
          }}>
            RANKING · {direction === 'export' ? t('export_destinations') : t('import_origins')}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {ranked.length === 0 && !loading && (
            <div style={{ padding: 20, fontSize: 11, color: TEXT_MUTED, fontFamily: FONT }}>
              {t('no_data')}
            </div>
          )}
          {ranked.map(({ name, score }) => {
            const isSelected = selected === name;
            const color = getColor(score);
            return (
              <div
                key={name}
                onClick={() => setSelected(name)}
                onMouseEnter={() => setHovered(name)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 18px',
                  background: isSelected ? 'rgba(212,144,10,0.08)' : 'transparent',
                  borderLeft: `2px solid ${isSelected ? BTN_ACTIVE_BG : 'transparent'}`,
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12.5, fontWeight: 600, color: TEXT, fontFamily: FONT,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{name}</div>
                  <div style={{ fontSize: 9.5, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: 0.3 }}>
                    {COUNTRY_REGION[name] ?? '—'}
                  </div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 800, color, fontFamily: FONT, flexShrink: 0 }}>
                  {score}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
