import { useRef, useEffect, useState } from 'react';
import { getRiskLevel } from '../types';

type Layer = 'regulatory' | 'climate' | 'market' | 'composite';

interface RegionScores {
  regulatory: number;
  climate: number;
  market: number;
  logistics: number;
}

interface Region {
  id: number;
  name: string;
  col: number;
  row: number;
  scores: RegionScores;
}

interface Props {
  onAnalyzeRegion?: (regionName: string) => Promise<RegionScores>;
}

const REGIONS: Region[] = [
  { id: 0,  name: 'Rondônia',           col: 0, row: 0, scores: { regulatory: 72, climate: 81, market: 48, logistics: 65 } },
  { id: 1,  name: 'Oeste da Bahia',     col: 2, row: 0, scores: { regulatory: 58, climate: 63, market: 52, logistics: 55 } },
  { id: 2,  name: 'Chapada Diamantina', col: 4, row: 0, scores: { regulatory: 45, climate: 55, market: 38, logistics: 50 } },
  { id: 3,  name: 'Triângulo MG',       col: 1, row: 1, scores: { regulatory: 38, climate: 42, market: 35, logistics: 40 } },
  { id: 4,  name: 'Cerrado Mineiro',    col: 3, row: 1, scores: { regulatory: 42, climate: 48, market: 30, logistics: 44 } },
  { id: 5,  name: 'Sul ES',             col: 5, row: 1, scores: { regulatory: 35, climate: 40, market: 28, logistics: 38 } },
  { id: 6,  name: 'Norte PR',           col: 1, row: 2, scores: { regulatory: 30, climate: 35, market: 25, logistics: 32 } },
  { id: 7,  name: 'Sul de Minas',       col: 3, row: 2, scores: { regulatory: 40, climate: 44, market: 32, logistics: 42 } },
  { id: 8,  name: 'Zona da Mata',       col: 5, row: 2, scores: { regulatory: 48, climate: 50, market: 42, logistics: 46 } },
  { id: 9,  name: 'Planalto Sul',       col: 0, row: 3, scores: { regulatory: 28, climate: 32, market: 22, logistics: 30 } },
  { id: 10, name: 'Serra Gaúcha',       col: 2, row: 3, scores: { regulatory: 33, climate: 36, market: 28, logistics: 35 } },
  { id: 11, name: 'Mogiana',            col: 4, row: 3, scores: { regulatory: 44, climate: 46, market: 36, logistics: 43 } },
];

const HEX_R = 52;

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

const LAYER_LABELS: Record<Layer, string> = {
  regulatory: 'Regulatório',
  climate:    'Climático',
  market:     'Mercado',
  composite:  'Composto',
};

const DIM_LABELS: Array<{ key: keyof RegionScores; label: string }> = [
  { key: 'regulatory', label: 'Regulatório' },
  { key: 'climate',    label: 'Climático' },
  { key: 'market',     label: 'Mercado' },
  { key: 'logistics',  label: 'Logístico' },
];

const LEGEND_ITEMS = [
  { color: '#34D399', label: 'LOW',   range: '< 30'  },
  { color: '#FBBF24', label: 'MÉDIO', range: '30–69' },
  { color: '#F87171', label: 'ALTO',  range: '≥ 70'  },
];

function getLayerScore(scores: RegionScores, layer: Layer): number {
  if (layer === 'composite') {
    const { regulatory, climate, market, logistics } = scores;
    return Math.round((regulatory + climate + market + logistics) / 4);
  }
  if (layer === 'market')  return scores.market;
  if (layer === 'climate') return scores.climate;
  return scores.regulatory;
}

function getColor(score: number): string {
  if (score >= 70) return '#F87171';
  if (score >= 40) return '#FBBF24';
  return '#34D399';
}

function hexCenterAt(col: number, row: number, r: number, ox: number, oy: number): [number, number] {
  const w  = Math.sqrt(3) * r;
  const cx = ox + col * w + (row % 2) * (w / 2);
  const cy = oy + row * r * 1.5;
  return [cx, cy];
}

function drawHex(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function hitTestAt(mx: number, my: number, r: number, ox: number, oy: number): number {
  let closest = -1;
  let minDist  = Infinity;
  for (const region of REGIONS) {
    const [cx, cy] = hexCenterAt(region.col, region.row, r, ox, oy);
    const dist = Math.hypot(mx - cx, my - cy);
    if (dist < r && dist < minDist) { minDist = dist; closest = region.id; }
  }
  return closest;
}

function wrapText(name: string): [string, string] {
  const parts = name.split(' ');
  if (parts.length <= 2) return [parts[0], parts.slice(1).join(' ')];
  const mid = Math.ceil(parts.length / 2);
  return [parts.slice(0, mid).join(' '), parts.slice(mid).join(' ')];
}

function getVerdict(composite: number): { label: string; color: string } {
  if (composite < 40) return { label: 'GO',      color: '#34D399' };
  if (composite < 70) return { label: 'CAUTION', color: '#FBBF24' };
  return                      { label: 'HOLD',    color: '#F87171' };
}

export default function HexMap({ onAnalyzeRegion }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Shared between draw() and event handlers — avoids stale coords after resize
  const drawParamsRef = useRef({ r: HEX_R, ox: 0, oy: 0 });

  const [layer,           setLayer]           = useState<Layer>('composite');
  const [selected,        setSelected]        = useState<Region | null>(null);
  const [hovered,         setHovered]         = useState<number>(-1);
  const [liveScores,      setLiveScores]      = useState<Record<string, RegionScores>>({});
  const [analyzingRegion, setAnalyzingRegion] = useState<string | null>(null);

  // Animation refs — mutated in RAF, never trigger re-render
  const pulseRef    = useRef(0.65);
  const pulseDirRef = useRef(1);
  const rafRef      = useRef(-1);

  // Always points to the freshest draw closure (avoids stale RAF loop)
  const drawRef = useRef<() => void>(() => {});

  function getRegionScores(region: Region): RegionScores {
    return liveScores[region.name] ?? region.scores;
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // DPR / HD fix via getBoundingClientRect
    const dpr  = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;

    // Dynamic centering
    const r     = HEX_R;
    const w     = Math.sqrt(3) * r;
    const gridW = 5.5 * w;
    const gridH = 3 * r * 1.5;
    const ox    = Math.max(w / 2, (W - gridW) / 2);
    const oy    = Math.max(r,     (H - gridH) / 2);
    drawParamsRef.current = { r, ox, oy };

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    for (const region of REGIONS) {
      const [cx, cy]   = hexCenterAt(region.col, region.row, r, ox, oy);
      const scores     = getRegionScores(region);
      const score      = getLayerScore(scores, layer);
      const color      = getColor(score);
      const isSelected = selected?.id === region.id;
      const isHov      = hovered === region.id;
      const isPulsing  = analyzingRegion === region.name;
      const isLive     = region.name in liveScores;

      const opacityHex = isPulsing
        ? Math.round(pulseRef.current * 255).toString(16).padStart(2, '0')
        : 'CC';

      drawHex(ctx, cx, cy, r - 2);
      ctx.fillStyle = color + opacityHex;
      ctx.fill();

      ctx.strokeStyle = isSelected ? AMBER : isHov ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth   = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      // Region name
      const [line1, line2] = wrapText(region.name);
      ctx.fillStyle    = 'rgba(255,255,255,0.92)';
      ctx.font         = 'bold 11px ui-monospace, Consolas, monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      if (line2) {
        ctx.fillText(line1.toUpperCase(), cx, cy - 16);
        ctx.fillText(line2.toUpperCase(), cx, cy - 4);
      } else {
        ctx.fillText(line1.toUpperCase(), cx, cy - 9);
      }

      // Score number
      ctx.font      = 'bold 17px ui-monospace, Consolas, monospace';
      ctx.fillStyle = '#000000AA';
      ctx.fillText(String(score), cx + 1, cy + 18);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillText(String(score), cx, cy + 17);

      // Live data dot — amber circle, top-right corner
      if (isLive) {
        ctx.beginPath();
        ctx.arc(cx + r * 0.55, cy - r * 0.62, 5, 0, Math.PI * 2);
        ctx.fillStyle   = AMBER;
        ctx.fill();
        ctx.strokeStyle = BG;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      }
    }
  }

  // Keep drawRef fresh every render
  drawRef.current = draw;

  // Redraw on state changes (skipped while RAF animation is running)
  useEffect(() => {
    if (!analyzingRegion) drawRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, selected, hovered, liveScores, analyzingRegion]);

  // Redraw on container resize
  useEffect(() => {
    const observer = new ResizeObserver(() => drawRef.current());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Pulse animation while a region is being analyzed
  useEffect(() => {
    if (!analyzingRegion) return;
    function tick() {
      pulseRef.current += pulseDirRef.current * 0.025;
      if (pulseRef.current >= 0.9) { pulseRef.current = 0.9; pulseDirRef.current = -1; }
      if (pulseRef.current <= 0.4) { pulseRef.current = 0.4; pulseDirRef.current =  1; }
      drawRef.current();
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyzingRegion]);

  // ── Event handlers ────────────────────────────────────────────────────────
  function getLogicalCoords(e: React.MouseEvent<HTMLCanvasElement>): [number, number] {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const [mx, my]       = getLogicalCoords(e);
    const { r, ox, oy } = drawParamsRef.current;
    const idx            = hitTestAt(mx, my, r, ox, oy);
    setSelected(idx >= 0 ? REGIONS[idx] : null);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const [mx, my]       = getLogicalCoords(e);
    const { r, ox, oy } = drawParamsRef.current;
    setHovered(hitTestAt(mx, my, r, ox, oy));
  }

  async function handleAnalyzeClick() {
    if (!selected || !onAnalyzeRegion || analyzingRegion) return;
    setAnalyzingRegion(selected.name);
    try {
      const scores = await onAnalyzeRegion(selected.name);
      setLiveScores(prev => ({ ...prev, [selected.name]: scores }));
    } finally {
      setAnalyzingRegion(null);
    }
  }

  // ── Sidebar derived values ─────────────────────────────────────────────────
  const sidebarScores       = selected ? getRegionScores(selected) : null;
  const composite           = sidebarScores
    ? Math.round((sidebarScores.regulatory + sidebarScores.climate + sidebarScores.market + sidebarScores.logistics) / 4)
    : 0;
  const exportReadiness     = 100 - composite;
  const riskLevel           = selected ? getRiskLevel(composite) : null;
  const verdict             = selected ? getVerdict(composite) : null;
  const isSelectedLive      = selected ? selected.name in liveScores : false;
  const isSelectedAnalyzing = selected ? analyzingRegion === selected.name : false;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: 'calc(100vh - 120px)', background: BG }}
    >
      {/* ── Canvas (fills entire container) ── */}
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(-1)}
        style={{
          position: 'absolute', inset: 0, display: 'block',
          width: '100%', height: '100%',
          cursor: hovered >= 0 ? 'pointer' : 'default',
        }}
      />

      {/* ── Layer toggle — top left ── */}
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 10,
        display: 'flex', gap: 8,
      }}>
        {(Object.keys(LAYER_LABELS) as Layer[]).map(l => (
          <button
            key={l}
            onClick={() => setLayer(l)}
            style={{
              padding: '5px 12px', fontSize: 10, fontWeight: 700, letterSpacing: 1,
              fontFamily: 'ui-monospace, Consolas, monospace',
              border: `1px solid ${layer === l ? AMBER : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 4,
              background: layer === l ? AMBER : 'rgba(11,17,32,0.82)',
              color: layer === l ? '#000' : TEXT_MUTED,
              cursor: 'pointer', textTransform: 'uppercase' as const,
              backdropFilter: 'blur(4px)',
              transition: 'all 0.15s',
            }}
          >
            {LAYER_LABELS[l]}
          </button>
        ))}
      </div>

      {/* ── Sidebar — top right, floating ── */}
      {selected && riskLevel && sidebarScores && verdict && (
        <div style={{
          position: 'absolute', top: 16, right: 16, zIndex: 10,
          width: 260, background: 'rgba(19,28,46,0.92)',
          border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16,
          backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: TEXT,
                fontFamily: 'ui-monospace, Consolas, monospace',
                textTransform: 'uppercase' as const, lineHeight: 1.4,
              }}>{selected.name}</span>
              {isSelectedLive && (
                <span style={{
                  fontSize: 9, color: AMBER,
                  fontFamily: 'ui-monospace, Consolas, monospace', letterSpacing: 0.5,
                }}>● Live</span>
              )}
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{
                background: 'none', border: 'none', color: TEXT_MUTED,
                cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0,
              }}
            >×</button>
          </div>

          {/* Export Readiness + badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{
                fontSize: 9, fontWeight: 600, letterSpacing: 1.8, color: '#475569',
                textTransform: 'uppercase' as const,
                fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 2,
              }}>Export Readiness</div>
              <div style={{
                fontFamily: 'ui-monospace, Consolas, monospace',
                fontSize: 36, fontWeight: 700, color: AMBER, lineHeight: 1,
              }}>{exportReadiness}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
              <span style={{
                fontFamily: 'ui-monospace, Consolas, monospace',
                fontWeight: 700, fontSize: 9, letterSpacing: 1,
                padding: '2px 8px', borderRadius: 3, alignSelf: 'flex-start',
                background: RISK_COLORS[riskLevel].bg, color: RISK_COLORS[riskLevel].text,
              }}>{riskLevel}</span>
              {isSelectedLive && (
                <span style={{
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  fontWeight: 700, fontSize: 9, letterSpacing: 1,
                  padding: '2px 8px', borderRadius: 3, alignSelf: 'flex-start',
                  color: verdict.color, border: `1px solid ${verdict.color}55`,
                }}>{verdict.label}</span>
              )}
            </div>
          </div>

          {/* Dimension bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DIM_LABELS.map(({ key, label }) => {
              const val = sidebarScores[key];
              const col = getColor(val);
              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 600, letterSpacing: 1.2, color: TEXT_MUTED,
                      textTransform: 'uppercase' as const,
                      fontFamily: 'ui-monospace, Consolas, monospace',
                    }}>{label}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: col,
                      fontFamily: 'ui-monospace, Consolas, monospace',
                    }}>{val}</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${val}%`, background: col, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live data attribution */}
          {isSelectedLive && (
            <div style={{
              fontSize: 9, color: AMBER,
              fontFamily: 'ui-monospace, Consolas, monospace', letterSpacing: 0.3,
              borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10,
            }}>
              ● Live data · Open-Meteo + EUDR RAG
            </div>
          )}

          {/* Analyze button */}
          <button
            onClick={handleAnalyzeClick}
            disabled={!!analyzingRegion || !onAnalyzeRegion}
            style={{
              width: '100%',
              padding: '6px 14px',
              marginTop: 10,
              background: (analyzingRegion || !onAnalyzeRegion) ? 'rgba(212,144,10,0.15)' : AMBER,
              color: (analyzingRegion || !onAnalyzeRegion) ? AMBER : '#000',
              border: `1px solid ${AMBER}`,
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              fontFamily: 'ui-monospace, Consolas, monospace',
              textTransform: 'uppercase' as const,
              cursor: (analyzingRegion || !onAnalyzeRegion) ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {isSelectedAnalyzing ? 'ANALYZING...' : 'ANALYZE REGION'}
          </button>
        </div>
      )}

      {/* ── Legend — bottom left ── */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16, zIndex: 10,
        background: 'rgba(11,17,32,0.85)', backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6, padding: '7px 12px',
        display: 'flex', gap: 14, alignItems: 'center',
      }}>
        {LEGEND_ITEMS.map(({ color, label, range }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 10, height: 10, borderRadius: 2,
              background: color + 'CC',
              border: `1px solid ${color}66`,
            }} />
            <span style={{
              fontSize: 9, color: TEXT_MUTED,
              fontFamily: 'ui-monospace, Consolas, monospace', letterSpacing: 0.5,
            }}>{label} {range}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
