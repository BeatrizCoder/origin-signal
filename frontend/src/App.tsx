import { useState } from 'react';
import { analyzeRoute } from './services/api';
import type { AnalyzeResponse } from './types';
import { getRiskLevel } from './types';
import HexMap from './components/HexMap';

type Tab = 'analysis' | 'map';

const AMBER = '#D4900A';
const BG = '#0B1120';
const SURFACE = '#131C2E';
const BORDER = '#1E2D45';
const TEXT = '#F1F5F9';
const TEXT_MUTED = '#7A90A8';

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  LOW:    { bg: '#0D3321', text: '#34D399' },
  MEDIUM: { bg: '#2D1F00', text: '#FBBF24' },
  HIGH:   { bg: '#2D0D0D', text: '#F87171' },
};

function getDimColor(value: number): string {
  if (value >= 70) return '#F87171';
  if (value >= 40) return '#FBBF24';
  return '#34D399';
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100vh',
    background: BG,
    color: TEXT,
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 16px 48px',
  },
  header: {
    width: '100%',
    maxWidth: 720,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '32px 0 28px',
    borderBottom: `1px solid ${BORDER}`,
    marginBottom: 36,
  },
  logoBadge: {
    background: AMBER,
    color: '#000',
    fontFamily: 'ui-monospace, Consolas, monospace',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 1,
    padding: '6px 10px',
    borderRadius: 4,
    flexShrink: 0,
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 2,
    color: TEXT,
  },
  headerSubtitle: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: TEXT_MUTED,
    fontFamily: 'ui-monospace, Consolas, monospace',
  },
  main: {
    width: '100%',
    maxWidth: 720,
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1.2,
    color: TEXT_MUTED,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
  },
  textarea: {
    width: '100%',
    minHeight: 96,
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    color: TEXT,
    fontSize: 14,
    padding: '10px 12px',
    resize: 'vertical' as const,
    outline: 'none',
    boxSizing: 'border-box' as const,
    fontFamily: 'system-ui, sans-serif',
  },
  select: {
    width: '100%',
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    color: TEXT,
    fontSize: 14,
    padding: '10px 12px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    cursor: 'pointer',
  },
  readonlyField: {
    width: '100%',
    background: '#0D1525',
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    color: TEXT_MUTED,
    fontSize: 14,
    padding: '10px 12px',
    boxSizing: 'border-box' as const,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  button: {
    width: '100%',
    padding: '12px 0',
    background: AMBER,
    color: '#000',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 1.5,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    transition: 'opacity 0.15s',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  resultCard: {
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  scoreRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 1.8,
    color: '#475569',
    textTransform: 'uppercase' as const,
    marginBottom: 4,
    fontFamily: 'ui-monospace, Consolas, monospace',
  },
  scoreValue: {
    fontFamily: 'ui-monospace, Consolas, monospace',
    fontSize: 48,
    fontWeight: 700,
    color: AMBER,
    lineHeight: 1,
  },
  dimGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },
  dimCard: {
    background: BG,
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 6,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  dimLabel: {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 1.5,
    color: '#475569',
    textTransform: 'uppercase' as const,
    fontFamily: 'ui-monospace, Consolas, monospace',
  },
  dimValue: {
    fontFamily: 'ui-monospace, Consolas, monospace',
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1,
  },
  dimBarTrack: {
    height: 3,
    borderRadius: 2,
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden' as const,
  },
  riskBadge: {
    fontFamily: 'ui-monospace, Consolas, monospace',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 1.5,
    padding: '4px 10px',
    borderRadius: 4,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1.2,
    color: TEXT_MUTED,
    textTransform: 'uppercase' as const,
    borderBottom: `1px solid ${BORDER}`,
    paddingBottom: 6,
  },
  listItem: {
    fontSize: 14,
    color: TEXT,
    paddingLeft: 16,
    position: 'relative' as const,
    lineHeight: 1.6,
  },
  monoItem: {
    fontFamily: 'ui-monospace, Consolas, monospace',
    fontSize: 12,
    color: TEXT_MUTED,
  },
  errorBox: {
    background: '#2D0D0D',
    border: '1px solid #5C1A1A',
    borderRadius: 6,
    padding: '12px 16px',
    color: '#F87171',
    fontSize: 14,
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('analysis');
  const [query, setQuery] = useState('');
  const [commodity, setCommodity] = useState('coffee');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await analyzeRoute({
        query: query.trim(),
        commodity,
        origin: 'Brazil',
        destination: 'European Union',
      });
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const riskLevel = result ? getRiskLevel(result.risk_score) : null;
  const riskColor = riskLevel ? RISK_COLORS[riskLevel] : null;

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <span style={styles.logoBadge}>OS</span>
        <div style={styles.headerText}>
          <span style={styles.headerTitle}>ORIGINSIGNAL</span>
          <span style={styles.headerSubtitle}>TRADE RISK INTELLIGENCE · BR→EU</span>
        </div>
      </header>

      {/* Tab bar */}
      <div style={{ width: '100%', maxWidth: 720, display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`, marginBottom: 28 }}>
        {(['analysis', 'map'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              fontFamily: 'ui-monospace, Consolas, monospace',
              textTransform: 'uppercase' as const,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? `2px solid ${AMBER}` : '2px solid transparent',
              color: activeTab === tab ? TEXT : TEXT_MUTED,
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'color 0.15s',
            }}
          >
            {tab === 'analysis' ? 'Analysis' : 'Map'}
          </button>
        ))}
      </div>

      <main style={{ ...styles.main, maxWidth: activeTab === 'map' ? 860 : 720 }}>
        {activeTab === 'map' && <HexMap />}

        {activeTab === 'analysis' && (
          <>
            <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={styles.label}>Query</label>
                <textarea
                  style={styles.textarea}
                  placeholder="e.g. EUDR compliance for coffee exports from Minas Gerais to Germany"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div>
                <label style={styles.label}>Commodity</label>
                <select
                  style={styles.select}
                  value={commodity}
                  onChange={e => setCommodity(e.target.value)}
                  disabled={loading}
                >
                  <option value="coffee">Coffee</option>
                  <option value="fruits">Fruits</option>
                </select>
              </div>

              <div style={styles.row}>
                <div>
                  <label style={styles.label}>Origin</label>
                  <div style={styles.readonlyField}>Brazil</div>
                </div>
                <div>
                  <label style={styles.label}>Destination</label>
                  <div style={styles.readonlyField}>European Union</div>
                </div>
              </div>

              <button
                type="submit"
                style={{ ...styles.button, ...(loading || !query.trim() ? styles.buttonDisabled : {}) }}
                disabled={loading || !query.trim()}
              >
                {loading ? 'Analyzing…' : 'Analyze'}
              </button>
            </form>

            {error && <div style={styles.errorBox}>{error}</div>}

            {result && riskLevel && riskColor && (
              <div style={styles.resultCard}>
                <div style={styles.scoreRow}>
                  <div>
                    <div style={styles.scoreLabel}>Export Readiness</div>
                    <span style={styles.scoreValue}>
                      {result.export_readiness ?? 100 - result.risk_score}
                    </span>
                  </div>
                  <span
                    style={{
                      ...styles.riskBadge,
                      background: riskColor.bg,
                      color: riskColor.text,
                    }}
                  >
                    {riskLevel}
                  </span>
                </div>

                {(() => {
                  const dims = [
                    { label: 'Regulatory', value: result.regulatory?.risk_score ?? result.risk_score },
                    { label: 'Climate',    value: result.climate?.climate_risk_score ?? 61 },
                    { label: 'Market',     value: result.market?.market_risk_score ?? 55 },
                    { label: 'Logistics',  value: 44 },
                  ];
                  return (
                    <div style={styles.dimGrid}>
                      {dims.map(({ label, value }) => {
                        const color = getDimColor(value);
                        return (
                          <div key={label} style={styles.dimCard}>
                            <div style={styles.dimLabel}>{label}</div>
                            <div style={{ ...styles.dimValue, color }}>{value}</div>
                            <div style={styles.dimBarTrack}>
                              <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 2 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Findings</div>
                  {result.findings.map((f, i) => (
                    <div key={i} style={styles.listItem}>· {f}</div>
                  ))}
                </div>

                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Articles Cited</div>
                  {result.articles_cited.map((a, i) => (
                    <div key={i} style={{ ...styles.listItem, ...styles.monoItem }}>· {a}</div>
                  ))}
                </div>

                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Recommendations</div>
                  {result.recommendations.map((r, i) => (
                    <div key={i} style={styles.listItem}>· {r}</div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
