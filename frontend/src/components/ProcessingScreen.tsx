import { useEffect, useRef, useState } from 'react';
import type { AnalyzeResponse } from '../types';
import { useLanguage } from '../context/LanguageContext';
import Logo from './ui/Logo';
import PipelineStrip from './ui/PipelineStrip';
import { COLORS, FONT } from '../theme';

const ENGINE_STEPS = [
  { id: 'climate',    icon: '🌦', label: 'Climate Intelligence' },
  { id: 'regulatory', icon: '⚖',  label: 'Regulatory Intelligence' },
  { id: 'market',     icon: '📈', label: 'Market Intelligence' },
  { id: 'logistics',  icon: '🚢', label: 'Logistics Intelligence' },
  { id: 'honeycomb',  icon: '🐝', label: 'Honeycomb Intelligence' },
  { id: 'executive',  icon: '🧠', label: 'AI Decision Engine' },
];

const TOTAL_MS   = 4000;
const ENGINE_GAP = 600;

const STATUS_MESSAGES = [
  { at: 0,    en: "Connecting to intelligence sources...",     pt: "Conectando às fontes de inteligência..." },
  { at: 600,  en: "Fetching real-time climate data...",        pt: "Buscando dados climáticos em tempo real..." },
  { at: 1200, en: "Scanning EUDR regulatory database...",      pt: "Verificando base regulatória EUDR..." },
  { at: 1800, en: "Analyzing global market signals...",        pt: "Analisando sinais de mercado global..." },
  { at: 2400, en: "Calculating logistics risk...",             pt: "Calculando risco logístico..." },
  { at: 3000, en: "Running Honeycomb algorithms...",           pt: "Executando algoritmos Honeycomb..." },
  { at: 3600, en: "Synthesizing executive intelligence...",    pt: "Sintetizando inteligência executiva..." },
  { at: 4200, en: "Your analysis will be ready in moments.",   pt: "Sua análise estará disponível em instantes." },
];

interface Props {
  result: AnalyzeResponse | null;
  error: string | null;
  onComplete: () => void;
  onRetry: () => void;
}

export default function ProcessingScreen({ result, error, onComplete, onRetry }: Props) {
  const [engineCount, setEngineCount] = useState(0);
  const [progress,    setProgress]    = useState(0);
  const [animDone,    setAnimDone]    = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const calledComplete                = useRef(false);
  const { t, language } = useLanguage();

  useEffect(() => {
    const step = 100 / (TOTAL_MS / 40);
    const progressInterval = setInterval(() => {
      setProgress(p => {
        const next = p + step;
        if (next >= 100) { clearInterval(progressInterval); return 100; }
        return next;
      });
    }, 40);

    const timers = ENGINE_STEPS.map((_, i) =>
      setTimeout(() => setEngineCount(c => Math.min(c + 1, ENGINE_STEPS.length)), (i + 1) * ENGINE_GAP)
    );

    const statusTimers = STATUS_MESSAGES.map((msg, i) =>
      setTimeout(() => setStatusIndex(i), msg.at)
    );

    const completionTimer = setTimeout(() => setAnimDone(true), TOTAL_MS);

    return () => {
      clearInterval(progressInterval);
      timers.forEach(clearTimeout);
      statusTimers.forEach(clearTimeout);
      clearTimeout(completionTimer);
    };
  }, []);

  useEffect(() => {
    if (animDone && result && !error && !calledComplete.current) {
      calledComplete.current = true;
      onComplete();
    }
  }, [animDone, result, error, onComplete]);

  return (
    <div style={{
      minHeight: '100vh', color: COLORS.textPrimary,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 24px',
    }}>
      <div style={{ marginBottom: 52 }}>
        <Logo size="sm" stacked={false} />
      </div>

      <div style={{ width: '100%', maxWidth: 460 }}>
        {/* Title */}
        <div style={{
          fontSize: 12, fontWeight: 600, letterSpacing: 2,
          color: COLORS.textSecondary, fontFamily: FONT,
          marginBottom: 8, textTransform: 'uppercase' as const, textAlign: 'center' as const,
        }}>
          {t('initializing')}
        </div>

        {/* Status message */}
        <div
          key={statusIndex}
          style={{
            fontSize: 11, color: COLORS.amberBright, fontFamily: FONT,
            marginBottom: 24, textAlign: 'center' as const,
            animation: 'os-status-fade 300ms ease',
          }}
        >
          {language === 'PT' ? STATUS_MESSAGES[statusIndex].pt : STATUS_MESSAGES[statusIndex].en}
        </div>
        <style>{`
          @keyframes os-status-fade {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>

        {/* Pipeline strip */}
        <div style={{ marginBottom: 40 }}>
          <PipelineStrip steps={ENGINE_STEPS} activeCount={engineCount} />
        </div>

        {/* Progress bar */}
        <div style={{
          height: 2, background: 'rgba(245,243,238,0.06)',
          borderRadius: 2, overflow: 'hidden', marginBottom: 8,
        }}>
          <div style={{
            height: '100%',
            width: `${Math.round(progress)}%`,
            background: COLORS.amberBright,
            borderRadius: 2,
            transition: 'width 0.04s linear',
          }} />
        </div>
        <div style={{
          fontFamily: FONT,
          fontSize: 10, color: COLORS.textSecondary,
          textAlign: 'right' as const,
        }}>
          {Math.round(progress)}%
        </div>

        {/* Error state */}
        {error && (
          <div style={{
            marginTop: 36,
            background: 'rgba(220,38,38,0.08)', border: `1px solid ${COLORS.danger}55`,
            borderRadius: 8, padding: 16,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ color: '#F87171', fontSize: 13, lineHeight: 1.6, fontFamily: FONT }}>
              <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />
              {error}
            </div>
            <button
              onClick={onRetry}
              style={{
                alignSelf: 'flex-start',
                background: 'none', border: `1px solid ${COLORS.danger}55`,
                borderRadius: 6, color: '#F87171',
                padding: '6px 14px', cursor: 'pointer',
                fontSize: 11, fontFamily: FONT,
                letterSpacing: 1, textTransform: 'uppercase' as const,
              }}
            >
              <i className="fas fa-arrow-left" style={{ marginRight: 6 }} /> Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
