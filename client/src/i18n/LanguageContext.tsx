import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { translations, type Lang } from './translations';

const LANG_KEY = 'app-language';

type T = typeof translations.en;

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: T;
  isRTL: boolean;
}

const LanguageContext = createContext<LangContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(LANG_KEY);
    return stored === 'he' ? 'he' : 'en';
  });

  const isRTL = lang === 'he';

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem(LANG_KEY, l);
  }

  function toggleLang() {
    setLang(lang === 'en' ? 'he' : 'en');
  }

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  }, [lang, isRTL]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t: translations[lang], isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
