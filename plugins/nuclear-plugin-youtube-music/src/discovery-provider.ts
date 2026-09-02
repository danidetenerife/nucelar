import type {
  DiscoveryOptions,
  DiscoveryProvider,
  Track,
} from '@nuclearplayer/plugin-sdk';

import { YtMusicClient } from './client';
import { mapSongToTrack } from './mappers';

export const DISCOVERY_PROVIDER_ID = 'youtube-music-discovery';
const DEFAULT_DISCOVERY_LIMIT = 20;

export const createDiscoveryProvider = (
  client: YtMusicClient,
): DiscoveryProvider => ({
  id: DISCOVERY_PROVIDER_ID,
  kind: 'discovery',
  name: 'YouTube Music',

  getRecommendations: async (
    context: Track[],
    options: DiscoveryOptions,
  ): Promise<Track[]> => {
    const limit = options.limit ?? DEFAULT_DISCOVERY_LIMIT;

    if (context.length === 0) {
      const topSongs = await client.searchSongs('Top Global Hits', limit);
      return topSongs.map((song) => mapSongToTrack(song, 'youtube-music'));
    }

    const lastTrack = context[context.length - 1];
    let videoId: string | undefined;

    if (
      lastTrack.source &&
      (lastTrack.source.provider === 'youtube-music' ||
        lastTrack.source.provider === 'youtube-music-streaming') &&
      lastTrack.source.id &&
      !lastTrack.source.id.startsWith('http')
    ) {
      videoId = lastTrack.source.id;
    } else {
      const artistName = lastTrack.artists[0]?.name ?? '';
      const searchQuery = `${artistName} ${lastTrack.title}`.trim();
      const songs = await client.searchSongs(searchQuery, 1);
      videoId = songs[0]?.id;
    }

    if (!videoId) {
      return [];
    }

    const recommendedSongs = await client.getRecommendations(videoId, limit);
    return recommendedSongs.map((song) =>
      mapSongToTrack(song, 'youtube-music'),
    );
  },
});
