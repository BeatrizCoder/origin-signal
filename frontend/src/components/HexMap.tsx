import { useRef, useEffect, useState, useCallback } from 'react';
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

const R = 38;
const OFFSET_X = 52;
const OFFSET_Y = 48;
const CANVAS_W = 580;
const CANVAS_H = 360;

const AMBER = '#D4900A';
const BG = '#0B1120';
const SURFACE = '#131C2E';
const BORDER = '#1E2D45';
const TEXT = '#F1F5F9';
const TEXT_MUTED = '#7A90A8';

function getLayerScore(r: Region, layer: Layer): number {
  if (layer === 'composite') {
    const { regulatory, climate, market, logistics } = r.scores;
    return Math.round((regulatory + climate + market + logistics) / 4);
  }
  if (layer === 'market') return r.scores.market;
  if (layer === 'climate') return r.scores.climate;
  return r.scores.regulatory;
}

function getColor(score: number): string {
  if (score >= 70) return '#F87171';
  if (score >= 40) return '#FBBF24';
  return '#34D399';
}

function hexCenter(col: number, row: number): [number, number] {
  const w = Math.sqrt(3) * R;
  const cx = OFFSET_X + col * w + (row % 2) * (w / 2);
  const cy = OFFSET_Y + row * R * 1.5;
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

function hitTest(mx: number, my: number): number {
  let closest = -1;
  let minDist = Infinity;
  for (const region of REGIONS) {
    const [cx, cy] = hexCenter(region.col, region.row);
    const dist = Math.hypot(mx - cx, my - cy);
    if (dist < R && dist < minDist) {
      minDist = dist;
      closest = region.id;
    }
  }
  return closest;
}

function wrapText(name: string): [string, string] {
  const parts = name.split(' ');
  if (parts.length <= 2) return [parts[0], parts.slice(1).join(' ')];
  const mid = Math.ceil(parts.length / 2);
  return [parts.slice(0, mid).join(' '), parts.slice(mid).join(' ')];
}

const LAYER_LABELS: Record<Layer, string> = {
  regulatory: 'Regulatório',
  climate: 'Climático',
  market: 'Mercado',
  composite: 'Composto',
};

const DIM_LABELS: Array<{ key: keyof RegionScores; label: string }> = [
  { key: 'regulatory', label: 'Regulatório' },
  { key: 'climate',    label: 'Climático' },
  { key: 'market',     label: 'Mercado' },
  { key: 'logistics',  label: 'Logístico' },
];

export default function HexMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layer, setLayer] = useState<Layer>('composite');
  const [selected, setSelected] = useState<Region | null>(null);
  const [hovered, setHovered] = useState<number>(-1);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (const region of REGIONS) {
      const [cx, cy] = hexCenter(region.col, region.row);
      const score = getLayerScore(region, layer);
      const color = getColor(score);
      const isSelected = selected?.id === region.id;
      const isHovered = hovered === region.id;

      drawHex(ctx, cx, cy, R - 2);
      ctx.fillStyle = color + 'CC';
      ctx.fill();

      ctx.strokeStyle = isSelected ? AMBER : isHovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      const [line1, line2] = wrapText(region.name);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `bold 8px ui-monospace, Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (line2) {
        ctx.fillText(line1.toUpperCase(), cx, cy - 12);
        ctx.fillText(line2.toUpperCase(), cx, cy - 3);
      } else {
        ctx.fillText(line1.toUpperCase(), cx, cy - 7);
      }

      ctx.font = `bold 13px ui-monospace, Consolas, monospace`;
      ctx.fillStyle = '#000000AA';
      ctx.fillText(String(score), cx + 1, cy + 12);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillText(String(score), cx, cy + 11);
    }
  }, [layer, selected, hovered]);

  useEffect(() => { draw(); }, [draw]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const idx = hitTest(mx, my);
    setSelected(idx >= 0 ? REGIONS[idx] : null);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    setHovered(hitTest(mx, my));
  }

  const composite = selected
    ? Math.round((selected.scores.regulatory + selected.scores.climate + selected.scores.market + selected.scores.logistics) / 4)
    : 0;
  const exportReadiness = selected ? 100 - composite : 0;
  const riskLevel = selected ? getRiskLevel(composite) : null;

  const RISK_COLORS: Record<string, { bg: string; text: string }> = {
    LOW:    { bg: '#0D3321', text: '#34D399' },
    MEDIUM: { bg: '#2D1F00', text: '#FBBF24' },
    HIGH:   { bg: '#2D0D0D', text: '#F87171' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toggle bar */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(Object.keys(LAYER_LABELS) as Layer[]).map(l => (
          <button
            key={l}
            onClick={() => setLayer(l)}
            style={{
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              fontFamily: 'ui-monospace, Consolas, monospace',
              border: `1px solid ${layer === l ? AMBER : BORDER}`,
              borderRadius: 4,
              background: layer === l ? AMBER : SURFACE,
              color: layer === l ? '#000' : TEXT_MUTED,
              cursor: 'pointer',
              textTransform: 'uppercase' as const,
              transition: 'all 0.15s',
            }}
          >
            {LAYER_LABELS[l]}
          </button>
        ))}
      </div>

      {/* Canvas + Sidebar */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(-1)}
          style={{
            borderRadius: 8,
            border: `1px solid ${BORDER}`,
            cursor: hovered >= 0 ? 'pointer' : 'default',
            width: '100%',
            maxWidth: CANVAS_W,
          }}
        />

        {selected && riskLevel && (
          <div style={{
            width: 220,
            flexShrink: 0,
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.2,
                color: TEXT,
                fontFamily: 'ui-monospace, Consolas, monospace',
                textTransform: 'uppercase' as const,
                lineHeight: 1.4,
              }}>
                {selected.name}
              </span>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: 'none', border: 'none', color: TEXT_MUTED,
                  cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0,
                }}
              >×</button>
            </div>

            {/* Export Readiness */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.8, color: '#475569', textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace', marginBottom: 4 }}>
                Export Readiness
              </div>
              <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 40, fontWeight: 700, color: AMBER, lineHeight: 1 }}>
                {exportReadiness}
              </div>
            </div>

            {/* Risk badge */}
            <span style={{
              fontFamily: 'ui-monospace, Consolas, monospace',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: 1.5,
              padding: '4px 10px',
              borderRadius: 4,
              alignSelf: 'flex-start',
              background: RISK_COLORS[riskLevel].bg,
              color: RISK_COLORS[riskLevel].text,
            }}>
              {riskLevel}
            </span>

            {/* Dimension bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DIM_LABELS.map(({ key, label }) => {
                const val = selected.scores[key];
                const col = getColor(val);
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.2, color: TEXT_MUTED, textTransform: 'uppercase' as const, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                        {label}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: col, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                        {val}
                      </span>
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${val}%`, background: col, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
