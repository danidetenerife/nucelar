import { create } from 'zustand';

import {
  clearAdvancedTheme,
  DEFAULT_THEME_ID,
  setThemeId,
} from '@nuclearplayer/themes';

export type BasicTheme = { type: 'basic'; id: string };
export type ActiveTheme = BasicTheme;

type ThemeStoreState = {
  activeTheme: ActiveTheme;
  isBasicThemeSelected: () => boolean;
  hydrate: () => void;
};

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  activeTheme: { type: 'basic', id: DEFAULT_THEME_ID },

  isBasicThemeSelected: () => get().activeTheme.type === 'basic',

  hydrate: () => {
    clearAdvancedTheme();
    setThemeId(DEFAULT_THEME_ID);
    set({ activeTheme: { type: 'basic', id: DEFAULT_THEME_ID } });
  },
}));

export const hydrateThemeStore = (): void => {
  useThemeStore.getState().hydrate();
};
