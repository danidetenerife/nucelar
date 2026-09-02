import type {
  AlbumRef,
  DashboardProvider,
  NuclearPluginAPI,
  PlaylistRef,
  Track,
} from '@nuclearplayer/plugin-sdk';

import { YtMusicClient } from './client';
import {
  mapAlbumToAlbumRef,
  mapSongToTrack,
} from './mappers';

export const DASHBOARD_PROVIDER_ID = 'youtube-music-dashboard';

export const createDashboardProvider = (
  api: NuclearPluginAPI,
  client: YtMusicClient,
): DashboardProvider => ({
  id: DASHBOARD_PROVIDER_ID,
  kind: 'dashboard',
  name: 'Música Personalizada',
  metadataProviderId: 'youtube-music',
  capabilities: ['topTracks', 'newReleases'],

  fetchTopTracks: async (): Promise<Track[]> => {
    try {
      const favArtists = (await api.Favorites.getArtists()) || [];
      const favTracks = (await api.Favorites.getTracks()) || [];

      const artistNames = favArtists
        .map((a) => a.ref?.name)
        .filter((n): n is string => Boolean(n));

      const targetArtists =
        artistNames.length > 0
          ? artistNames
          : ['Alejandro Sanz', 'Christian Nodal', 'Luis Miguel', 'Emmanuel'];

      const accumulatedSongs: Track[] = [];
      const seenIds = new Set<string>();

      for (const ft of favTracks.slice(0, 5)) {
        if (ft.ref && ft.ref.source) {
          seenIds.add(ft.ref.source.id);
          accumulatedSongs.push(ft.ref);
        }
      }

      for (const artist of targetArtists.slice(0, 4)) {
        try {
          const songs = await client.searchSongs(artist, 6);
          for (const s of songs) {
            if (!seenIds.has(s.id)) {
              seenIds.add(s.id);
              accumulatedSongs.push(mapSongToTrack(s, 'youtube-music'));
            }
          }
        } catch {
          // ignore
        }
      }

      return accumulatedSongs;
    } catch {
      return [];
    }
  },

  fetchNewReleases: async (): Promise<AlbumRef[]> => {
    try {
      const favArtists = (await api.Favorites.getArtists()) || [];
      const artistNames = favArtists
        .map((a) => a.ref?.name)
        .filter((n): n is string => Boolean(n));

      const targetArtists =
        artistNames.length > 0
          ? artistNames
          : ['Alejandro Sanz', 'Christian Nodal', 'Luis Miguel'];

      const accumulatedAlbums: AlbumRef[] = [];
      const seenIds = new Set<string>();

      for (const artist of targetArtists.slice(0, 6)) {
        try {
          const albums = await client.searchAlbums(artist, 3);
          for (const al of albums) {
            if (!seenIds.has(al.id)) {
              seenIds.add(al.id);
              accumulatedAlbums.push(mapAlbumToAlbumRef(al, 'youtube-music'));
            }
          }
        } catch {
          // ignore
        }
      }

      return accumulatedAlbums;
    } catch {
      return [];
    }
  },

  fetchEditorialPlaylists: async (): Promise<PlaylistRef[]> => {
    return [];
  },
});
