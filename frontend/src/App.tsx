import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { analyzeRoute, getAnalysisById } from './services/api';
import type { AnalyzeResponse } from './types';
import LandingScreen from './components/LandingScreen';
import type { LandingParams } from './components/LandingScreen';
import ProcessingScreen from './components/ProcessingScreen';
import DashboardScreen from './components/DashboardScreen';
import HistoryScreen from './components/HistoryScreen';
import ComparatorScreen from './components/ComparatorScreen';
import OptimizationScreen from './components/OptimizationScreen';
import AuditPathScreen from './components/AuditPathScreen';
import { COLORS, FONT } from './theme';

interface SharedState {
  commodity: string;
  horizon: string;
  origin: string;
  destination: string;
  tradeDirection: 'export' | 'import';
  result: AnalyzeResponse | null;
  setResult: (r: AnalyzeResponse) => void;
  setCommodity: (v: string) => void;
  setOrigin: (v: string) => void;
  setDestination: (v: string) => void;
  setTradeDirection: (v: 'export' | 'import') => void;
  onNewAnalysis: () => void;
  onHistory: () => void;
  onCompare: () => void;
  onOptimize: () => void;
  onAuditPath: () => void;
  onAnalyzeRoute: (origin: string, destination: string, tradeDirection: 'export' | 'import') => void;
}

function AnalysisRoute({
  commodity, horizon, origin, destination, tradeDirection, result,
  setResult, setCommodity, setOrigin, setDestination, setTradeDirection,
  onNewAnalysis, onHistory, onCompare, onOptimize, onAuditPath, onAnalyzeRoute,
}: SharedState) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(result?.analysis_id !== id);

  useEffect(() => {
    if (!id) return;
    if (result?.analysis_id === id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAnalysisById(id)
      .then(doc => {
        if (cancelled) return;
        setResult({ ...doc.full_result, analysis_id: doc.id });
        setCommodity(doc.full_result.commodity);
        setOrigin(doc.full_result.origin);
        setDestination(doc.full_result.destination);
        setTradeDirection(doc.full_result.trade_direction ?? 'export');
      })
      .catch(() => {
        if (!cancelled) navigate('/', { replace: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading || !result || result.analysis_id !== id) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: COLORS.textSecondary, fontFamily: FONT, fontSize: 13,
      }}>
        Loading analysis…
      </div>
    );
  }

  return (
    <DashboardScreen
      result={result}
      commodity={commodity}
      horizon={horizon}
      origin={origin}
      destination={destination}
      tradeDirection={tradeDirection}
      onNewAnalysis={onNewAnalysis}
      onHistory={onHistory}
      onCompare={onCompare}
      onOptimize={onOptimize}
      onAuditPath={onAuditPath}
      onAnalyzeRoute={onAnalyzeRoute}
    />
  );
}

export default function App() {
  const navigate = useNavigate();
  const [commodity,      setCommodity]      = useState('coffee');
  const [horizon,        setHorizon]        = useState('90');
  const [origin,         setOrigin]         = useState('Brazil');
  const [destination,    setDestination]    = useState('European Union');
  const [tradeDirection, setTradeDirection] = useState<'export' | 'import'>('export');
  const [result,         setResult]         = useState<AnalyzeResponse | null>(null);
  const [error,          setError]          = useState<string | null>(null);
  const [processing,     setProcessing]     = useState(false);
  const [prefill,        setPrefill]        = useState<{ origin: string; destination: string; tradeDirection: 'export' | 'import' } | null>(null);

  function handleAnalyzeRoute(o: string, d: string, td: 'export' | 'import') {
    setPrefill({ origin: o, destination: d, tradeDirection: td });
    navigate('/');
  }

  async function handleAnalyze({ commodity: c, focus, horizon: h, query, origin: orig, destination: dest, trade_direction: td }: LandingParams) {
    setCommodity(c);
    setHorizon(h);
    setOrigin(orig);
    setDestination(dest);
    setTradeDirection(td);
    setError(null);
    setResult(null);
    setProcessing(true);

    const queryText = query.trim() ||
      (td === 'import'
        ? `Analyze ${focus} risk for ${c} imports from ${orig} into Brazil over ${h} days`
        : `Analyze ${focus} risk for ${c} exports from Brazil to ${dest} over ${h} days`);

    const apiCall = analyzeRoute({
      query: queryText,
      commodity: c,
      origin: orig,
      destination: dest,
      origin_region: 'Cerrado Mineiro',
      trade_direction: td,
    });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out. Please try again.')), 60_000)
    );

    try {
      const data = await Promise.race([apiCall, timeout]);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error. Please try again.');
    }
  }

  function handleProcessingComplete() {
    if (result?.analysis_id) {
      navigate(`/analysis/${result.analysis_id}`);
    }
    // No analysis_id (e.g. Mongo persistence failed): fall through and render the
    // dashboard inline on "/" — there is no shareable URL for this case.
    setProcessing(false);
  }

  const shared: SharedState = {
    commodity, horizon, origin, destination, tradeDirection, result,
    setResult, setCommodity, setOrigin, setDestination, setTradeDirection,
    onNewAnalysis: () => navigate('/'),
    onHistory:     () => navigate('/history'),
    onCompare:     () => navigate('/compare'),
    onOptimize:    () => navigate('/optimize'),
    onAuditPath:   () => navigate('/audit-path'),
    onAnalyzeRoute: handleAnalyzeRoute,
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          processing ? (
            <ProcessingScreen
              result={result}
              error={error}
              onComplete={handleProcessingComplete}
              onRetry={() => setProcessing(false)}
            />
          ) : result && !result.analysis_id ? (
            <DashboardScreen
              result={result}
              commodity={commodity}
              horizon={horizon}
              origin={origin}
              destination={destination}
              tradeDirection={tradeDirection}
              onNewAnalysis={() => { setResult(null); }}
              onHistory={shared.onHistory}
              onCompare={shared.onCompare}
              onOptimize={shared.onOptimize}
              onAuditPath={shared.onAuditPath}
              onAnalyzeRoute={handleAnalyzeRoute}
            />
          ) : (
            <LandingScreen
              onAnalyze={handleAnalyze}
              onCompare={shared.onCompare}
              initialOrigin={prefill?.origin}
              initialDestination={prefill?.destination}
              initialTradeDirection={prefill?.tradeDirection}
            />
          )
        }
      />
      <Route path="/analysis/:id" element={<AnalysisRoute {...shared} />} />
      <Route
        path="/history"
        element={
          <HistoryScreen
            onBack={() => navigate(-1)}
            onViewFull={(id) => navigate(`/analysis/${id}`)}
          />
        }
      />
      <Route path="/compare" element={<ComparatorScreen onBack={() => navigate(-1)} />} />
      <Route
        path="/optimize"
        element={<OptimizationScreen onBack={() => navigate(-1)} onAuditPath={shared.onAuditPath} />}
      />
      <Route path="/audit-path" element={<AuditPathScreen onBack={() => navigate(-1)} />} />
    </Routes>
  );
}
