import type {
  NuclearPluginAPI,
  Stream,
  StreamCandidate,
  StreamingProvider,
  Track,
} from '@nuclearplayer/plugin-sdk';

import { YtMusicClient } from './client';
import { mapSongToStreamCandidate } from './mappers';

export const STREAMING_PROVIDER_ID = 'youtube-music-streaming';
const DEFAULT_STREAMING_SEARCH_LIMIT = 10;
const MILLISECONDS_PER_SECOND = 1000;

export const createStreamingProvider = (
  api: NuclearPluginAPI,
  client: YtMusicClient,
): StreamingProvider => ({
  id: STREAMING_PROVIDER_ID,
  kind: 'streaming',
  name: 'YouTube Music',

  searchForTrack: async (
    artist: string,
    title: string,
  ): Promise<StreamCandidate[]> => {
    const searchQuery = `${artist} ${title}`.trim();
    const songs = await client.searchSongs(
      searchQuery,
      DEFAULT_STREAMING_SEARCH_LIMIT,
    );

    return songs.map((song) =>
      mapSongToStreamCandidate(song, STREAMING_PROVIDER_ID),
    );
  },

  searchForTrackV2: async (track: Track): Promise<StreamCandidate[]> => {
    const candidates: StreamCandidate[] = [];

    if (
      (track.source?.provider === STREAMING_PROVIDER_ID ||
        track.source?.provider === 'youtube-music') &&
      track.source?.id &&
      !track.source.id.startsWith('http') &&
      track.source.id.length > 5
    ) {
      const artistNames = track.artists.map((artist) => artist.name).join(', ');
      candidates.push({
        id: track.source.id,
        title: artistNames ? `${artistNames} - ${track.title}` : track.title,
        durationMs: track.durationMs,
        failed: false,
        source: {
          provider: STREAMING_PROVIDER_ID,
          id: track.source.id,
        },
      });
    }

    const artistName = track.artists[0]?.name ?? '';
    const searchQuery = artistName ? `${artistName} ${track.title}` : track.title;
    const songs = await client.searchSongs(
      searchQuery.trim(),
      DEFAULT_STREAMING_SEARCH_LIMIT,
    );

    for (const song of songs) {
      if (!candidates.some((existing) => existing.id === song.id)) {
        candidates.push(mapSongToStreamCandidate(song, STREAMING_PROVIDER_ID));
      }
    }

    return candidates;
  },

  getStreamUrl: async (candidateId: string): Promise<Stream> => {
    const streamTarget = candidateId.startsWith('http')
      ? candidateId
      : `https://www.youtube.com/watch?v=${candidateId}`;
    const streamInfo = await api.Ytdlp.getStream(streamTarget);

    return {
      url: streamInfo.stream_url,
      protocol: 'https',
      durationMs: streamInfo.duration
        ? streamInfo.duration * MILLISECONDS_PER_SECOND
        : undefined,
      container: streamInfo.container ?? undefined,
      codec: streamInfo.codec ?? undefined,
      source: {
        provider: STREAMING_PROVIDER_ID,
        id: candidateId,
      },
    };
  },
});
