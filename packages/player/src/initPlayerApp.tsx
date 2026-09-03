import React from 'react';

import App, { defaultQueryClient } from './App';
import { initLogStream } from './hooks/useLogStream';
import { initBridgeHandler } from './services/bridge/bridgeHandler';
import { registerBuiltInCoreSettings } from './services/coreSettings';
import { initDiscoveryService } from './services/discoveryService';
import { initHistoryService } from './services/history';
import {
  applyLanguageFromSettings,
  initLanguageWatcher,
} from './services/languageService';
import { initMediaSessionService } from './services/mediaSessionService';
import { p2pSyncService } from './services/p2pSyncService';
import { initPlaybackEventBridge } from './services/playbackEventBridge';
import { hydratePluginsFromRegistry } from './services/plugins/pluginBootstrap';
import { providersHost } from './services/providersHost';
import { ytdlpEnsureInstalled } from './services/tauri/commands';
import { initTvNavigation } from './services/tvNavigation';
import { isTauriEnvironment } from './services/universalStore';
import { initCarModeService } from './stores/carModeStore';
import { initializeFavoritesStore } from './stores/favoritesStore';
import { initializePlaylistStore } from './stores/playlistStore';
import { initializeProvidersStore } from './stores/providersStore';
import { initializeQueueStore } from './stores/queueStore';
import { initializeSettingsStore } from './stores/settingsStore';
import { initializeShortcutsStore } from './stores/shortcutsStore';
import { hydrateThemeStore } from './stores/themeStore';
import { useUpdaterStore } from './stores/updaterStore';

export const initPlayerApp = async (
  root: ReturnType<typeof import('react-dom/client').createRoot>,
) => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  if (typeof window !== 'undefined' && !isTauriEnvironment()) {
    try {
      Object.defineProperty(document, 'hidden', {
        get: () => false,
        configurable: true,
      });
      Object.defineProperty(document, 'visibilityState', {
        get: () => 'visible',
        configurable: true,
      });
      Object.defineProperty(Document.prototype, 'hidden', {
        get: () => false,
        configurable: true,
      });
      Object.defineProperty(Document.prototype, 'visibilityState', {
        get: () => 'visible',
        configurable: true,
      });
    } catch {}
  }

  try {
    if (isTauriEnvironment()) {
      initLogStream();
    }

    await initializeSettingsStore();
    await initializeShortcutsStore();
    await initializeQueueStore();
    await initializeFavoritesStore();
    await initializePlaylistStore();
    await initializeProvidersStore();
    await registerBuiltInCoreSettings();
    await initDiscoveryService();

    try {
      initHistoryService();
    } catch {}

    try {
      initMediaSessionService();
    } catch {}

    try {
      initTvNavigation();
    } catch {}

    try {
      void initCarModeService();
    } catch {}

    if (isTauriEnvironment()) {
      try {
        await initBridgeHandler();
      } catch {}
      try {
        await initPlaybackEventBridge();
      } catch {}
    }

    try {
      await applyLanguageFromSettings();
      initLanguageWatcher();
    } catch {}

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.setAttribute('data-theme-id', 'aurora:default');
    }

    try {
      await hydrateThemeStore();
    } catch {}

    try {
      await hydratePluginsFromRegistry();
      providersHost.resolveActiveOnBootstrap();
    } catch {}

    try {
      p2pSyncService.startBackgroundSyncWatcher();
      void p2pSyncService.syncNow().then(() => {
        defaultQueryClient.invalidateQueries({ queryKey: ['history'] });
        defaultQueryClient.invalidateQueries({ queryKey: ['favorites'] });
        defaultQueryClient.invalidateQueries({ queryKey: ['playlists'] });
      });
    } catch {}

    try {
      void useUpdaterStore.getState().checkForUpdate();
    } catch {}

    if (isTauriEnvironment()) {
      try {
        void ytdlpEnsureInstalled();
      } catch {}
    }
  } catch (error) {
    console.error('Initialization error:', error);
  }
};
