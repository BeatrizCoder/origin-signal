import { useState } from 'react';
import { analyzeRoute } from './services/api';
import type { AnalyzeResponse } from './types';
import LandingScreen from './components/LandingScreen';
import type { LandingParams } from './components/LandingScreen';
import ProcessingScreen from './components/ProcessingScreen';
import DashboardScreen from './components/DashboardScreen';

type Screen = 'landing' | 'processing' | 'dashboard';

export default function App() {
  const [screen,    setScreen]    = useState<Screen>('landing');
  const [commodity, setCommodity] = useState('coffee');
  const [horizon,   setHorizon]   = useState('90');
  const [result,    setResult]    = useState<AnalyzeResponse | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  async function handleLandingSubmit({ commodity: c, focus, horizon: h, query }: LandingParams) {
    setCommodity(c);
    setHorizon(h);
    setScreen('processing');
    setError(null);
    setResult(null);

    const queryText = query.trim() ||
      `Analyze ${focus} risk for ${c} exports from Brazil to the European Union over ${h} days`;

    const apiCall = analyzeRoute({
      query: queryText,
      commodity: c,
      origin: 'Brazil',
      destination: 'European Union',
      origin_region: 'Cerrado Mineiro',
    });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out. Please try again.')), 30_000)
    );

    const minWait = new Promise<void>(resolve => setTimeout(resolve, 4_000));

    try {
      const [data] = await Promise.all([
        Promise.race([apiCall, timeout]),
        minWait,
      ]);
      setResult(data);
      setScreen('dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error. Please try again.');
    }
  }

  if (screen === 'processing') {
    return (
      <ProcessingScreen
        error={error}
        onRetry={() => setScreen('landing')}
      />
    );
  }

  if (screen === 'dashboard' && result) {
    return (
      <DashboardScreen
        result={result}
        commodity={commodity}
        horizon={horizon}
        onReset={() => setScreen('landing')}
      />
    );
  }

  return <LandingScreen onSubmit={handleLandingSubmit} />;
}
