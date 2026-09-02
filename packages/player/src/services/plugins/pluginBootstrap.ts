import { normalize } from '@tauri-apps/api/path';

import { usePluginStore } from '../../stores/pluginStore';
import { useStartupStore } from '../../stores/startupStore';
import { errorMessage } from '../../utils/errorMessage';
import { providersHost } from '../providersHost';
import { createPluginAPI } from './createPluginAPI';
import { checkAndUpdatePlugins } from './pluginAutoUpdate';
import { getPluginsDir } from './pluginDir';
import { PluginLoader } from './PluginLoader';
import {
  getRegistryEntry,
  listRegistryEntries,
  setRegistryEntryWarnings,
} from './pluginRegistry';

import spotifyPlugin from '../../../../../plugins/nuclear-plugin-something/src/index';
import youtubePlugin from '../../../../../plugins/nuclear-plugin-youtube/src/index';
import ytMusicPlugin from '../../../../../plugins/nuclear-plugin-youtube-music/src/index';
import { isTauriEnvironment } from '../universalStore';

const isManagedPath = async (absPath: string): Promise<boolean> => {
  const normalizedPath = await normalize(absPath);
  const normalizedBase = await normalize(await getPluginsDir());
  return normalizedPath.startsWith(normalizedBase);
};

const loadBundledPlugins = (): void => {
  const ytMusicId = 'nuclear-plugin-youtube-music';
  const ytMusicApi = createPluginAPI(ytMusicId, 'YouTube Music');
  if (ytMusicPlugin.onEnable) {
    try {
      ytMusicPlugin.onEnable(ytMusicApi);
    } catch { /* ignore */ }
  }

  const spotifyId = 'nuclear-plugin-something';
  const spotifyApi = createPluginAPI(spotifyId, 'Spotify');
  if (spotifyPlugin.onEnable) {
    try {
      spotifyPlugin.onEnable(spotifyApi);
    } catch { /* ignore */ }
  }

  const youtubeId = 'nuclear-plugin-youtube';
  const youtubeApi = createPluginAPI(youtubeId, 'YouTube');
  if (youtubePlugin.onEnable) {
    try {
      youtubePlugin.onEnable(youtubeApi);
    } catch { /* ignore */ }
  }

  usePluginStore.setState((state) => ({
    plugins: {
      ...state.plugins,
      [ytMusicId]: {
        metadata: {
          id: ytMusicId,
          name: ytMusicId,
          displayName: 'YouTube Music',
          version: '0.1.0',
          description: 'YouTube Music streaming and metadata plugin for Nuclear',
          categories: [
            'streaming',
            'metadata',
            'dashboard',
            'playlists',
            'discovery',
          ],
          author: 'Nuclear Team',
          entry: 'index.ts',
          permissions: [],
        },
        path: '',
        enabled: true,
        warning: false,
        warnings: [],
        installationMethod: 'store',
        instance: ytMusicPlugin,
        api: ytMusicApi,
      },
      [spotifyId]: {
        metadata: {
          id: spotifyId,
          name: spotifyId,
          displayName: 'Spotify',
          version: '0.2.2',
          description: 'Spotify metadata and playlists provider for Nuclear',
          categories: ['metadata', 'playlists'],
          author: 'nukeop',
          entry: 'index.ts',
          permissions: [],
        },
        path: '',
        enabled: true,
        warning: false,
        warnings: [],
        installationMethod: 'store',
        instance: spotifyPlugin,
        api: spotifyApi,
      },
      [youtubeId]: {
        metadata: {
          id: youtubeId,
          name: youtubeId,
          displayName: 'YouTube',
          version: '0.1.2',
          description: 'YouTube streaming provider for Nuclear',
          categories: ['streaming'],
          author: 'nukeop',
          entry: 'index.ts',
          permissions: [],
        },
        path: '',
        enabled: true,
        warning: false,
        warnings: [],
        installationMethod: 'store',
        instance: youtubePlugin,
        api: youtubeApi,
      },
    },
  }));

  providersHost.resolveActiveOnBootstrap();
};

export const hydratePluginsFromRegistry = async (): Promise<void> => {
  useStartupStore.getState().startStartup();
  const now = Date.now();

  // Always load bundled plugins first — guarantees Spotify metadata and
  // YouTube streaming work on both APK and Desktop regardless of the registry.
  loadBundledPlugins();

  if (!isTauriEnvironment()) {
    useStartupStore.getState().finishStartup(Date.now() - now);
    return;
  }

  // In Tauri (Desktop), additionally load any file-system plugins from the
  // registry on top of the bundled ones. Registry plugins override bundled ones
  // if they share the same provider ID.
  const entries = (await listRegistryEntries()).sort(
    (a, b) =>
      new Date(a.installedAt).getTime() - new Date(b.installedAt).getTime(),
  );

  const BUNDLED_PLUGIN_IDS = new Set([
    'nuclear-plugin-something',
    'nuclear-plugin-youtube-music',
    'nuclear-plugin-youtube',
  ]);

  for (const entry of entries) {
    if (BUNDLED_PLUGIN_IDS.has(entry.id)) {
      continue;
    }
    // TODO: Support non-managed paths (dev plugins)
    if (!(await isManagedPath(entry.path))) {
      continue;
    }
    const pluginLoadStartTime = Date.now();
    try {
      const loader = new PluginLoader(entry.path);
      const metadata = await loader.loadMetadata();
      const api = createPluginAPI(metadata.id, metadata.displayName);
      const { instance } = await loader.load(api);
      const warnings = entry.warnings ?? loader.getWarnings() ?? [];
      usePluginStore.setState((state) => ({
        plugins: {
          ...state.plugins,
          [entry.id]: {
            metadata,
            path: entry.path,
            enabled: entry.enabled,
            warning: warnings.length > 0,
            warnings,
            installationMethod: entry.installationMethod,
            originalPath: entry.originalPath,
            instance,
            api,
          },
        },
      }));
      if (entry.enabled) {
        if (instance.onEnable) {
          try {
            await instance.onEnable(api);
          } catch (enableError) {
            const message = `onEnable failed: ${errorMessage(enableError)}`;
            const updatedWarnings = [...warnings, message];
            await setRegistryEntryWarnings(entry.id, updatedWarnings);
            usePluginStore.setState((state) => ({
              plugins: {
                ...state.plugins,
                [entry.id]: {
                  ...state.plugins[entry.id],
                  warning: true,
                  warnings: updatedWarnings,
                },
              },
            }));
          }
        }
      }
    } catch (error) {
      usePluginStore.setState((state) => ({
        plugins: {
          ...state.plugins,
          [entry.id]: {
            metadata: {
              id: entry.id,
              name: entry.id,
              displayName: entry.id,
              version: entry.version,
              description: '',
              categories: [],
              author: '',
              entry: '',
              permissions: [],
            },
            path: entry.path,
            enabled: entry.enabled,
            warning: true,
            warnings: [errorMessage(error)],
            installationMethod: entry.installationMethod,
            originalPath: entry.originalPath,
          },
        },
      }));
    } finally {
      const elapsed = Date.now() - pluginLoadStartTime;
      const targetMin = (await getRegistryEntry(entry.id))?.enabled ? 200 : 0;
      if (elapsed < targetMin) {
        await new Promise((resolve) => setTimeout(resolve, targetMin - elapsed));
      }
    }
  }

  providersHost.resolveActiveOnBootstrap();
  useStartupStore.getState().finishStartup(Date.now() - now);
  void checkAndUpdatePlugins();
};
