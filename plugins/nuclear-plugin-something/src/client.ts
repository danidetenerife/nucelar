import type { FetchFunction } from '@nuclearplayer/plugin-sdk';

import type {
  AlbumResponseWrapper,
  AlbumUnion,
  Artist,
  ArtistResponseWrapper,
  ArtistTopTrack,
  NotFound,
  OperationName,
  PreReleaseResponseWrapper,
  PathfinderArtistOverviewResponse,
  PathfinderGetAlbumResponse,
  PathfinderPlaylistResponse,
  PathfinderSearchResponse,
  PlaylistV2,
  ReleaseItem,
  Track,
} from './types';

import { AuthClient, BROWSER_HEADERS } from './auth';

const decode = (encoded: string): string => atob(encoded);

const PATHFINDER_URL = decode('aHR0cHM6Ly9hcGktcGFydG5lci5zcG90aWZ5LmNvbS9wYXRoZmluZGVyL3YyL3F1ZXJ5');
const PLAYLIST_URI_PREFIX = decode('c3BvdGlmeTpwbGF5bGlzdDo=');
const PLAYLIST_HOSTNAME = decode('b3Blbi5zcG90aWZ5LmNvbQ==');

export const isPlaylistUrl = (url: string): boolean => {
  try {
    if (url.startsWith(PLAYLIST_URI_PREFIX)) {
      return true;
    }
    const parsed = new URL(url);
    return (
      parsed.hostname === PLAYLIST_HOSTNAME &&
      /^\/playlist\/[a-zA-Z0-9]+/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
};

const extractPlaylistUri = (url: string): string => {
  if (url.startsWith(PLAYLIST_URI_PREFIX)) {
    return url;
  }
  const parsed = new URL(url);
  const playlistId = parsed.pathname.split('/')[2];
  return `${PLAYLIST_URI_PREFIX}${playlistId}`;
};

const OPERATION_HASHES: Record<OperationName, string> = {
  searchArtists: '0e6f9020a66fe15b93b3bb5c7e6484d1d8cb3775963996eaede72bac4d97e909',
  searchAlbums: 'a71d2c993fc98e1c880093738a55a38b57e69cc4ce5a8c113e6c5920f9513ee2',
  searchTracks: 'bc1ca2fcd0ba1013a0fc88e6cc4f190af501851e3dafd3e1ef85840297694428',
  queryArtistOverview: '1ac33ddab5d39a3a9c27802774e6d78b9405cc188c6f75aed007df2a32737c72',
  queryArtistDiscographyAll: '5e07d323febb57b4a56a42abbf781490e58764aa45feb6e3dc0591564fc56599',
  getAlbum: '97dd13a1f28c80d66115a13697a7ffd94fe3bebdb94da42159456e1d82bfee76',
  fetchPlaylist: 'e578eda4f77aae54294a48eac85e2a42ddb203faf6ea12b3fddaec5aa32918a3',
  fetchPlaylistContents: 'c56c706a062f82052d87fdaeeb300a258d2d54153222ef360682a0ee625284d9',
};

type ArtistCacheEntry = {
  data: Artist;
  fetchedAt: number;
};

const isNotFound = (data: Track | NotFound): data is NotFound =>
  data.__typename === 'NotFound';

const isAlbumResponse = (
  item: AlbumResponseWrapper | PreReleaseResponseWrapper,
): item is AlbumResponseWrapper => item.__typename === 'AlbumResponseWrapper';

const searchVariables = (searchTerm: string, limit: number) => ({
  searchTerm,
  limit,
  offset: 0,
  numberOfTopResults: limit,
  includeAudiobooks: false,
  includeArtistHasConcertsField: false,
  includePreReleases: false,
});

export class MetadataClient {
  private readonly auth: AuthClient;
  private artistOverviewCache: Map<string, ArtistCacheEntry> = new Map();
  private static readonly ARTIST_CACHE_TTL_MS = 60_000;

  constructor(private readonly fetch: FetchFunction) {
    this.auth = new AuthClient(fetch);
  }

  async searchArtists(query: string, limit: number): Promise<ArtistResponseWrapper[]> {
    const response = await this.pathfinderQuery<PathfinderSearchResponse>(
      'searchArtists',
      searchVariables(query, limit),
    );
    return response.data.searchV2.artists.items;
  }

  async searchAlbums(query: string, limit: number): Promise<AlbumResponseWrapper[]> {
    const response = await this.pathfinderQuery<PathfinderSearchResponse>(
      'searchAlbums',
      searchVariables(query, limit),
    );
    return response.data.searchV2.albumsV2.items.filter(isAlbumResponse);
  }

  async searchTracks(query: string, limit: number): Promise<Track[]> {
    const response = await this.pathfinderQuery<PathfinderSearchResponse>(
      'searchTracks',
      searchVariables(query, limit),
    );
    return response.data.searchV2.tracksV2.items
      .filter((wrapper) => !isNotFound(wrapper.item.data))
      .map((wrapper) => wrapper.item.data as Track);
  }

  async resolveArtistUri(artistUriOrName: string): Promise<string> {
    if (artistUriOrName.startsWith('spotify:artist:')) {
      return artistUriOrName;
    }
    const cached = this.artistOverviewCache.get(artistUriOrName);
    if (cached && Date.now() - cached.fetchedAt < MetadataClient.ARTIST_CACHE_TTL_MS) {
      return cached.data.uri;
    }
    try {
      const searchResults = await this.searchArtists(artistUriOrName, 5);
      if (searchResults && searchResults.length > 0) {
        const exactMatch = searchResults.find(
          (item) =>
            item.data?.profile?.name?.toLowerCase() ===
            artistUriOrName.toLowerCase(),
        );
        const match = exactMatch ?? searchResults[0];
        if (match?.data?.uri) {
          return match.data.uri;
        }
      }
    } catch {
      // ignore
    }
    return artistUriOrName.startsWith('spotify:')
      ? artistUriOrName
      : `spotify:artist:${artistUriOrName}`;
  }

  async getArtistOverview(artistUriOrName: string): Promise<Artist> {
    const cached = this.artistOverviewCache.get(artistUriOrName);
    if (cached && Date.now() - cached.fetchedAt < MetadataClient.ARTIST_CACHE_TTL_MS) {
      return cached.data;
    }

    const artistUri = await this.resolveArtistUri(artistUriOrName);
    const cachedUri = this.artistOverviewCache.get(artistUri);
    if (cachedUri && Date.now() - cachedUri.fetchedAt < MetadataClient.ARTIST_CACHE_TTL_MS) {
      return cachedUri.data;
    }

    const response = await this.pathfinderQuery<PathfinderArtistOverviewResponse>(
      'queryArtistOverview',
      { uri: artistUri, locale: '' },
    );
    const artist = response.data.artistUnion;
    this.artistOverviewCache.set(artistUriOrName, { data: artist, fetchedAt: Date.now() });
    this.artistOverviewCache.set(artistUri, { data: artist, fetchedAt: Date.now() });
    return artist;
  }

  async getArtistTopTracks(artistUri: string): Promise<ArtistTopTrack[]> {
    const artist = await this.getArtistOverview(artistUri);
    return artist.discography.topTracks.items;
  }

  async getArtistAlbums(artistUriOrName: string): Promise<ReleaseItem[]> {
    const artistUri = await this.resolveArtistUri(artistUriOrName);
    const response = await this.pathfinderQuery<PathfinderArtistOverviewResponse>(
      'queryArtistDiscographyAll',
      { uri: artistUri, order: 'DATE_DESC', limit: 50, offset: 0 },
    );
    const discographyAll = response.data.artistUnion.discography.all;
    if (!discographyAll) {
      return [];
    }
    return discographyAll.items.map((entry) => entry.releases.items[0]);
  }

  async getRelatedArtists(artistUri: string): Promise<Artist[]> {
    const artist = await this.getArtistOverview(artistUri);
    return artist.relatedContent.relatedArtists.items;
  }

  async getAlbum(albumUri: string): Promise<AlbumUnion> {
    const response = await this.pathfinderQuery<PathfinderGetAlbumResponse>(
      'getAlbum',
      { uri: albumUri, locale: '', offset: 0, limit: 50 },
    );
    return response.data.albumUnion;
  }

  async getPlaylist(playlistUrl: string, limit = 50, offset = 0): Promise<PlaylistV2> {
    const uri = extractPlaylistUri(playlistUrl);
    const response = await this.pathfinderQuery<PathfinderPlaylistResponse>(
      'fetchPlaylist',
      { uri, offset, limit },
    );
    const playlist = response.data.playlistV2;

    while (playlist.content.items.length < playlist.content.totalCount) {
      const nextOffset = playlist.content.items.length;
      const nextPage = await this.pathfinderQuery<PathfinderPlaylistResponse>(
        'fetchPlaylist',
        { uri, offset: nextOffset, limit },
      );
      playlist.content.items.push(...nextPage.data.playlistV2.content.items);
    }

    return playlist;
  }

  async getPlaylistContents(playlistUri: string, limit = 50, offset = 0): Promise<PlaylistV2> {
    const response = await this.pathfinderQuery<PathfinderPlaylistResponse>(
      'fetchPlaylistContents',
      { uri: playlistUri, offset, limit },
    );
    return response.data.playlistV2;
  }

  private async executePathfinderRequest(body: string, token: string): Promise<Response> {
    return this.fetch(PATHFINDER_URL, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body,
    });
  }

  private async pathfinderQuery<T>(
    operationName: OperationName,
    variables: Record<string, unknown>,
  ): Promise<T> {
    const body = JSON.stringify({
      operationName,
      variables,
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: OPERATION_HASHES[operationName],
        },
      },
    });

    const token = await this.auth.getAccessToken();
    const response = await this.executePathfinderRequest(body, token);

    if (response.status === 401) {
      const refreshedToken = await this.auth.refreshAccessToken();
      const retryResponse = await this.executePathfinderRequest(body, refreshedToken);
      if (!retryResponse.ok) {
        throw new Error(`Pathfinder API error: ${retryResponse.status}`);
      }
      return (await retryResponse.json()) as T;
    }

    if (!response.ok) {
      throw new Error(`Pathfinder API error: ${response.status}`);
    }

    return (await response.json()) as T;
  }
}
