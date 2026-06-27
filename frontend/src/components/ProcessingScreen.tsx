import { useEffect, useState } from 'react';

const AMBER    = '#D4900A';
const BG       = '#0B1120';
const TEXT     = '#F1F5F9';
const TEXT_MUTED = '#7A90A8';

const ENGINES = [
  'Climate Engine',
  'Regulatory Engine',
  'Market Engine',
  'Logistics Engine',
  'Honeycomb Intelligence',
  'AI Decision Engine',
];

const TOTAL_MS   = 4000;
const ENGINE_GAP = 600;

interface Props {
  error: string | null;
  onRetry: () => void;
}

export default function ProcessingScreen({ error, onRetry }: Props) {
  const [engineCount, setEngineCount] = useState(0);
  const [progress,    setProgress]    = useState(0);

  useEffect(() => {
    const step = 100 / (TOTAL_MS / 40);
    const progressInterval = setInterval(() => {
      setProgress(p => {
        const next = p + step;
        if (next >= 100) { clearInterval(progressInterval); return 100; }
        return next;
      });
    }, 40);

    const timers = ENGINES.map((_, i) =>
      setTimeout(() => setEngineCount(c => Math.min(c + 1, ENGINES.length)), (i + 1) * ENGINE_GAP)
    );

    return () => {
      clearInterval(progressInterval);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: BG, color: TEXT,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 24px',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 52 }}>
        <span style={{
          background: AMBER, color: '#000',
          fontFamily: 'ui-monospace, Consolas, monospace',
          fontWeight: 700, fontSize: 14, letterSpacing: 1,
          padding: '6px 10px', borderRadius: 4,
        }}>OS</span>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 3, color: TEXT }}>
          ORIGINSIGNAL
        </span>
      </div>

      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Title */}
        <div style={{
          fontSize: 12, fontWeight: 600, letterSpacing: 2,
          color: TEXT_MUTED, fontFamily: 'ui-monospace, Consolas, monospace',
          marginBottom: 32, textTransform: 'uppercase' as const,
        }}>
          Initializing Intelligence Engines...
        </div>

        {/* Engine list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 44 }}>
          {ENGINES.map((engine, i) => {
            const done = i < engineCount;
            return (
              <div
                key={engine}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  opacity: done ? 1 : 0.18,
                  transition: 'opacity 0.5s ease',
                }}
              >
                <span style={{
                  color: done ? AMBER : TEXT_MUTED,
                  fontSize: 14, fontWeight: 700,
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  flexShrink: 0, width: 16, textAlign: 'center' as const,
                }}>
                  {done ? '✓' : '○'}
                </span>
                <span style={{
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  fontSize: 13, letterSpacing: 0.5,
                  color: done ? TEXT : TEXT_MUTED,
                }}>
                  {engine}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div style={{
          height: 2, background: 'rgba(255,255,255,0.06)',
          borderRadius: 2, overflow: 'hidden', marginBottom: 8,
        }}>
          <div style={{
            height: '100%',
            width: `${Math.round(progress)}%`,
            background: AMBER,
            borderRadius: 2,
            transition: 'width 0.04s linear',
          }} />
        </div>
        <div style={{
          fontFamily: 'ui-monospace, Consolas, monospace',
          fontSize: 10, color: TEXT_MUTED,
          textAlign: 'right' as const,
        }}>
          {Math.round(progress)}%
        </div>

        {/* Error state */}
        {error && (
          <div style={{
            marginTop: 36,
            background: '#1A0808', border: '1px solid #5C1A1A',
            borderRadius: 6, padding: 16,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ color: '#F87171', fontSize: 13, lineHeight: 1.6 }}>
              ⚠ {error}
            </div>
            <button
              onClick={onRetry}
              style={{
                alignSelf: 'flex-start',
                background: 'none', border: '1px solid #5C1A1A',
                borderRadius: 4, color: '#F87171',
                padding: '6px 14px', cursor: 'pointer',
                fontSize: 11, fontFamily: 'ui-monospace, Consolas, monospace',
                letterSpacing: 1, textTransform: 'uppercase' as const,
              }}
            >
              ← TRY AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
