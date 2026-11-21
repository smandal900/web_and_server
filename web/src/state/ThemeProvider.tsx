import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';
interface ThemeValue {
  choice: ThemeChoice;
  isDark: boolean;
  setChoice: (c: ThemeChoice) => void;
  toggle: () => void;
}
const ThemeContext = createContext<ThemeValue>(null!);
export const useTheme = () => useContext(ThemeContext);

const systemPrefersDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
const readChoice = (): ThemeChoice => {
  try {
    return (localStorage.getItem('theme') as ThemeChoice) || 'system';
  } catch {
    return 'system';
  }
};

/** Keeps the `.dark` class on <html> in sync with the saved choice (light, dark or follow the system). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const isDark = choice === 'dark' || (choice === 'system' && systemDark);

  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const setChoice = (c: ThemeChoice) => {
    setChoiceState(c);
    try {
      localStorage.setItem('theme', c);
    } catch {
      /* private mode: the choice just will not be remembered */
    }
  };

  return (
    <ThemeContext.Provider value={{ choice, isDark, setChoice, toggle: () => setChoice(isDark ? 'light' : 'dark') }}>
      {children}
    </ThemeContext.Provider>
  );
}
