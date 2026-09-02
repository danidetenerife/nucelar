export const DEFAULT_THEME_ID = 'aurora:default';

export const BUILTIN_BASIC_THEME_IDS = [
  DEFAULT_THEME_ID,
] as const;

export type BuiltinBasicThemeId = (typeof BUILTIN_BASIC_THEME_IDS)[number];
