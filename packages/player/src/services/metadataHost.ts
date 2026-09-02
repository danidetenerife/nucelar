import type {
  Album,
  AlbumRef,
  ArtistBio,
  ArtistRef,
  ArtistSocialStats,
  PlaylistRef,
  SearchCategory,
  SearchParams,
  SearchResults,
  TrackRef,
} from '@nuclearplayer/model';
import {
  type ArtistMetadataCapability,
  type MetadataHost,
  type MetadataProvider,
} from '@nuclearplayer/plugin-sdk';

import { providersHost } from './providersHost';
import { Logger } from './logger';
import { errorMessage } from '../utils/errorMessage';

const ALL_CATEGORIES: SearchCategory[] = [
  'artists',
  'albums',
  'tracks',
  'playlists',
];

const onlyCategories = (values: string[] | undefined): SearchCategory[] => {
  if (!values) {
    return [];
  }

  // Dedupe categories and filter out junk
  const set = new Set<SearchCategory>(ALL_CATEGORIES);
  return values.filter((v): v is SearchCategory =>
    set.has(v as SearchCategory),
  );
};

const resolveTypes = (
  provider: MetadataProvider,
  requested: SearchCategory[] | undefined,
): SearchCategory[] => {
  return requested ?? onlyCategories(provider.searchCapabilities);
};

const executeMetadataSearch = async (
  provider: MetadataProvider,
  params: SearchParams,
): Promise<SearchResults> => {
  const unified =
    provider.searchCapabilities?.includes('unified') && provider.search;
  if (unified) {
    return provider.search!(params);
  }

  const types = resolveTypes(provider, params.types);
  const want = new Set(types);

  const artistsPromise =
    want.has('artists') && provider.searchArtists
      ? provider.searchArtists({ query: params.query, limit: params.limit })
      : undefined;
  const albumsPromise =
    want.has('albums') && provider.searchAlbums
      ? provider.searchAlbums({ query: params.query, limit: params.limit })
      : undefined;
  const tracksPromise =
    want.has('tracks') && provider.searchTracks
      ? provider.searchTracks({ query: params.query, limit: params.limit })
      : undefined;
  const playlistsPromise =
    want.has('playlists') && provider.searchPlaylists
      ? provider.searchPlaylists({ query: params.query, limit: params.limit })
      : undefined;

  const [artists, albums, tracks, playlists] = await Promise.all([
    artistsPromise ?? Promise.resolve(undefined),
    albumsPromise ?? Promise.resolve(undefined),
    tracksPromise ?? Promise.resolve(undefined),
    playlistsPromise ?? Promise.resolve(undefined),
  ]);

  const result: SearchResults = {};
  if (artists) {
    result.artists = artists;
  }
  if (albums) {
    result.albums = albums;
  }
  if (tracks) {
    result.tracks = tracks;
  }
  if (playlists) {
    result.playlists = playlists;
  }
  return result;
};

export const createMetadataHost = (): MetadataHost => {
  const getProvider = (providerId?: string): MetadataProvider | undefined => {
    let targetId = providerId ?? providersHost.getActive('metadata');
    if (targetId === 'youtube' || targetId === 'nuclear-plugin-youtube-music') {
      targetId = 'youtube-music';
    } else if (targetId === 'nuclear-plugin-something') {
      targetId = 'spotify';
    }
    return (
      providersHost.get<MetadataProvider>(targetId, 'metadata') ??
      (providersHost.list('metadata') as MetadataProvider[])[0]
    );
  };

  const withArtistCapability =
    <TResult>(
      capability: ArtistMetadataCapability,
      method: keyof MetadataProvider,
    ) =>
    async (entityId: string, providerId?: string): Promise<TResult> => {
      const primaryProvider = getProvider(providerId);
      const allProviders = (providersHost.list('metadata') as MetadataProvider[]) ?? [];

      const candidates: MetadataProvider[] = [];
      if (primaryProvider) {
        candidates.push(primaryProvider);
      }
      for (const p of allProviders) {
        if (!candidates.some((c) => c.id === p.id)) {
          candidates.push(p);
        }
      }

      const capableProviders = candidates.filter((p) =>
        p.artistMetadataCapabilities?.includes(capability),
      );

      if (capableProviders.length === 0) {
        throw new Error('No capable metadata provider available');
      }

      let lastError: unknown;
      for (const provider of capableProviders) {
        try {
          const fn = provider[method] as ((id: string) => Promise<TResult>) | undefined;
          if (fn) {
            const result = await fn(entityId);
            if (result) {
              return result;
            }
          }
        } catch (error) {
          lastError = error;
          Logger.metadata.error(
            `Failed to fetch artist ${capability} using provider "${provider.id}" for "${entityId}": ${errorMessage(error)}`,
          );
        }
      }

      throw lastError ?? new Error(`Failed to fetch artist ${capability}`);
    };

  return {
    search: async (
      params: SearchParams,
      providerId?: string,
    ): Promise<SearchResults> => {
      const provider = getProvider(providerId);
      if (!provider) {
        throw new Error('No metadata provider available');
      }
      return executeMetadataSearch(provider, params);
    },

    fetchArtistBio: withArtistCapability<ArtistBio>(
      'artistBio',
      'fetchArtistBio',
    ),
    fetchArtistSocialStats: withArtistCapability<ArtistSocialStats>(
      'artistSocialStats',
      'fetchArtistSocialStats',
    ),
    fetchArtistAlbums: withArtistCapability<AlbumRef[]>(
      'artistAlbums',
      'fetchArtistAlbums',
    ),
    fetchArtistTopTracks: withArtistCapability<TrackRef[]>(
      'artistTopTracks',
      'fetchArtistTopTracks',
    ),
    fetchArtistPlaylists: withArtistCapability<PlaylistRef[]>(
      'artistPlaylists',
      'fetchArtistPlaylists',
    ),
    fetchArtistRelatedArtists: withArtistCapability<ArtistRef[]>(
      'artistRelatedArtists',
      'fetchArtistRelatedArtists',
    ),

    fetchAlbumDetails: async (
      albumId: string,
      providerId?: string,
    ): Promise<Album> => {
      const primaryProvider = getProvider(providerId);
      const allProviders = (providersHost.list('metadata') as MetadataProvider[]) ?? [];

      const candidates: MetadataProvider[] = [];
      if (primaryProvider) {
        candidates.push(primaryProvider);
      }
      for (const p of allProviders) {
        if (!candidates.some((c) => c.id === p.id)) {
          candidates.push(p);
        }
      }

      const capableProviders = candidates.filter((p) =>
        p.albumMetadataCapabilities?.includes('albumDetails'),
      );

      if (capableProviders.length === 0) {
        throw new Error('No capable metadata provider available');
      }

      let lastError: unknown;
      for (const provider of capableProviders) {
        try {
          if (provider.fetchAlbumDetails) {
            const result = await provider.fetchAlbumDetails(albumId);
            if (result) {
              return result;
            }
          }
        } catch (error) {
          lastError = error;
          Logger.metadata.error(
            `Failed to fetch album details using provider "${provider.id}" for "${albumId}": ${errorMessage(error)}`,
          );
        }
      }

      throw lastError ?? new Error('Failed to fetch album details');
    },
  };
};

export const metadataHost = createMetadataHost();
