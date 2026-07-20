import { useState } from 'react';
import { analyzeRoute } from './services/api';
import type { AnalyzeResponse } from './types';
import LandingScreen from './components/LandingScreen';
import type { LandingParams } from './components/LandingScreen';
import ProcessingScreen from './components/ProcessingScreen';
import DashboardScreen from './components/DashboardScreen';
import HistoryScreen from './components/HistoryScreen';
import ComparatorScreen from './components/ComparatorScreen';
import OptimizationScreen from './components/OptimizationScreen';
import AuditPathScreen from './components/AuditPathScreen';

type Screen = 'landing' | 'processing' | 'dashboard' | 'history' | 'comparator' | 'optimization' | 'audit-path';

export default function App() {
  const [screen,         setScreen]         = useState<Screen>('landing');
  const [commodity,      setCommodity]      = useState('coffee');
  const [horizon,        setHorizon]        = useState('90');
  const [origin,         setOrigin]         = useState('Brazil');
  const [destination,    setDestination]    = useState('European Union');
  const [tradeDirection, setTradeDirection] = useState<'export' | 'import'>('export');
  const [result,         setResult]         = useState<AnalyzeResponse | null>(null);
  const [error,          setError]          = useState<string | null>(null);
  const [prefill,        setPrefill]        = useState<{ origin: string; destination: string; tradeDirection: 'export' | 'import' } | null>(null);

  function handleAnalyzeRoute(o: string, d: string, td: 'export' | 'import') {
    setPrefill({ origin: o, destination: d, tradeDirection: td });
    setScreen('landing');
  }

  async function handleAnalyze({ commodity: c, focus, horizon: h, query, origin: orig, destination: dest, trade_direction: td }: LandingParams) {
    setCommodity(c);
    setHorizon(h);
    setOrigin(orig);
    setDestination(dest);
    setTradeDirection(td);
    setError(null);
    setResult(null);
    setScreen('processing');

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

  if (screen === 'processing') {
    return (
      <ProcessingScreen
        result={result}
        error={error}
        onComplete={() => setScreen('dashboard')}
        onRetry={() => setScreen('landing')}
      />
    );
  }

  if (screen === 'history') {
    return (
      <HistoryScreen
        onBack={() => setScreen(result ? 'dashboard' : 'landing')}
        onSelectAnalysis={(data) => {
          setResult(data);
          setCommodity(data.commodity);
          setOrigin(data.origin);
          setDestination(data.destination);
          setTradeDirection(data.trade_direction ?? 'export');
          setScreen('dashboard');
        }}
      />
    );
  }

  if (screen === 'comparator') {
    return <ComparatorScreen onBack={() => setScreen(result ? 'dashboard' : 'landing')} />;
  }

  if (screen === 'optimization') {
    return (
      <OptimizationScreen
        onBack={() => setScreen(result ? 'dashboard' : 'landing')}
        onAuditPath={() => setScreen('audit-path')}
      />
    );
  }

  if (screen === 'audit-path') {
    return <AuditPathScreen onBack={() => setScreen(result ? 'dashboard' : 'landing')} />;
  }

  if (screen === 'dashboard' && result) {
    return (
      <DashboardScreen
        result={result}
        commodity={commodity}
        horizon={horizon}
        origin={origin}
        destination={destination}
        tradeDirection={tradeDirection}
        onNewAnalysis={() => setScreen('landing')}
        onHistory={() => setScreen('history')}
        onCompare={() => setScreen('comparator')}
        onOptimize={() => setScreen('optimization')}
        onAuditPath={() => setScreen('audit-path')}
        onAnalyzeRoute={handleAnalyzeRoute}
      />
    );
  }

  return (
    <LandingScreen
      onAnalyze={handleAnalyze}
      onCompare={() => setScreen('comparator')}
      initialOrigin={prefill?.origin}
      initialDestination={prefill?.destination}
      initialTradeDirection={prefill?.tradeDirection}
    />
  );
}
