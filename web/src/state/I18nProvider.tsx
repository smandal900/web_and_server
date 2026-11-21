import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadLanguage, savedLanguage } from '../i18n';

interface I18nValue {
  language: string;
  setLanguage: (code: string) => void;
}
const I18nContext = createContext<I18nValue>(null!);
export const useLanguage = () => useContext(I18nContext);

/** Loads the chosen language file, then renders the app. A language change re-mounts the tree so every `t()` re-runs. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState(savedLanguage);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    loadLanguage(language).then(() => current && setLoadedFor(language));
    return () => {
      current = false;
    };
  }, [language]);

  const setLanguage = (code: string) => {
    try {
      localStorage.setItem('language', code);
    } catch {
      /* ignore */
    }
    setLang(code);
  };

  if (loadedFor !== language) return null; // a few milliseconds; the page background is already drawn
  return (
    <I18nContext.Provider value={{ language, setLanguage }}>
      <div key={language} className="h-full">
        {children}
      </div>
    </I18nContext.Provider>
  );
}
