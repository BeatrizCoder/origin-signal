import { useLanguage } from '../context/LanguageContext';
import type { Language } from '../i18n/translations';

export default function LangToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {(['EN', 'PT'] as Language[]).map(lang => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          style={{
            padding: '3px 8px',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.8,
            fontFamily: 'ui-monospace, Consolas, monospace',
            background: language === lang ? '#D4900A' : 'transparent',
            color: language === lang ? '#000' : '#475569',
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
