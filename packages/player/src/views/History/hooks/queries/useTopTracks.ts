import { useQuery } from '@tanstack/react-query';

import { personalizationEngine } from '../../../../services/personalizationEngine';
import type {
  TimeRange,
  TopTrack,
} from '../../../../services/tauri/bindings';
import { commands } from '../../../../services/tauri/bindings';
import { unwrapResult } from '../../../../services/tauri/results';
import { isTauriEnvironment } from '../../../../services/universalStore';
import { useFavoritesStore } from '../../../../stores/favoritesStore';

export const useTopTracks = (range: TimeRange, limit: number) =>
  useQuery({
    queryKey: ['history', 'stats', 'topTracks', range.from, range.to, limit],
    queryFn: async (): Promise<TopTrack[]> => {
      if (isTauriEnvironment()) {
        try {
          return unwrapResult(await commands.historyTopTracks(range, limit));
        } catch {
          // fallback
        }
      }

      const listens = await personalizationEngine.getListenRecords();
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

      const sorted = [...listens]
        .sort((a, b) => (b.playCount || 1) - (a.playCount || 1))
        .slice(0, limit);

      if (sorted.length === 0 && favTracks.length > 0) {
        return favTracks.slice(0, limit).map((ft, i) => ({
          title: ft.ref?.title || 'Canción',
          artists: [ft.ref?.artists?.[0]?.name || 'Artista'],
          artworkUrl: ft.ref?.artwork?.items?.[0]?.url || null,
          msPlayed: (10 - i) * 210000,
          plays: 10 - i,
        }));
      }

      return sorted.map((item) => {
        const key = `${item.artist}-${item.title}`.toLowerCase();
        return {
          title: item.title,
          artists: [item.artist],
          artworkUrl: favMap.get(key) || null,
          msPlayed: (item.playCount || 1) * 210000,
          plays: item.playCount || 1,
        };
      });
    },
  });
