import { useRef, useEffect, useState } from 'react';
import { getRiskLevel } from '../types';
import type { PropagationData } from '../types';
import { useLanguage } from '../context/LanguageContext';
import type { TranslationKey } from '../i18n/translations';
import { COLORS } from '../theme';

type Layer = 'regulatory' | 'climate' | 'market' | 'composite' | 'propagation';
type TradeDirection = 'export' | 'import';

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
  flag?: string;
}

interface Props {
  onAnalyzeRegion?: (regionName: string) => Promise<RegionScores>;
  commodity?: string;
  tradeDirection?: TradeDirection;
  propagationData?: PropagationData;
}

const COFFEE_REGIONS: Region[] = [
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

const SOYBEAN_REGIONS: Region[] = [
  { id: 0, name: 'Mato Grosso',        col: 2, row: 2, scores: { regulatory: 72, climate: 65, market: 55, logistics: 48 } },
  { id: 1, name: 'Mato Grosso do Sul', col: 3, row: 3, scores: { regulatory: 58, climate: 50, market: 52, logistics: 42 } },
  { id: 2, name: 'Paraná',             col: 3, row: 5, scores: { regulatory: 35, climate: 38, market: 60, logistics: 28 } },
  { id: 3, name: 'Rio Grande do Sul',  col: 2, row: 6, scores: { regulatory: 28, climate: 45, market: 55, logistics: 22 } },
  { id: 4, name: 'Goiás',              col: 4, row: 3, scores: { regulatory: 62, climate: 70, market: 48, logistics: 35 } },
  { id: 5, name: 'Bahia Oeste',        col: 5, row: 1, scores: { regulatory: 78, climate: 82, market: 42, logistics: 58 } },
  { id: 6, name: 'Maranhão',           col: 6, row: 1, scores: { regulatory: 85, climate: 60, market: 38, logistics: 65 } },
  { id: 7, name: 'Piauí',              col: 6, row: 2, scores: { regulatory: 80, climate: 58, market: 35, logistics: 62 } },
  { id: 8, name: 'Tocantins',          col: 5, row: 2, scores: { regulatory: 75, climate: 62, market: 40, logistics: 55 } },
];

const FRUITS_REGIONS: Region[] = [
  { id: 0, name: 'São Paulo',             col: 4, row: 4, scores: { regulatory: 42, climate: 35, market: 68, logistics: 22 } },
  { id: 1, name: 'Vale do São Francisco', col: 5, row: 2, scores: { regulatory: 55, climate: 75, market: 58, logistics: 45 } },
  { id: 2, name: 'Santa Catarina',        col: 3, row: 6, scores: { regulatory: 25, climate: 28, market: 62, logistics: 18 } },
  { id: 3, name: 'Espírito Santo',        col: 6, row: 3, scores: { regulatory: 48, climate: 40, market: 55, logistics: 38 } },
  { id: 4, name: 'Bahia',                 col: 5, row: 3, scores: { regulatory: 65, climate: 72, market: 45, logistics: 52 } },
  { id: 5, name: 'Rio Grande do Norte',   col: 6, row: 1, scores: { regulatory: 50, climate: 68, market: 42, logistics: 48 } },
];

const IMPORT_ORIGINS_MAP: Region[] = [
  { id: 0,  name: 'Argentina',      col: 2, row: 5, scores: { regulatory: 25, climate: 35, market: 45, logistics: 15 }, flag: '🇦🇷' },
  { id: 1,  name: 'Uruguay',        col: 2, row: 6, scores: { regulatory: 20, climate: 30, market: 48, logistics: 12 }, flag: '🇺🇾' },
  { id: 2,  name: 'Paraguay',       col: 3, row: 5, scores: { regulatory: 22, climate: 32, market: 42, logistics: 14 }, flag: '🇵🇾' },
  { id: 3,  name: 'Colombia',       col: 3, row: 3, scores: { regulatory: 45, climate: 55, market: 52, logistics: 32 }, flag: '🇨🇴' },
  { id: 4,  name: 'Peru',           col: 4, row: 4, scores: { regulatory: 48, climate: 58, market: 50, logistics: 38 }, flag: '🇵🇪' },
  { id: 5,  name: 'Chile',          col: 3, row: 4, scores: { regulatory: 30, climate: 40, market: 55, logistics: 25 }, flag: '🇨🇱' },
  { id: 6,  name: 'United States',  col: 1, row: 2, scores: { regulatory: 62, climate: 58, market: 50, logistics: 42 }, flag: '🇺🇸' },
  { id: 7,  name: 'China',          col: 7, row: 2, scores: { regulatory: 75, climate: 65, market: 55, logistics: 68 }, flag: '🇨🇳' },
  { id: 8,  name: 'European Union', col: 5, row: 1, scores: { regulatory: 35, climate: 42, market: 48, logistics: 35 }, flag: '🇪🇺' },
  { id: 9,  name: 'Norway',         col: 5, row: 0, scores: { regulatory: 26, climate: 32, market: 46, logistics: 30 }, flag: '🇳🇴' },
  { id: 10, name: 'Switzerland',    col: 5, row: 2, scores: { regulatory: 24, climate: 30, market: 48, logistics: 26 }, flag: '🇨🇭' },
  { id: 11, name: 'United Kingdom', col: 6, row: 1, scores: { regulatory: 34, climate: 36, market: 54, logistics: 34 }, flag: '🇬🇧' },
  { id: 12, name: 'Vietnam',        col: 7, row: 3, scores: { regulatory: 58, climate: 62, market: 48, logistics: 55 }, flag: '🇻🇳' },
  { id: 13, name: 'Ethiopia',       col: 4, row: 1, scores: { regulatory: 68, climate: 70, market: 40, logistics: 62 }, flag: '🇪🇹' },
];

const COUNTRY_KEY: Record<string, TranslationKey> = {
  'Argentina':      'country_argentina',
  'Uruguay':        'country_uruguay',
  'Paraguay':       'country_paraguay',
  'Colombia':       'country_colombia',
  'Peru':           'country_peru',
  'Chile':          'country_chile',
  'United States':  'country_united_states',
  'China':          'country_china',
  'European Union': 'country_european_union',
  'Norway':         'country_norway',
  'Switzerland':    'country_switzerland',
  'United Kingdom': 'country_united_kingdom',
  'Vietnam':        'country_vietnam',
  'Ethiopia':       'country_ethiopia',
};

const HEX_R = 48;
const SIDEBAR_W = 280;

const AMBER      = COLORS.amberBright;
const ORANGE     = COLORS.bronze;
const BG         = COLORS.bg;
const SIDEBAR_BG = COLORS.panelSoft;
const BORDER_CSS = COLORS.line;
const BORDER     = '#26364F';
const TEXT       = COLORS.textPrimary;
const TEXT_MUTED = COLORS.textSecondary;

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  LOW:    { bg: 'rgba(15,118,110,0.16)',  text: COLORS.petroleo },
  MEDIUM: { bg: 'rgba(245,158,11,0.16)',  text: COLORS.amberBright },
  HIGH:   { bg: 'rgba(220,38,38,0.16)',   text: COLORS.danger },
};

const LEGEND_ITEMS = [
  { color: COLORS.petroleo,    label: 'LOW',    range: '< 30'  },
  { color: COLORS.amberBright, label: 'MEDIUM', range: '30–69' },
  { color: COLORS.danger,      label: 'HIGH',   range: '≥ 70'  },
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
  if (score >= 70) return COLORS.danger;
  if (score >= 40) return COLORS.amberBright;
  return COLORS.petroleo;
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

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, r: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  // stop short of both hex edges so the line doesn't run into the fills
  const startX = x1 + Math.cos(angle) * r * 0.7;
  const startY = y1 + Math.sin(angle) * r * 0.7;
  const endX   = x2 - Math.cos(angle) * r * 0.7;
  const endY   = y2 - Math.sin(angle) * r * 0.7;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = `${ORANGE}AA`;
  ctx.lineWidth   = 2;
  ctx.stroke();

  const headLen = 8;
  const headAngle = Math.PI / 7;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - headLen * Math.cos(angle - headAngle), endY - headLen * Math.sin(angle - headAngle));
  ctx.lineTo(endX - headLen * Math.cos(angle + headAngle), endY - headLen * Math.sin(angle + headAngle));
  ctx.closePath();
  ctx.fillStyle = `${ORANGE}CC`;
  ctx.fill();
}

function hitTestAt(mx: number, my: number, r: number, ox: number, oy: number, regions: Region[]): number {
  let closest = -1;
  let minDist  = Infinity;
  for (const region of regions) {
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
  if (composite < 40) return { label: 'GO',      color: COLORS.petroleo };
  if (composite < 70) return { label: 'CAUTION', color: COLORS.amberBright };
  return                      { label: 'HOLD',    color: COLORS.danger };
}

export default function HexMap({ onAnalyzeRegion, commodity, tradeDirection = 'export', propagationData }: Props) {
  const isImport = tradeDirection === 'import';
  const activeRegions = isImport
    ? IMPORT_ORIGINS_MAP
    : commodity === 'soybeans' ? SOYBEAN_REGIONS
    : commodity === 'fruits'   ? FRUITS_REGIONS
    : COFFEE_REGIONS;
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawParamsRef = useRef({ r: HEX_R, ox: 0, oy: 0 });

  const [layer,           setLayer]           = useState<Layer>('composite');
  const [selected,        setSelected]        = useState<Region | null>(null);
  const [hovered,         setHovered]         = useState<number>(-1);
  const [liveScores,      setLiveScores]      = useState<Record<string, RegionScores>>({});
  const [analyzingRegion, setAnalyzingRegion] = useState<string | null>(null);

  const { t, language } = useLanguage();

  const pulseRef    = useRef(0.65);
  const pulseDirRef = useRef(1);
  const rafRef      = useRef(-1);
  const drawRef     = useRef<() => void>(() => {});

  function getRegionScores(region: Region): RegionScores {
    return liveScores[region.name] ?? region.scores;
  }

  // reset selected when commodity or trade direction changes
  useEffect(() => { setSelected(null); setLiveScores({}); }, [commodity, tradeDirection]);

  const LAYER_LABELS: Record<Layer, string> = {
    regulatory:  t('regulatory'),
    climate:     t('climate'),
    market:      t('market'),
    composite:   'Composite',
    propagation: 'Propagation',
  };

  const visibleLayers: Layer[] = propagationData
    ? ['regulatory', 'climate', 'market', 'composite', 'propagation']
    : ['regulatory', 'climate', 'market', 'composite'];

  const DIM_LABELS: Array<{ key: keyof RegionScores; label: string }> = [
    { key: 'regulatory', label: t('regulatory') },
    { key: 'climate',    label: t('climate') },
    { key: 'market',     label: t('market') },
    { key: 'logistics',  label: t('logistics') },
  ];

  // ── Draw ──────────────────────────────────────────────────────────────────
  function draw() {
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

    const r      = HEX_R;
    const w      = Math.sqrt(3) * r;
    const maxCol = Math.max(...activeRegions.map(reg => reg.col));
    const maxRow = Math.max(...activeRegions.map(reg => reg.row));
    const gridW  = (maxCol + 1.5) * w;
    const gridH  = maxRow * r * 1.5 + 2 * r;
    const ox     = Math.max(w / 2, (W - gridW) / 2);
    const oy     = Math.max(r,     (H - gridH) / 2);
    drawParamsRef.current = { r, ox, oy };

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    for (const region of activeRegions) {
      const [cx, cy]   = hexCenterAt(region.col, region.row, r, ox, oy);
      const scores     = getRegionScores(region);
      const propRegion = propagationData?.region_scores[region.name];
      const score      = layer === 'propagation' && propRegion ? propRegion.composite : getLayerScore(scores, layer);
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

      const displayName = region.flag && COUNTRY_KEY[region.name]
        ? t(COUNTRY_KEY[region.name])
        : region.name;
      const [line1, line2] = wrapText(displayName);
      ctx.fillStyle    = 'rgba(255,255,255,0.92)';
      ctx.font         = 'bold 10px Manrope, "IBM Plex Sans", sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      if (region.flag) {
        ctx.font = '13px sans-serif';
        ctx.fillText(region.flag, cx, cy - (line2 ? 26 : 20));
        ctx.font = 'bold 10px Manrope, "IBM Plex Sans", sans-serif';
      }

      if (line2) {
        ctx.fillText(line1.toUpperCase(), cx, cy - 14);
        ctx.fillText(line2.toUpperCase(), cx, cy - 3);
      } else {
        ctx.fillText(line1.toUpperCase(), cx, cy - 8);
      }

      ctx.font      = 'bold 16px Manrope, "IBM Plex Sans", sans-serif';
      ctx.fillStyle = '#000000AA';
      ctx.fillText(String(score), cx + 1, cy + 16);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillText(String(score), cx, cy + 15);

      if (isLive) {
        ctx.beginPath();
        ctx.arc(cx + r * 0.55, cy - r * 0.62, 5, 0, Math.PI * 2);
        ctx.fillStyle   = AMBER;
        ctx.fill();
        ctx.strokeStyle = BG;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      }

      if (propRegion?.propagation_alert) {
        ctx.beginPath();
        ctx.arc(cx - r * 0.55, cy - r * 0.62, 5, 0, Math.PI * 2);
        ctx.fillStyle   = ORANGE;
        ctx.fill();
        ctx.strokeStyle = BG;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      }
    }

    if (layer === 'propagation' && propagationData) {
      for (const region of activeRegions) {
        const propRegion = propagationData.region_scores[region.name];
        if (!propRegion?.propagation_alert) continue;
        const [tx, ty] = hexCenterAt(region.col, region.row, r, ox, oy);
        for (const sourceName of propRegion.risk_sources) {
          const source = activeRegions.find(reg => reg.name === sourceName);
          if (!source) continue;
          const [sx, sy] = hexCenterAt(source.col, source.row, r, ox, oy);
          drawArrow(ctx, sx, sy, tx, ty, r);
        }
      }
    }
  }

  drawRef.current = draw;

  useEffect(() => {
    if (!analyzingRegion) drawRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, selected, hovered, liveScores, analyzingRegion, commodity, tradeDirection, language, propagationData]);

  useEffect(() => {
    const observer = new ResizeObserver(() => drawRef.current());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

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
    const idx            = hitTestAt(mx, my, r, ox, oy, activeRegions);
    setSelected(idx >= 0 ? activeRegions[idx] : null);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const [mx, my]       = getLogicalCoords(e);
    const { r, ox, oy } = drawParamsRef.current;
    setHovered(hitTestAt(mx, my, r, ox, oy, activeRegions));
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

  // ── Sidebar derived values ────────────────────────────────────────────────
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
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 120px)',
        background: BG,
        display: 'flex',
      }}
    >
      {/* ── Canvas area — takes all space except sidebar ── */}
      <div style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden' }}>
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

        {/* Layer toggle — top left of canvas area */}
        <div style={{
          position: 'absolute', top: 16, left: 16, zIndex: 10,
          display: 'flex', gap: 8,
        }}>
          {visibleLayers.map(l => (
            <button
              key={l}
              onClick={() => setLayer(l)}
              style={{
                padding: '5px 12px', fontSize: 10, fontWeight: 700, letterSpacing: 1,
                fontFamily: 'Manrope, "IBM Plex Sans", sans-serif',
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

        {/* Legend — bottom left of canvas area */}
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
                fontFamily: 'Manrope, "IBM Plex Sans", sans-serif', letterSpacing: 0.5,
              }}>{label} {range}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sidebar panel — fixed width, always visible ── */}
      <div style={{
        width: SIDEBAR_W,
        flexShrink: 0,
        height: '100%',
        background: SIDEBAR_BG,
        borderLeft: `1px solid ${BORDER_CSS}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {selected && riskLevel && sidebarScores && verdict ? (
          /* ── Selected region content ── */
          <div style={{
            flex: 1, overflowY: 'auto', padding: 20,
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED,
                  fontFamily: 'Manrope, "IBM Plex Sans", sans-serif',
                  textTransform: 'uppercase' as const,
                }}>{t('selected_cell')}</span>
                <span style={{
                  fontSize: 13, fontWeight: 700, letterSpacing: 0.8, color: TEXT,
                  fontFamily: 'Manrope, "IBM Plex Sans", sans-serif',
                  textTransform: 'uppercase' as const, lineHeight: 1.4,
                }}>{selected.name}</span>
                {isSelectedLive && (
                  <span style={{
                    fontSize: 9, color: AMBER,
                    fontFamily: 'Manrope, "IBM Plex Sans", sans-serif', letterSpacing: 0.5,
                  }}>● Live</span>
                )}
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: 'none', border: 'none', color: TEXT_MUTED,
                  cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0,
                }}
              >×</button>
            </div>

            {/* Export Readiness + badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 600, letterSpacing: 1.5, color: TEXT_MUTED,
                  textTransform: 'uppercase' as const,
                  fontFamily: 'Manrope, "IBM Plex Sans", sans-serif', marginBottom: 2,
                }}>{isImport ? 'SUPPLY RELIABILITY' : t('export_readiness')}</div>
                <div style={{
                  fontFamily: 'Manrope, "IBM Plex Sans", sans-serif',
                  fontSize: 40, fontWeight: 700, color: AMBER, lineHeight: 1,
                }}>{exportReadiness}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                <span style={{
                  fontFamily: 'Manrope, "IBM Plex Sans", sans-serif',
                  fontWeight: 700, fontSize: 9, letterSpacing: 1,
                  padding: '2px 8px', borderRadius: 3, alignSelf: 'flex-start',
                  background: RISK_COLORS[riskLevel].bg, color: RISK_COLORS[riskLevel].text,
                }}>{riskLevel}</span>
                {isSelectedLive && (
                  <span style={{
                    fontFamily: 'Manrope, "IBM Plex Sans", sans-serif',
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
                        fontFamily: 'Manrope, "IBM Plex Sans", sans-serif',
                      }}>{label}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: col,
                        fontFamily: 'Manrope, "IBM Plex Sans", sans-serif',
                      }}>{val}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${val}%`, background: col, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Propagation alert */}
            {selected && propagationData?.region_scores[selected.name]?.propagation_alert && (
              <div style={{
                background: `${ORANGE}1A`, border: `1px solid ${ORANGE}44`,
                borderRadius: 6, padding: '10px 12px',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: ORANGE,
                  textTransform: 'uppercase' as const,
                  fontFamily: 'Manrope, "IBM Plex Sans", sans-serif',
                }}>⤳ PROPAGATION ALERT</span>
                <span style={{ fontSize: 11, color: TEXT, lineHeight: 1.5 }}>
                  {t('propagated_from')}: {propagationData.region_scores[selected.name]!.risk_sources.join(', ')}
                </span>
              </div>
            )}

            {/* Live data attribution */}
            {isSelectedLive && (
              <div style={{
                fontSize: 9, color: AMBER,
                fontFamily: 'Manrope, "IBM Plex Sans", sans-serif', letterSpacing: 0.3,
                borderTop: `1px solid ${BORDER_CSS}`, paddingTop: 10,
              }}>
                {t('live_data')}
              </div>
            )}

            {/* Analyze button */}
            <button
              onClick={handleAnalyzeClick}
              disabled={!!analyzingRegion || !onAnalyzeRegion}
              style={{
                width: '100%',
                padding: '8px 14px',
                marginTop: 4,
                background: (analyzingRegion || !onAnalyzeRegion) ? 'rgba(212,144,10,0.15)' : AMBER,
                color: (analyzingRegion || !onAnalyzeRegion) ? AMBER : '#000',
                border: `1px solid ${AMBER}`,
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                fontFamily: 'Manrope, "IBM Plex Sans", sans-serif',
                textTransform: 'uppercase' as const,
                cursor: (analyzingRegion || !onAnalyzeRegion) ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {isSelectedAnalyzing ? 'ANALYZING...' : t('analyze_region')}
            </button>
          </div>
        ) : (
          /* ── Placeholder when no region selected ── */
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: `1px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: TEXT_MUTED, fontSize: 18,
            }}>⬡</div>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: TEXT_MUTED,
              fontFamily: 'Manrope, "IBM Plex Sans", sans-serif', textAlign: 'center',
              textTransform: 'uppercase' as const,
            }}>
              Select a region<br />to view details
            </div>
            <div style={{
              fontSize: 9, color: BORDER, fontFamily: 'Manrope, "IBM Plex Sans", sans-serif',
              textAlign: 'center', lineHeight: 1.8,
            }}>
              {isImport
                ? <>{IMPORT_ORIGINS_MAP.length} import origin countries<br />with EUDR risk scoring</>
                : commodity === 'soybeans'
                ? <>{SOYBEAN_REGIONS.length} BR soybean regions<br />with EUDR risk scoring</>
                : commodity === 'fruits'
                ? <>{FRUITS_REGIONS.length} BR fruit regions<br />with EUDR risk scoring</>
                : <>{COFFEE_REGIONS.length} BR coffee regions<br />with EUDR risk scoring</>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
