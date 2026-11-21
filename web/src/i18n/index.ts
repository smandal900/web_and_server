// A tiny translation helper.
//
// The English text IS the key: `t('Photos')`. Other languages are small files in ./locales that map
// English text to the translation. Missing entries fall back to English, so a locale can be added
// one string at a time. Placeholders look like {name}: t('Hello {name}', { name: 'Ann' }).
//
// Changing language re-mounts the app (see I18nProvider), so `t` can be a plain function.

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
];

let dictionary: Record<string, string> = {};

export function t(text: string, vars?: Record<string, string | number>): string {
  const translated = dictionary[text] ?? text;
  return vars ? translated.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`)) : translated;
}

// Locale files are only downloaded when chosen.
const loaders = import.meta.glob<{ default: Record<string, string> }>('./locales/*.ts');

export async function loadLanguage(code: string) {
  const loader = loaders[`./locales/${code}.ts`];
  dictionary = loader ? (await loader()).default : {};
  document.documentElement.lang = code;
}

export const savedLanguage = () => {
  try {
    return localStorage.getItem('language') ?? navigator.language.slice(0, 2);
  } catch {
    return 'en';
  }
};
