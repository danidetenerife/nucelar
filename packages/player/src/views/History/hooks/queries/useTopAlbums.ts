import { useQuery } from '@tanstack/react-query';

import type {
  TimeRange,
  TopAlbum,
} from '../../../../services/tauri/bindings';
import { commands } from '../../../../services/tauri/bindings';
import { unwrapResult } from '../../../../services/tauri/results';
import { isTauriEnvironment } from '../../../../services/universalStore';
import { useFavoritesStore } from '../../../../stores/favoritesStore';

export const useTopAlbums = (range: TimeRange, limit: number) =>
  useQuery({
    queryKey: ['history', 'stats', 'topAlbums', range.from, range.to, limit],
    queryFn: async (): Promise<TopAlbum[]> => {
      if (isTauriEnvironment()) {
        try {
          return unwrapResult(await commands.historyTopAlbums(range, limit));
        } catch {
          // fallback
        }
      }

      const favAlbums = useFavoritesStore.getState().albums || [];
      return favAlbums.slice(0, limit).map((a) => {
        const title = a.ref?.title || 'Álbum';
        const artist = a.ref?.artists?.[0]?.name || '';
        const artworkUrl = a.ref?.artwork?.items?.[0]?.url || null;
        return {
          title,
          artist,
          artworkUrl,
          msPlayed: 600000,
          plays: 3,
        };
      });
    },
  });
