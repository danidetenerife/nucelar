import type {
  Album,
  AlbumRef,
  ArtistBio,
  ArtistRef,
  MetadataProvider,
  SearchParams,
  SearchResults,
  Track,
  TrackRef,
} from '@nuclearplayer/plugin-sdk';

import { YtMusicClient } from './client';
import {
  mapAlbumDetailsToAlbum,
  mapAlbumToAlbumRef,
  mapArtistDetailsToArtistBio,
  mapArtistToArtistRef,
  mapSongToTrack,
  mapSongToTrackRef,
} from './mappers';
import { STREAMING_PROVIDER_ID } from './streaming-provider';

export const METADATA_PROVIDER_ID = 'youtube-music';
const DEFAULT_SEARCH_LIMIT = 20;
const FIRST_INDEX = 0;

const resolveArtistBrowseId = async (
  client: YtMusicClient,
  artistIdOrName: string,
): Promise<string> => {
  if (
    artistIdOrName.startsWith('UC') ||
    artistIdOrName.startsWith('FEmusic_artist_')
  ) {
    return artistIdOrName;
  }
  try {
    const searchResults = await client.searchArtists(artistIdOrName, 5);
    if (searchResults && searchResults.length > 0) {
      const exactMatch = searchResults.find(
        (artist) =>
          artist.name?.toLowerCase() === artistIdOrName.toLowerCase(),
      );
      const match = exactMatch ?? searchResults[FIRST_INDEX];
      if (match?.id) {
        return match.id;
      }
    }
  } catch {
    // ignore
  }
  return artistIdOrName;
};

export const createMetadataProvider = (
  client: YtMusicClient,
): MetadataProvider => ({
  id: METADATA_PROVIDER_ID,
  kind: 'metadata',
  name: 'YouTube Music',
  streamingProviderId: STREAMING_PROVIDER_ID,
  searchCapabilities: ['artists', 'albums', 'tracks', 'unified'],
  artistMetadataCapabilities: [
    'artistBio',
    'artistTopTracks',
    'artistAlbums',
    'artistRelatedArtists',
  ],
  albumMetadataCapabilities: ['albumDetails'],

  search: async (params: SearchParams): Promise<SearchResults> => {
    const limit = params.limit ?? DEFAULT_SEARCH_LIMIT;
    const requestedTypes = params.types ?? [
      'tracks',
      'albums',
      'artists',
    ];

    const results: SearchResults = {};

    const shouldSearchTracks = requestedTypes.includes('tracks');
    const shouldSearchAlbums = requestedTypes.includes('albums');
    const shouldSearchArtists = requestedTypes.includes('artists');

    const tasks: Array<Promise<void>> = [];

    if (shouldSearchTracks) {
      tasks.push(
        client.searchSongs(params.query, limit).then((songs) => {
          results.tracks = songs.map((song) =>
            mapSongToTrack(song, METADATA_PROVIDER_ID),
          );
        }),
      );
    }

    if (shouldSearchAlbums) {
      tasks.push(
        client.searchAlbums(params.query, limit).then((albums) => {
          results.albums = albums.map((album) =>
            mapAlbumToAlbumRef(album, METADATA_PROVIDER_ID),
          );
        }),
      );
    }

    if (shouldSearchArtists) {
      tasks.push(
        client.searchArtists(params.query, limit).then((artists) => {
          results.artists = artists.map((artist) =>
            mapArtistToArtistRef(artist, METADATA_PROVIDER_ID),
          );
        }),
      );
    }

    await Promise.all(tasks);
    return results;
  },

  searchArtists: async (
    params: Omit<SearchParams, 'types'>,
  ): Promise<ArtistRef[]> => {
    const artists = await client.searchArtists(
      params.query,
      params.limit ?? DEFAULT_SEARCH_LIMIT,
    );
    return artists.map((artist) =>
      mapArtistToArtistRef(artist, METADATA_PROVIDER_ID),
    );
  },

  searchAlbums: async (
    params: Omit<SearchParams, 'types'>,
  ): Promise<AlbumRef[]> => {
    const albums = await client.searchAlbums(
      params.query,
      params.limit ?? DEFAULT_SEARCH_LIMIT,
    );
    return albums.map((album) =>
      mapAlbumToAlbumRef(album, METADATA_PROVIDER_ID),
    );
  },

  searchTracks: async (
    params: Omit<SearchParams, 'types'>,
  ): Promise<Track[]> => {
    const songs = await client.searchSongs(
      params.query,
      params.limit ?? DEFAULT_SEARCH_LIMIT,
    );
    return songs.map((song) =>
      mapSongToTrack(song, METADATA_PROVIDER_ID),
    );
  },

  fetchArtistBio: async (artistId: string): Promise<ArtistBio> => {
    const resolvedId = await resolveArtistBrowseId(client, artistId);
    const details = await client.getArtist(resolvedId);
    return mapArtistDetailsToArtistBio(details, METADATA_PROVIDER_ID);
  },

  fetchArtistTopTracks: async (artistId: string): Promise<TrackRef[]> => {
    const resolvedId = await resolveArtistBrowseId(client, artistId);
    const details = await client.getArtist(resolvedId);
    return details.topTracks.map((song) =>
      mapSongToTrackRef(song, METADATA_PROVIDER_ID),
    );
  },

  fetchArtistAlbums: async (artistId: string): Promise<AlbumRef[]> => {
    const resolvedId = await resolveArtistBrowseId(client, artistId);
    const details = await client.getArtist(resolvedId);
    return details.albums.map((album) =>
      mapAlbumToAlbumRef(album, METADATA_PROVIDER_ID),
    );
  },

  fetchArtistRelatedArtists: async (
    artistId: string,
  ): Promise<ArtistRef[]> => {
    const resolvedId = await resolveArtistBrowseId(client, artistId);
    const details = await client.getArtist(resolvedId);
    return details.relatedArtists.map((artist) =>
      mapArtistToArtistRef(artist, METADATA_PROVIDER_ID),
    );
  },

  fetchAlbumDetails: async (albumId: string): Promise<Album> => {
    if (albumId.startsWith('MPRE') || albumId.startsWith('OLAK')) {
      const details = await client.getAlbum(albumId);
      return mapAlbumDetailsToAlbum(details, METADATA_PROVIDER_ID);
    }

    const searchResults = await client.searchAlbums(albumId, 1);
    const firstAlbum = searchResults[FIRST_INDEX];
    if (!firstAlbum) {
      throw new Error(`Album not found: ${albumId}`);
    }

    const details = await client.getAlbum(firstAlbum.id);
    return mapAlbumDetailsToAlbum(details, METADATA_PROVIDER_ID);
  },
});
