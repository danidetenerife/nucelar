import React from 'react';

import App, { defaultQueryClient } from './App';
import { initLogStream } from './hooks/useLogStream';
import { applyThemeFromSettingsIfAny } from './services/advancedThemeService';
import { startAdvancedThemeWatcher } from './services/advancedThemeWatcher';
import { initBridgeHandler } from './services/bridge/bridgeHandler';
import { registerBuiltInCoreSettings } from './services/coreSettings';
import { initDiscordHandler } from './services/discordHandler';
import { initDiscoveryService } from './services/discoveryService';
import { initHistoryService } from './services/history';
import { initHttpApiHandler } from './services/httpApi';
import { initLanguageWatcher, applyLanguageFromSettings } from './services/languageService';
import { loadMarketplaceThemes } from './services/marketplaceThemeDirService';
import { initMcpHandler } from './services/mcp';
import { initMediaSessionService } from './services/mediaSessionService';
import { initMpdHandler } from './services/mpd';
import { initPlaybackEventBridge } from './services/playbackEventBridge';
import { hydratePluginsFromRegistry } from './services/plugins/pluginBootstrap';
import { ytdlpEnsureInstalled } from './services/tauri/commands';
import { initializeFavoritesStore } from './stores/favoritesStore';
import { initializePlaylistStore } from './stores/playlistStore';
import { initializeProvidersStore } from './stores/providersStore';
import { initializeQueueStore } from './stores/queueStore';
import { initializeSettingsStore } from './stores/settingsStore';
import { initializeShortcutsStore } from './stores/shortcutsStore';
import { hydrateThemeStore } from './stores/themeStore';
import { useUpdaterStore } from './stores/updaterStore';
import { initCarModeService } from './stores/carModeStore';

import { p2pSyncService } from './services/p2pSyncService';
import { isTauriEnvironment } from './services/universalStore';

export const initPlayerApp = async (
  root: ReturnType<typeof import('react-dom/client').createRoot>,
) => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

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
      void initCarModeService();
    } catch {}

    if (isTauriEnvironment()) {
      try {
        await initMcpHandler();
      } catch {}
      try {
        await initMpdHandler();
      } catch {}
      try {
        await initHttpApiHandler();
      } catch {}
      try {
        await initBridgeHandler();
      } catch {}
      try {
        await initDiscordHandler();
      } catch {}
      try {
        await initPlaybackEventBridge();
      } catch {}
    }

    try {
      await applyLanguageFromSettings();
      initLanguageWatcher();
    } catch {}

    try {
      startAdvancedThemeWatcher();
    } catch {}

    if (isTauriEnvironment()) {
      try {
        await loadMarketplaceThemes();
      } catch {}
    }

    try {
      await hydrateThemeStore();
    } catch {}
    try {
      await applyThemeFromSettingsIfAny();
    } catch {}

    try {
      void hydratePluginsFromRegistry();
    } catch {}

    try {
      p2pSyncService.startBackgroundSyncWatcher();
      void p2pSyncService.syncNow().then(() => {
        defaultQueryClient.invalidateQueries({ queryKey: ['history'] });
        defaultQueryClient.invalidateQueries({ queryKey: ['favorites'] });
        defaultQueryClient.invalidateQueries({ queryKey: ['playlists'] });
      });
    } catch {}

    if (isTauriEnvironment()) {
      try {
        void useUpdaterStore.getState().checkForUpdate();
      } catch {}
      try {
        void ytdlpEnsureInstalled();
      } catch {}
    }
  } catch (error) {
    console.error('Initialization error:', error);
  }
};
