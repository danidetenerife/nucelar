import { useQuery } from '@tanstack/react-query';

import { personalizationEngine } from '../../../../services/personalizationEngine';
import type {
  TimeRange,
  TopArtist,
} from '../../../../services/tauri/bindings';
import { commands } from '../../../../services/tauri/bindings';
import { unwrapResult } from '../../../../services/tauri/results';
import { isTauriEnvironment } from '../../../../services/universalStore';
import { useFavoritesStore } from '../../../../stores/favoritesStore';

export const useTopArtists = (range: TimeRange, limit: number) =>
  useQuery({
    queryKey: ['history', 'stats', 'topArtists', range.from, range.to, limit],
    queryFn: async (): Promise<TopArtist[]> => {
      if (isTauriEnvironment()) {
        try {
          return unwrapResult(await commands.historyTopArtists(range, limit));
        } catch {
          // fallback
        }
      }

      const listens = await personalizationEngine.getListenRecords();
      const favArtists = useFavoritesStore.getState().artists || [];
      const artMap = new Map<string, string>();
      for (const fa of favArtists) {
        if (fa.ref && fa.ref.name) {
          const imgUrl = fa.ref.artwork?.items?.[0]?.url;
          if (imgUrl) artMap.set(fa.ref.name.toLowerCase(), imgUrl);
        }
      }

      const artistPlays = new Map<string, number>();
      for (const item of listens) {
        if (item && item.artist) {
          const current = artistPlays.get(item.artist) || 0;
          artistPlays.set(item.artist, current + (item.playCount || 1));
        }
      }

      if (artistPlays.size === 0 && favArtists.length > 0) {
        return favArtists.slice(0, limit).map((fa, i) => ({
          name: fa.ref?.name || 'Artista',
          artworkUrl: fa.ref?.artwork?.items?.[0]?.url || null,
          msPlayed: (10 - i) * 210000,
          plays: 10 - i,
        }));
      }

      const sorted = Array.from(artistPlays.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      return sorted.map(([name, plays]) => ({
        name,
        artworkUrl: artMap.get(name.toLowerCase()) || null,
        msPlayed: plays * 210000,
        plays,
      }));
    },
  });
