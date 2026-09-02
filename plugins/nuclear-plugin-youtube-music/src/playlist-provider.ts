import type {
  Playlist,
  PlaylistProvider,
} from '@nuclearplayer/plugin-sdk';

import { YtMusicClient } from './client';
import { mapPlaylistDetailsToPlaylist } from './mappers';

export const PLAYLIST_PROVIDER_ID = 'youtube-music-playlists';

const YOUTUBE_PLAYLIST_PATTERNS = [
  /music\.youtube\.com\/playlist\?.*list=([a-zA-Z0-9_-]+)/i,
  /youtube\.com\/playlist\?.*list=([a-zA-Z0-9_-]+)/i,
  /youtu\.be\/.*list=([a-zA-Z0-9_-]+)/i,
];

export const extractPlaylistIdFromUrl = (url: string): string | undefined => {
  for (const pattern of YOUTUBE_PLAYLIST_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  try {
    const parsed = new URL(url);
    const listParam = parsed.searchParams.get('list');
    if (listParam) {
      return listParam;
    }
  } catch {
    return undefined;
  }

  return undefined;
};

export const createPlaylistProvider = (
  client: YtMusicClient,
): PlaylistProvider => ({
  id: PLAYLIST_PROVIDER_ID,
  kind: 'playlists',
  name: 'YouTube Music',

  matchesUrl: (url: string): boolean => {
    return Boolean(extractPlaylistIdFromUrl(url));
  },

  fetchPlaylistByUrl: async (url: string): Promise<Playlist> => {
    const playlistId = extractPlaylistIdFromUrl(url);
    if (!playlistId) {
      throw new Error(`Invalid YouTube Music playlist URL: ${url}`);
    }

    const playlistDetails = await client.getPlaylist(playlistId);
    return mapPlaylistDetailsToPlaylist(playlistDetails, 'youtube-music');
  },
});
