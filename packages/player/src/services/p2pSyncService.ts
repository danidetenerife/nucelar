

import { defaultQueryClient } from '../App';
import { useFavoritesStore } from '../stores/favoritesStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useProvidersStore } from '../stores/providersStore';
import { useSettingsStore } from '../stores/settingsStore';
import { changeLanguage } from './languageService';
import {
  personalizationEngine,
  type UserListenRecord,
} from './personalizationEngine';
import { playlistFileService } from './playlistFileService';
import { createUniversalStore } from './universalStore';

const SYNC_STORE_FILE = 'p2p_sync.json';
const syncStore = createUniversalStore(SYNC_STORE_FILE);

type FavEntry = { ref: Record<string, unknown>; addedAtIso: string };

function entrySourceKey(entry: FavEntry): string {
  const src = entry.ref?.source as Record<string, string> | undefined;
  if (src?.provider && src?.id) {
    return `${src.provider}::${src.id}`;
  }
  return (
    (entry.ref?.title as string) ??
    (entry.ref?.name as string) ??
    JSON.stringify(entry.ref)
  );
}

function entryNameKey(entry: FavEntry): string {
  const name =
    (entry.ref?.name as string) ?? (entry.ref?.title as string) ?? '';
  return name ? `artist::${name.trim().toLowerCase()}` : '';
}

function isEntryDeleted(
  entry: FavEntry,
  deletedKeys: Record<string, number>,
): boolean {
  const srcKey = entrySourceKey(entry);
  const nameKey = entryNameKey(entry);
  const addedTime = new Date(entry.addedAtIso).getTime();

  const srcDeletedTime = deletedKeys[srcKey];
  if (srcDeletedTime && srcDeletedTime >= addedTime) {
    return true;
  }
  const nameDeletedTime = nameKey ? deletedKeys[nameKey] : undefined;
  if (nameDeletedTime && nameDeletedTime >= addedTime) {
    return true;
  }
  return false;
}

/**
 * Merges two favourite entry lists keeping all unique non-deleted items.
 * When both sides have the same item, keeps the one with the more
 * recent addedAtIso so the last action wins.
 */
function mergeFavEntries(
  local: FavEntry[],
  remote: FavEntry[],
  deletedKeys: Record<string, number> = {},
): { merged: FavEntry[]; hadLocalExtras: boolean } {
  const merged = new Map<string, FavEntry>();
  for (const entry of remote) {
    if (!isEntryDeleted(entry, deletedKeys)) {
      merged.set(entrySourceKey(entry), entry);
    }
  }

  let hadLocalExtras = false;
  for (const localEntry of local) {
    if (isEntryDeleted(localEntry, deletedKeys)) {
      continue;
    }
    const key = entrySourceKey(localEntry);
    const remoteEntry = merged.get(key);
    if (!remoteEntry) {
      merged.set(key, localEntry);
      hadLocalExtras = true;
    } else {
      const localTime = new Date(localEntry.addedAtIso).getTime();
      const remoteTime = new Date(remoteEntry.addedAtIso).getTime();
      if (localTime > remoteTime) {
        merged.set(key, localEntry);
        hadLocalExtras = true;
      }
    }
  }

  return { merged: Array.from(merged.values()), hadLocalExtras };
}


async function safeFetchJson<T>(
  url: string,
  optionsOrTimeout?: RequestInit | number,
  timeoutMs = 3000,
): Promise<T | null> {
  try {
    const isOptions = typeof optionsOrTimeout === 'object';
    const options = isOptions ? optionsOrTimeout : undefined;
    const timeout =
      typeof optionsOrTimeout === 'number' ? optionsOrTimeout : timeoutMs;

    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) {
      return null;
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export class P2PSyncService {
  private syncIntervalTimer: number | null = null;
  private eventSource: EventSource | null = null;
  private isSyncing = false;
  private isApplyingRemote = false;
  private pushDebounceTimer: number | null = null;
  private lastSyncFinishedAt = 0;
  private static readonly PUSH_DEBOUNCE_MS = 5000;
  private static readonly SYNC_INTERVAL_MS = 120_000;
  private static readonly POST_SYNC_COOLDOWN_MS = 10_000;


  constructor() {
    this.setupLocalSubscribers();
  }

  private setupLocalSubscribers(): void {
    useFavoritesStore.subscribe(() => {
      if (this.isApplyingRemote) {
        return;
      }
      this.schedulePushToPc();
    });

    useSettingsStore.subscribe(() => {
      if (this.isApplyingRemote) {
        return;
      }
      this.schedulePushToPc();
    });

    usePlaylistStore.subscribe(() => {
      if (this.isApplyingRemote) {
        return;
      }
      this.schedulePushToPc();
    });
  }

  private schedulePushToPc(): void {
    if (Date.now() - this.lastSyncFinishedAt < P2PSyncService.POST_SYNC_COOLDOWN_MS) {
      return;
    }
    if (this.pushDebounceTimer) {
      clearTimeout(this.pushDebounceTimer);
    }
    this.pushDebounceTimer = window.setTimeout(() => {
      void this.pushLocalChangesToPc();
    }, P2PSyncService.PUSH_DEBOUNCE_MS);
  }

  async pushLocalChangesToPc(): Promise<boolean> {
    const serverUrl = await this.getWorkingServerUrl();
    if (!serverUrl) {
      return false;
    }

    try {
      const favStoreState = useFavoritesStore.getState();
      const settingsStoreState = useSettingsStore.getState();
      const playlistStoreState = usePlaylistStore.getState();

      const allPlaylists = [];
      for (const entry of playlistStoreState.index) {
        const playlist = await usePlaylistStore.getState().loadPlaylist(entry.id);
        if (playlist) {
          allPlaylists.push(playlist);
        }
      }

      const userProfileListens = await personalizationEngine.getListenRecords();

      const payload = {
        favorites: {
          tracks: favStoreState.tracks,
          artists: favStoreState.artists,
          albums: favStoreState.albums,
          deletedKeys: favStoreState.deletedKeys,
        },
        settings: settingsStoreState.values,
        playlists: allPlaylists,
        user_profile: userProfileListens,
        activeProviders: useProvidersStore.getState().active,
      };

      const res = await fetch(`${serverUrl}/api/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        try {
          const responseBody = await res.json() as { deletedKeys?: Record<string, number> };
          if (responseBody?.deletedKeys && typeof responseBody.deletedKeys === 'object') {
            const localDeletedKeys = useFavoritesStore.getState().deletedKeys;
            const merged: Record<string, number> = { ...localDeletedKeys };
            for (const [key, timestamp] of Object.entries(responseBody.deletedKeys)) {
              if (!merged[key] || (merged[key] ?? 0) < (timestamp as number)) {
                merged[key] = timestamp as number;
              }
            }
            useFavoritesStore.setState({ deletedKeys: merged });
            const favDiskStore = createUniversalStore('favorites.json');
            await favDiskStore.set('favorites.deletedKeys', merged);
            await favDiskStore.save();
          }
        } catch {
          // Response body is optional
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }


  async getSyncServerUrl(): Promise<string> {
    const saved = await syncStore.get<string>('server_url');
    if (saved) {
      return saved;
    }
    return 'http://192.168.0.12:4120';
  }

  async setSyncServerUrl(url: string): Promise<void> {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    await syncStore.set('server_url', cleanUrl);
    await syncStore.save();
  }

  async isAutoSyncEnabled(): Promise<boolean> {
    const enabled = await syncStore.get<boolean>('auto_sync');
    return enabled ?? true;
  }

  async setAutoSyncEnabled(enabled: boolean): Promise<void> {
    await syncStore.set('auto_sync', enabled);
    await syncStore.save();
  }

  async getLastSyncTime(): Promise<number | null> {
    return (await syncStore.get<number>('last_sync_time')) ?? null;
  }

  async getWorkingServerUrl(): Promise<string | null> {
    const savedUrl = await this.getSyncServerUrl();
    const hostMatch = savedUrl.match(/^https?:\/\/([^:/]+)/);
    const host = hostMatch ? hostMatch[1] : '192.168.0.12';

    const candidates = [
      `http://${host}:4122`,
      savedUrl,
      `http://${host}:4120`,
    ];

    for (const url of candidates) {
      const health = await safeFetchJson<{ status: string }>(
        `${url}/api/health`,
        1200,
      );
      if (health?.status === 'ok') {
        return url;
      }
    }
    return null;
  }

  async checkPcHealth(targetUrl?: string): Promise<boolean> {
    if (targetUrl) {
      try {
        const response = await fetch(`${targetUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
        return response.ok;
      } catch {
        return false;
      }
    }
    const url = await this.getWorkingServerUrl();
    return url !== null;
  }

  async discoverPcOnLan(): Promise<string | null> {
    const commonSubnets = [
      '192.168.0.',
      '192.168.1.',
      '192.168.18.',
      '10.0.0.',
    ];

    const currentUrl = await this.getWorkingServerUrl();
    if (currentUrl) {
      return currentUrl;
    }

    for (const subnet of commonSubnets) {
      const batchPromises: Promise<string | null>[] = [];

      for (let i = 1; i <= 40; i++) {
        const candidate = `http://${subnet}${i}:4122`;
        const p = safeFetchJson<{ status: string }>(
          `${candidate}/api/health`,
          300,
        ).then((res) => (res?.status === 'ok' ? candidate : null));
        batchPromises.push(p);
      }

      const results = await Promise.all(batchPromises);
      const found = results.find((r) => r !== null);
      if (found) {
        await this.setSyncServerUrl(found);
        return found;
      }
    }

    return null;
  }

  async syncNow(): Promise<{
    success: boolean;
    error?: string;
    syncedCounts?: { tracks: number; artists: number; settings: number };
  }> {
    if (this.isSyncing) {
      return { success: false, error: 'Sincronización ya en curso' };
    }
    this.isSyncing = true;

    try {
      const workingUrl = await this.getWorkingServerUrl();
      if (!workingUrl) {
        this.isSyncing = false;
        const savedUrl = await this.getSyncServerUrl();
        return {
          success: false,
          error: `No se puede conectar con el PC en ${savedUrl}. Comprueba que el PC está encendido y en el mismo Wi-Fi.`,
        };
      }

      let syncedTracks = 0;
      let syncedArtists = 0;
      let syncedSettings = 0;

      const hostMatch = workingUrl.match(/^https?:\/\/([^:/]+)/);
      const host = hostMatch ? hostMatch[1] : '192.168.0.12';

      const settingsStore = useSettingsStore.getState();
      const playlistStore = usePlaylistStore.getState();

      const syncData = await safeFetchJson<{
        favorites?: {
          tracks?: Array<{
            ref?: Record<string, unknown>;
            title?: string;
            addedAtIso?: string;
          }>;
          albums?: Array<{
            ref?: Record<string, unknown>;
            title?: string;
            addedAtIso?: string;
          }>;
          artists?: Array<{
            ref?: Record<string, unknown>;
            name?: string;
            addedAtIso?: string;
          }>;
          deletedKeys?: Record<string, number>;
        };
        settings?: Record<string, unknown>;
        plugins?: Record<string, unknown>;
        activeProviders?: Record<string, unknown>;
        playlists?: Array<{ id: string; name: string; tracks?: unknown[] }>;
        user_profile?: UserListenRecord[];
        queue?: { items?: Array<{ track?: unknown }> };
      }>(`${workingUrl}/api/sync`, undefined, 3500);

      if (syncData?.favorites) {
        this.isApplyingRemote = true;

        const rawArtists = syncData.favorites.artists ?? [];
        const rawTracks = syncData.favorites.tracks ?? [];
        const rawAlbums = syncData.favorites.albums ?? [];

        const toEntry = (item: { ref?: Record<string, unknown>; addedAtIso?: string }): FavEntry => ({
          addedAtIso: item.addedAtIso ?? new Date().toISOString(),
          ref: (item.ref ?? item) as Record<string, unknown>,
        });

        const localState = useFavoritesStore.getState();
        let needsPushBack = false;

        // Merge PC's deletedKeys with local tombstones — bidirectional
        const remoteDeletedKeys = syncData.favorites.deletedKeys ?? {};

        const mergedDeletedKeys: Record<string, number> = { ...localState.deletedKeys };
        for (const [key, timestamp] of Object.entries(remoteDeletedKeys)) {
          if (!mergedDeletedKeys[key] || (mergedDeletedKeys[key] ?? 0) < timestamp) {
            mergedDeletedKeys[key] = timestamp;
          }
        }

        // Bidirectional merge: union of local + remote, respecting deletion tombstones
        const { merged: mergedArtists, hadLocalExtras: artistExtras } = mergeFavEntries(
          (localState.artists as unknown as FavEntry[]) ?? [],
          rawArtists.map(toEntry),
          mergedDeletedKeys,
        );
        const { merged: mergedTracks, hadLocalExtras: trackExtras } = mergeFavEntries(
          (localState.tracks as unknown as FavEntry[]) ?? [],
          rawTracks.map(toEntry),
          mergedDeletedKeys,
        );
        const { merged: mergedAlbums, hadLocalExtras: albumExtras } = mergeFavEntries(
          (localState.albums as unknown as FavEntry[]) ?? [],
          rawAlbums.map(toEntry),
          mergedDeletedKeys,
        );

        needsPushBack = artistExtras || trackExtras || albumExtras;

        useFavoritesStore.setState({
          artists: mergedArtists as never,
          tracks: mergedTracks as never,
          albums: mergedAlbums as never,
          deletedKeys: mergedDeletedKeys,
        });

        syncedArtists = mergedArtists.length;
        syncedTracks = mergedTracks.length;

        // Persist merged favorites to disk
        const favDiskStore = createUniversalStore('favorites.json');
        await favDiskStore.set('favorites.tracks', mergedTracks);
        await favDiskStore.set('favorites.albums', mergedAlbums);
        await favDiskStore.set('favorites.artists', mergedArtists);
        await favDiskStore.set('favorites.deletedKeys', mergedDeletedKeys);
        await favDiskStore.save();


        // If local had items the PC didn't know about, push back so the PC stays in sync
        if (needsPushBack) {
          this.isApplyingRemote = false;
          void this.pushLocalChangesToPc();
          this.isApplyingRemote = true;
        }

        // Playlists
        if (
          Array.isArray(syncData.playlists) &&
          syncData.playlists.length > 0
        ) {
          for (const rawPl of syncData.playlists) {
            const pl =
              (rawPl as { playlist?: { id?: string; name?: string; items?: unknown[]; artwork?: unknown; description?: string } }).playlist ||
              (rawPl as { id?: string; name?: string; items?: unknown[]; artwork?: unknown; description?: string });
            if (pl && (pl.name || pl.id)) {
              const playlistId = pl.id || `synced-${pl.name}`;
              const playlistObj = {
                id: playlistId,
                name: pl.name || 'Playlist',
                description: pl.description || '',
                createdAtIso: new Date().toISOString(),
                lastModifiedIso: new Date().toISOString(),
                isReadOnly: false,
                items: pl.items || [],
                artwork: pl.artwork,
              };

              await playlistFileService.savePlaylist(playlistObj as never);
            }
          }
          await playlistStore.loadIndex();
        }

        // Settings — skip theme settings (device-local preference)
        if (syncData.settings) {
          const s = syncData.settings;
          const currentValues = { ...useSettingsStore.getState().values };
          const settingsDiskStore = createUniversalStore('settings.json');

          const isThemeKey = (key: string) =>
            key.includes('theme') || key === 'dark' || key === 'themeId';

          for (const [key, val] of Object.entries(s)) {
            if (isThemeKey(key)) {
              continue;
            }
            const rawKey = key.replace(/^core\./, '');
            const fullKey = `core.${rawKey}`;

            currentValues[key] = val as never;
            currentValues[rawKey] = val as never;
            currentValues[fullKey] = val as never;

            await settingsDiskStore.set(key, val);
            await settingsDiskStore.set(rawKey, val);
            await settingsDiskStore.set(fullKey, val);
          }

          useSettingsStore.setState({ values: currentValues });
          await settingsDiskStore.save();

          const lang = (s['core.general.language'] ||
            s['general.language'] ||
            s.language) as string | undefined;
          if (lang) {
            void changeLanguage(lang);
          }
        }

        // Active providers — sync from PC so Android knows which metadata
        // provider to use (e.g. Spotify) for artist page redirects.
        if (syncData.activeProviders && typeof syncData.activeProviders === 'object') {
          const providersDiskStore = createUniversalStore('active-providers.json');
          const existing = (await providersDiskStore.get<Record<string, string>>('active')) ?? {};
          const merged = { ...existing, ...syncData.activeProviders as Record<string, string> };
          await providersDiskStore.set('active', merged);
          await providersDiskStore.save();
          await useProvidersStore.getState().loadFromDisk();
        }

        // Plugins & Providers
        if (syncData.plugins) {
          const pluginsDiskStore = createUniversalStore('plugins.json');
          for (const [k, v] of Object.entries(syncData.plugins)) {
            await pluginsDiskStore.set(k, v);
          }
          await pluginsDiskStore.save();
        }

        // User Profile & Adaptive Listening Intelligence
        if (
          syncData.user_profile &&
          Array.isArray(syncData.user_profile) &&
          syncData.user_profile.length > 0
        ) {
          await personalizationEngine.mergeRemoteListens(syncData.user_profile);
        }

        this.isApplyingRemote = false;
      }

      // 2. Also query /api/settings on port 4120 if available
      const pcSettings = await safeFetchJson<{
        shuffle?: boolean;
        repeat?: string;
        discovery?: boolean;
        language?: string;
        dark?: boolean;
        themeId?: string;
      }>(`http://${host}:4120/api/settings`, 2000);

      if (pcSettings) {
        if (pcSettings.shuffle !== undefined) {
          settingsStore.setValue('playback.shuffle', pcSettings.shuffle);
        }
        if (pcSettings.repeat !== undefined) {
          settingsStore.setValue('playback.repeat', pcSettings.repeat);
        }
        if (pcSettings.discovery !== undefined) {
          settingsStore.setValue('playback.discovery', pcSettings.discovery);
        }
        if (pcSettings.language) {
          settingsStore.setValue('general.language', pcSettings.language);
          void changeLanguage(pcSettings.language);
        }
        // Theme is intentionally not synced — each device keeps its own theme
        syncedSettings++;
      }

      await syncStore.set('last_sync_time', Date.now());
      await syncStore.save();
      this.isSyncing = false;
      this.lastSyncFinishedAt = Date.now();

      try {
        defaultQueryClient.invalidateQueries({ queryKey: ['history'] });
        defaultQueryClient.invalidateQueries({ queryKey: ['favorites'] });
        defaultQueryClient.invalidateQueries({ queryKey: ['playlists'] });
      } catch {}

      // Start real-time SSE listener if not running
      this.ensureRealtimeSseConnection(workingUrl);

      return {
        success: true,
        syncedCounts: {
          tracks: syncedTracks,
          artists: syncedArtists,
          settings: syncedSettings,
        },
      };
    } catch (err) {
      this.isSyncing = false;
      this.isApplyingRemote = false;
      this.lastSyncFinishedAt = Date.now();
      return { success: false, error: String(err) };
    }
  }

  private ensureRealtimeSseConnection(serverUrl: string): void {
    if (
      this.eventSource &&
      this.eventSource.readyState !== EventSource.CLOSED
    ) {
      return;
    }

    let sseDebounceTimer: number | null = null;

    try {
      this.eventSource = new EventSource(`${serverUrl}/api/sync/events`);
      this.eventSource.addEventListener('sync:update', () => {
        if (sseDebounceTimer) clearTimeout(sseDebounceTimer);
        sseDebounceTimer = window.setTimeout(() => {
          if (!this.isSyncing) {
            void this.syncNow();
          }
        }, 3000);
      });
      this.eventSource.onerror = () => {
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
      };
    } catch {
      // ignore
    }
  }

  startBackgroundSyncWatcher(): void {
    if (this.syncIntervalTimer) {
      return;
    }

    void this.syncNow();

    this.syncIntervalTimer = window.setInterval(async () => {
      const autoEnabled = await this.isAutoSyncEnabled();
      if (autoEnabled && !this.isSyncing) {
        void this.syncNow();
      }
    }, P2PSyncService.SYNC_INTERVAL_MS);
  }

  stopBackgroundSyncWatcher(): void {
    if (this.syncIntervalTimer) {
      clearInterval(this.syncIntervalTimer);
      this.syncIntervalTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

export const p2pSyncService = new P2PSyncService();
