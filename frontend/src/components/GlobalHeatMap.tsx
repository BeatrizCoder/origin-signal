import { useEffect, useRef, useState } from 'react';
import { getGlobalRisk } from '../services/api';
import type { CountryRiskScores, GlobalRiskResponse } from '../types';
import { useLanguage } from '../context/LanguageContext';

type Direction = 'export' | 'import';
type Dimension = 'regulatory' | 'climate' | 'market' | 'overall';
type TradeDirection = 'export' | 'import';

interface Props {
  commodity: string;
  tradeDirection?: TradeDirection;
  onAnalyzeRoute?: (origin: string, destination: string, tradeDirection: TradeDirection) => void;
}

const AMBER        = '#D4900A';
const ORANGE       = '#FB923C';
const BG           = '#0B1120';
const SIDEBAR_BG   = '#0F1A2E';
const BORDER_CSS   = 'rgba(255,255,255,0.06)';
const BORDER       = '#1E2D45';
const TEXT         = '#F1F5F9';
const TEXT_MUTED   = '#7A90A8';
const SIDEBAR_W    = 280;
const CONTINENT_FILL = '#152238';
const BRAZIL_FILL  = '#1B2E4A';

const GREEN = '#34D399';
const YELLOW = '#FBBF24';
const RED   = '#F87171';
const GRAY  = '#3A4A61';

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  LOW:    { bg: '#0D3321', text: '#34D399' },
  MEDIUM: { bg: '#2D1F00', text: '#FBBF24' },
  HIGH:   { bg: '#2D0D0D', text: '#F87171' },
};

function getColor(score: number | undefined): string {
  if (score === undefined) return GRAY;
  if (score < 40) return GREEN;
  if (score <= 65) return YELLOW;
  return RED;
}

function riskLabel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score < 40) return 'LOW';
  if (score <= 65) return 'MEDIUM';
  return 'HIGH';
}

interface Coord { x: number; y: number; }

const COUNTRY_COORDS: Record<string, Coord> = {
  // Europe
  'United Kingdom': { x: 445, y: 70 },
  'Norway':         { x: 490, y: 45 },
  'Netherlands':    { x: 470, y: 80 },
  'Belgium':        { x: 460, y: 95 },
  'Germany':        { x: 500, y: 90 },
  'France':         { x: 455, y: 115 },
  'Switzerland':    { x: 485, y: 120 },
  'Italy':          { x: 500, y: 140 },
  'Spain':          { x: 435, y: 145 },
  'European Union': { x: 545, y: 50 },
  // North America
  'United States': { x: 140, y: 110 },
  'Mexico':        { x: 110, y: 190 },
  // South / Central America
  'Colombia': { x: 150, y: 260 },
  'Peru':     { x: 145, y: 300 },
  'Argentina':{ x: 190, y: 420 },
  'Chile':    { x: 140, y: 390 },
  'Honduras': { x: 105, y: 235 },
  // Asia / Middle East
  'China':        { x: 720, y: 110 },
  'Japan':        { x: 840, y: 100 },
  'South Korea':  { x: 800, y: 90 },
  'Vietnam':      { x: 760, y: 180 },
  'Saudi Arabia': { x: 610, y: 190 },
  'UAE':          { x: 640, y: 200 },
  // Africa
  'Ethiopia': { x: 520, y: 260 },
};

const CONTINENTS = [
  { name: 'North America', x: 30,  y: 30,  w: 230, h: 190, rx: 18 },
  { name: 'South America', x: 100, y: 225, w: 220, h: 235, rx: 18 },
  { name: 'Europe',        x: 420, y: 30,  w: 150, h: 140, rx: 14 },
  { name: 'Africa',        x: 420, y: 180, w: 160, h: 250, rx: 18 },
  { name: 'Asia',          x: 580, y: 30,  w: 300, h: 260, rx: 18 },
  { name: 'Oceania',       x: 760, y: 330, w: 150, h: 110, rx: 14 },
];

const BRAZIL_RECT = { x: 190, y: 270, w: 110, h: 150, rx: 14 };

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

  const activeDataset: Record<string, CountryRiskScores> | undefined =
    data ? (direction === 'export' ? data.export_destinations : data.import_origins) : undefined;

  const countries = activeDataset
    ? Object.keys(activeDataset).filter(name => COUNTRY_COORDS[name])
    : [];

  const selectedScores = selected && activeDataset ? activeDataset[selected] : null;
  const hoveredScores   = hovered && activeDataset ? activeDataset[hovered] : null;

  function scoreFor(scores: CountryRiskScores): number {
    return dimension === 'overall' ? scores.overall : scores[dimension];
  }

  function handleMarkerEnter(e: React.MouseEvent, country: string) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setHovered(country);
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
      background: BG, display: 'flex',
    }}>
      <style>{`
        @keyframes os-global-pulse {
          0%, 100% { opacity: 0.45; transform: scale(0.85); }
          50%      { opacity: 1;    transform: scale(1.2); }
        }
      `}</style>

      {/* ── Map area ── */}
      <div ref={containerRef} style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden' }}>

        {/* Controls — top left */}
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {DIRECTIONS.map(d => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                style={{
                  padding: '5px 12px', fontSize: 10, fontWeight: 700, letterSpacing: 1,
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  border: `1px solid ${direction === d ? AMBER : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 4,
                  background: direction === d ? AMBER : 'rgba(11,17,32,0.82)',
                  color: direction === d ? '#000' : TEXT_MUTED,
                  cursor: 'pointer', textTransform: 'uppercase' as const,
                  backdropFilter: 'blur(4px)', transition: 'all 0.15s',
                }}
              >
                {d === 'export' ? t('export_destinations') : t('import_origins')}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {DIMENSIONS.map(dim => (
              <button
                key={dim}
                onClick={() => setDimension(dim)}
                style={{
                  padding: '4px 10px', fontSize: 9, fontWeight: 700, letterSpacing: 1,
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  border: `1px solid ${dimension === dim ? AMBER : 'rgba(255,255,255,0.10)'}`,
                  borderRadius: 4,
                  background: dimension === dim ? 'rgba(212,144,10,0.18)' : 'rgba(11,17,32,0.82)',
                  color: dimension === dim ? AMBER : TEXT_MUTED,
                  cursor: 'pointer', textTransform: 'uppercase' as const,
                  backdropFilter: 'blur(4px)', transition: 'all 0.15s',
                }}
              >
                {dim === 'overall' ? t('overall_risk') : t(dim)}
              </button>
            ))}
          </div>
        </div>

        {/* Legend — bottom left */}
        <div style={{
          position: 'absolute', bottom: 16, left: 16, zIndex: 10,
          background: 'rgba(11,17,32,0.85)', backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6, padding: '7px 12px',
          display: 'flex', gap: 14, alignItems: 'center',
        }}>
          {[{ color: GREEN, label: 'LOW', range: '< 40' }, { color: YELLOW, label: 'MEDIUM', range: '40–65' }, { color: RED, label: 'HIGH', range: '> 65' }].map(({ color, label, range }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color + 'CC', border: `1px solid ${color}66` }} />
              <span style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace', letterSpacing: 0.5 }}>
                {label} {range}
              </span>
            </div>
          ))}
        </div>

        {/* SVG world map */}
        <svg viewBox="0 0 960 500" width="100%" height="100%" style={{ display: 'block' }}>
          <rect x={0} y={0} width={960} height={500} fill={BG} />

          {CONTINENTS.map(c => (
            <rect key={c.name} x={c.x} y={c.y} width={c.w} height={c.h} rx={c.rx}
              fill={CONTINENT_FILL} stroke={BORDER} strokeWidth={1.5} />
          ))}

          <rect x={BRAZIL_RECT.x} y={BRAZIL_RECT.y} width={BRAZIL_RECT.w} height={BRAZIL_RECT.h} rx={BRAZIL_RECT.rx}
            fill={BRAZIL_FILL} stroke={AMBER} strokeWidth={1.5} strokeOpacity={0.5} />
          <text x={BRAZIL_RECT.x + BRAZIL_RECT.w / 2} y={BRAZIL_RECT.y + BRAZIL_RECT.h / 2}
            textAnchor="middle" fill={AMBER} fontSize={11} fontWeight={700}
            fontFamily="ui-monospace, Consolas, monospace" letterSpacing={1.5}>
            BRAZIL
          </text>

          {!loading && !errorMsg && activeDataset && countries.map(country => {
            const scores = activeDataset[country];
            const coord  = COUNTRY_COORDS[country];
            const score  = scoreFor(scores);
            const color  = getColor(score);
            const isSelected = selected === country;
            const isHov      = hovered === country;

            return (
              <g
                key={country}
                onClick={() => setSelected(country)}
                onMouseEnter={e => handleMarkerEnter(e, country)}
                onMouseMove={handleMarkerMove}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle cx={coord.x} cy={coord.y} r={14}
                  fill={color} fillOpacity={0.82}
                  stroke={isSelected ? AMBER : isHov ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)'}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
                <text x={coord.x} y={coord.y + 4} textAnchor="middle"
                  fontSize={10} fontWeight={700} fill="#00000099"
                  fontFamily="ui-monospace, Consolas, monospace">{score}</text>
                <text x={coord.x} y={coord.y + 3} textAnchor="middle"
                  fontSize={10} fontWeight={700} fill="rgba(255,255,255,0.95)"
                  fontFamily="ui-monospace, Consolas, monospace">{score}</text>
                <text x={coord.x} y={coord.y - 20} textAnchor="middle"
                  fontSize={8.5} fontWeight={600} fill={TEXT_MUTED}
                  fontFamily="ui-monospace, Consolas, monospace" letterSpacing={0.3}
                  textTransform="uppercase" style={{ textTransform: 'uppercase' }}>
                  {country}
                </text>

                {scores.tariff_alert && (
                  <text x={coord.x + 13} y={coord.y - 13} textAnchor="middle" fontSize={14}
                    style={{ animation: 'os-global-pulse 1.2s ease-in-out infinite', transformOrigin: `${coord.x + 13}px ${coord.y - 13}px` }}>
                    ⚠️
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Loading / error / empty states */}
        {(loading || errorMsg || (!loading && countries.length === 0)) && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: 1.2, color: TEXT_MUTED,
              fontFamily: 'ui-monospace, Consolas, monospace', textTransform: 'uppercase' as const,
            }}>
              {loading ? '…' : t('no_data')}
            </span>
          </div>
        )}

        {/* Hover tooltip */}
        {hovered && hoveredScores && (
          <div style={{
            position: 'absolute',
            left: tooltipPos.x + 16, top: tooltipPos.y + 16,
            zIndex: 20, pointerEvents: 'none',
            background: 'rgba(11,17,32,0.95)', border: `1px solid ${BORDER}`,
            borderRadius: 6, padding: '10px 12px', minWidth: 170,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: TEXT, letterSpacing: 0.5,
              fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 6,
              textTransform: 'uppercase' as const,
            }}>{hovered}</div>
            {([['regulatory', hoveredScores.regulatory], ['climate', hoveredScores.climate], ['market', hoveredScores.market], ['logistics', hoveredScores.logistics], ['overall_risk', hoveredScores.overall]] as const).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 10, color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 2 }}>
                <span style={{ textTransform: 'uppercase' as const }}>{t(key)}</span>
                <span style={{ color: getColor(val), fontWeight: 700 }}>{val}</span>
              </div>
            ))}
            {hoveredScores.tariff_note && (
              <div style={{
                marginTop: 6, paddingTop: 6, borderTop: `1px solid ${BORDER}`,
                fontSize: 9.5, color: ORANGE, lineHeight: 1.4,
                fontFamily: 'ui-monospace, Consolas, monospace',
              }}>
                ⚠️ {hoveredScores.tariff_note}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Sidebar panel ── */}
      <div style={{
        width: SIDEBAR_W, flexShrink: 0, height: '100%',
        background: SIDEBAR_BG, borderLeft: `1px solid ${BORDER_CSS}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {selected && selectedScores ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{
                fontSize: 13, fontWeight: 700, letterSpacing: 0.8, color: TEXT,
                fontFamily: 'ui-monospace, Consolas, monospace',
                textTransform: 'uppercase' as const, lineHeight: 1.4,
              }}>{selected}</span>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', color: TEXT_MUTED, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}
              >×</button>
            </div>

            {/* Overall risk + badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 600, letterSpacing: 1.5, color: TEXT_MUTED,
                  textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 2,
                }}>{t('overall_risk')}</div>
                <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 40, fontWeight: 700, color: AMBER, lineHeight: 1 }}>
                  {selectedScores.overall}
                </div>
              </div>
              <span style={{
                fontFamily: 'ui-monospace, Consolas, monospace', fontWeight: 700, fontSize: 9, letterSpacing: 1,
                padding: '2px 8px', borderRadius: 3, alignSelf: 'flex-start', marginTop: 4,
                background: RISK_COLORS[riskLabel(selectedScores.overall)].bg,
                color: RISK_COLORS[riskLabel(selectedScores.overall)].text,
              }}>{riskLabel(selectedScores.overall)}</span>
            </div>

            {/* Dimension bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DIM_BAR_LABELS.map(({ key, label }) => {
                const val = selectedScores[key];
                const col = getColor(val);
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 600, letterSpacing: 1.2, color: TEXT_MUTED,
                        textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace',
                      }}>{label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: col, fontFamily: 'ui-monospace, Consolas, monospace' }}>{val}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${val}%`, background: col, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tariff alert */}
            {selectedScores.tariff_alert && (
              <div style={{
                background: `${ORANGE}1A`, border: `1px solid ${ORANGE}44`,
                borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: ORANGE,
                  textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace',
                }}>⚠️ {t('tariff_alert')}</span>
                {selectedScores.tariff_note && (
                  <span style={{ fontSize: 11, color: TEXT, lineHeight: 1.5 }}>{selectedScores.tariff_note}</span>
                )}
              </div>
            )}

            {/* Analyze button */}
            <button
              onClick={handleAnalyzeClick}
              disabled={!onAnalyzeRoute}
              style={{
                width: '100%', padding: '8px 14px', marginTop: 4,
                background: !onAnalyzeRoute ? 'rgba(212,144,10,0.15)' : AMBER,
                color: !onAnalyzeRoute ? AMBER : '#000',
                border: `1px solid ${AMBER}`, borderRadius: 4,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                fontFamily: 'ui-monospace, Consolas, monospace', textTransform: 'uppercase' as const,
                cursor: !onAnalyzeRoute ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
              }}
            >
              {t('analyze_route')}
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', border: `1px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_MUTED, fontSize: 18,
            }}>◎</div>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: TEXT_MUTED,
              fontFamily: 'ui-monospace, Consolas, monospace', textAlign: 'center', textTransform: 'uppercase' as const,
            }}>
              Select a country<br />to view details
            </div>
            <div style={{ fontSize: 9, color: BORDER, fontFamily: 'ui-monospace, Consolas, monospace', textAlign: 'center', lineHeight: 1.8 }}>
              {countries.length} {direction === 'export' ? t('export_destinations') : t('import_origins')}<br />with EUDR risk scoring
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
