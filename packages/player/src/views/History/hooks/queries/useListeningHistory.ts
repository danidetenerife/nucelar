import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { personalizationEngine } from '../../../../services/personalizationEngine';
import type {
  HistoryEntry,
  Page,
  PageRequest,
} from '../../../../services/tauri/bindings';
import { commands } from '../../../../services/tauri/bindings';
import { unwrapResult } from '../../../../services/tauri/results';
import { isTauriEnvironment } from '../../../../services/universalStore';
import { useFavoritesStore } from '../../../../stores/favoritesStore';

export const useListeningHistory = (page: PageRequest) =>
  useQuery({
    queryKey: ['history', 'entries', page.limit, page.offset],
    queryFn: async (): Promise<Page<HistoryEntry>> => {
      if (isTauriEnvironment()) {
        try {
          return unwrapResult(await commands.historyFetch(page));
        } catch {
          // fallback to local profile if tauri fails
        }
      }

      const rawListens = await personalizationEngine.getListenRecords();
      const favTracks = useFavoritesStore.getState().tracks || [];
      const favMap = new Map<string, string>();
      for (const ft of favTracks) {
        if (ft.ref) {
          const art = ft.ref.artists?.[0]?.name || '';
          const key = `${art}-${ft.ref.title}`.toLowerCase();
          const artUrl = ft.ref.artwork?.items?.[0]?.url;
          if (artUrl) favMap.set(key, artUrl);
        }
      }

      let allListens = [...rawListens];
      if (allListens.length === 0 && favTracks.length > 0) {
        allListens = favTracks.map((ft, idx) => ({
          trackId: ft.ref?.source?.id || `fav-${idx}`,
          title: ft.ref?.title || 'Canción',
          artist: ft.ref?.artists?.[0]?.name || 'Artista',
          playCount: 1,
          skipCount: 0,
          totalListenMs: 180_000,
          durationMs: 180_000,
          lastPlayedAt: Date.now() - idx * 60000,
          firstPlayedAt: Date.now() - idx * 60000,
        }));
      }

      const total = allListens.length;
      const sliced = allListens.slice(page.offset, page.offset + page.limit);
      const items: HistoryEntry[] = sliced.map((item, idx) => {
        const key = `${item.artist}-${item.title}`.toLowerCase();
        const artworkUrl = favMap.get(key) || null;
        return {
          playId: `mobile-history-${item.trackId || idx}-${item.lastPlayedAt || idx}`,
          title: item.title,
          artists: [item.artist],
          albumTitle: null,
          durationMs: 210000,
          artworkUrl,
          provider: 'youtube-music',
          providerId: item.trackId,
          startedAt: item.lastPlayedAt || Date.now() - idx * 60000,
          msPlayed: 210000,
          endReason: 'finished',
          endPositionMs: 210000,
        };
      });

      return { items, total };
    },
    placeholderData: keepPreviousData,
  });
