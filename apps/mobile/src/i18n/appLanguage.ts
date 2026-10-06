import { versionedStore } from '../storage/versionedStore';

import { en } from './strings.en';
import { type StringCatalog, strings as zhTW } from './strings';

export type { StringCatalog } from './strings';

// The App Language (GLOSSARY.md): the language the interface renders in.
// Follows the phone — any Chinese language → 繁體中文, anything else →
// English — unless the User stored an explicit per-device override.
export type AppLanguage = 'zh-TW' | 'en';

// null is System Default: no stored choice, follow the phone.
export type LanguageOverride = AppLanguage | null;

// Structural slice of expo-localization's Locale, so pure code and tests
// need no native module.
export type DeviceLocale = { languageCode: string | null };

export function resolveAppLanguage(
  locales: readonly DeviceLocale[],
  override: LanguageOverride,
): AppLanguage {
  if (override !== null) return override;
  return locales[0]?.languageCode === 'zh' ? 'zh-TW' : 'en';
}

const catalogs: Record<AppLanguage, StringCatalog> = { 'zh-TW': zhTW, en };

export function catalogFor(language: AppLanguage): StringCatalog {
  return catalogs[language];
}

// Persistence rides the shared versioned envelope (storage/versionedStore):
// an unreadable or future-versioned store reads as System Default.
// System Default is the absence of a store, never a stored value: only an
// explicit language choice is written.
type Store = { v: 1; override: AppLanguage };

const store = versionedStore<LanguageOverride>({
  key: 'appLanguage.v1',
  fallback: null,
  decode: (envelope) => {
    const parsed = envelope as Store;
    if (parsed.v !== 1 || (parsed.override !== 'zh-TW' && parsed.override !== 'en')) {
      return null;
    }
    return parsed.override;
  },
  encode: (override) => ({ v: 1, override }),
});

export function loadOverride(): Promise<LanguageOverride> {
  return store.load();
}

export async function saveOverride(override: LanguageOverride): Promise<void> {
  if (override === null) {
    await store.remove();
  } else {
    await store.save(override);
  }
}
