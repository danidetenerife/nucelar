import { create } from 'zustand';

import type {
  AlbumRef,
  ArtistRef,
  ProviderRef,
  Track,
} from '@nuclearplayer/model';
import type { FavoriteEntry, FavoritesData } from '@nuclearplayer/plugin-sdk';

import { createUniversalStore } from '../services/universalStore';

export type { FavoriteEntry, FavoritesData };

const FAVORITES_FILE = 'favorites.json';
const store = createUniversalStore(FAVORITES_FILE);

type RefWithSource = { source: ProviderRef };

type FavoritesState = FavoritesData & {
  loaded: boolean;
  deletedKeys: Record<string, number>;

  loadFromDisk: () => Promise<void>;

  addTrack: (track: Track) => Promise<void>;
  removeTrack: (source: ProviderRef) => Promise<void>;
  isTrackFavorite: (source: ProviderRef) => boolean;

  addAlbum: (ref: AlbumRef) => Promise<void>;
  removeAlbum: (source: ProviderRef) => Promise<void>;
  isAlbumFavorite: (source: ProviderRef) => boolean;

  addArtist: (ref: ArtistRef) => Promise<void>;
  removeArtist: (source: ProviderRef, name?: string) => Promise<void>;
  removeArtistByName: (name: string) => Promise<void>;
  clearArtists: () => Promise<void>;
  isArtistFavorite: (source: ProviderRef, name?: string) => boolean;
};

const matchesSource = (a?: ProviderRef, b?: ProviderRef): boolean =>
  !!a && !!b && a.provider === b.provider && a.id === b.id;

export const normalizeKey = (val?: string): string =>
  (val || '').trim().toLowerCase();

export const matchesArtist = (
  entry: FavoriteEntry<ArtistRef>,
  source?: ProviderRef,
  name?: string,
): boolean => {
  if (source && matchesSource(entry.ref.source, source)) {
    return true;
  }
  const entryName = normalizeKey(entry.ref.name);
  const searchName = normalizeKey(name);
  if (entryName && searchName && entryName === searchName) {
    return true;
  }
  const sourceId = normalizeKey(source?.id);
  const entrySourceId = normalizeKey(entry.ref.source?.id);
  if (sourceId && entrySourceId && sourceId === entrySourceId) {
    return true;
  }
  if (sourceId && entryName && sourceId === entryName) {
    return true;
  }
  if (searchName && entrySourceId && searchName === entrySourceId) {
    return true;
  }
  return false;
};

const saveToDisk = async (): Promise<void> => {
  const state = useFavoritesStore.getState();
  await store.set('favorites.tracks', state.tracks);
  await store.set('favorites.albums', state.albums);
  await store.set('favorites.artists', state.artists);
  await store.set('favorites.deletedKeys', state.deletedKeys);
  await store.save();
};

type FavoritesKey = 'tracks' | 'albums' | 'artists';

const getList = <T extends RefWithSource>(key: FavoritesKey) =>
  useFavoritesStore.getState()[key] as unknown as FavoriteEntry<T>[];

const createAddFavorite =
  <T extends RefWithSource>(key: FavoritesKey) =>
  async (ref: T): Promise<void> => {
    const list = getList<T>(key);
    if (list.some((entry) => matchesSource(entry.ref.source, ref.source))) {
      return;
    }
    const entry: FavoriteEntry<T> = {
      ref,
      addedAtIso: new Date().toISOString(),
    };
    useFavoritesStore.setState({ [key]: [...list, entry] });
    await saveToDisk();
  };

const createRemoveFavorite =
  <T extends RefWithSource>(key: FavoritesKey) =>
  async (source: ProviderRef): Promise<void> => {
    const list = getList<T>(key);
    const deletedKey = `${source.provider}::${source.id}`;
    const deletedKeys = {
      ...useFavoritesStore.getState().deletedKeys,
      [deletedKey]: Date.now(),
    };
    useFavoritesStore.setState({
      [key]: list.filter((entry) => !matchesSource(entry.ref.source, source)),
      deletedKeys,
    });
    await saveToDisk();
  };

const createIsFavorite =
  <T extends RefWithSource>(key: FavoritesKey) =>
  (source: ProviderRef): boolean =>
    getList<T>(key).some((entry) => matchesSource(entry.ref.source, source));

export const useFavoritesStore = create<FavoritesState>(() => ({
  tracks: [],
  albums: [],
  artists: [],
  deletedKeys: {},
  loaded: false,

  loadFromDisk: async () => {
    const tracks =
      (await store.get<FavoriteEntry<Track>[]>('favorites.tracks')) ?? [];
    const albums =
      (await store.get<FavoriteEntry<AlbumRef>[]>('favorites.albums')) ?? [];
    const artists =
      (await store.get<FavoriteEntry<ArtistRef>[]>('favorites.artists')) ?? [];
    const deletedKeys =
      (await store.get<Record<string, number>>('favorites.deletedKeys')) ?? {};

    useFavoritesStore.setState({
      tracks,
      albums,
      artists,
      deletedKeys,
      loaded: true,
    });
  },

  addTrack: createAddFavorite<Track>('tracks'),
  removeTrack: createRemoveFavorite<Track>('tracks'),
  isTrackFavorite: createIsFavorite<Track>('tracks'),

  addAlbum: createAddFavorite<AlbumRef>('albums'),
  removeAlbum: createRemoveFavorite<AlbumRef>('albums'),
  isAlbumFavorite: createIsFavorite<AlbumRef>('albums'),

  addArtist: async (ref: ArtistRef) => {
    const state = useFavoritesStore.getState();
    const existing = state.artists.filter(
      (entry) => !matchesArtist(entry, ref.source, ref.name),
    );
    const entry: FavoriteEntry<ArtistRef> = {
      ref,
      addedAtIso: new Date().toISOString(),
    };
    const deletedKeys = { ...state.deletedKeys };
    delete deletedKeys[`${ref.source.provider}::${ref.source.id}`];
    delete deletedKeys[`artist::${normalizeKey(ref.name)}`];

    useFavoritesStore.setState({
      artists: [...existing, entry],
      deletedKeys,
    });
    await saveToDisk();
  },

  removeArtist: async (source: ProviderRef, name?: string) => {
    const state = useFavoritesStore.getState();
    const now = Date.now();
    const deletedKeys = { ...state.deletedKeys };
    deletedKeys[`${source.provider}::${source.id}`] = now;
    if (name) {
      deletedKeys[`artist::${normalizeKey(name)}`] = now;
    }
    const remaining = state.artists.filter(
      (entry) => !matchesArtist(entry, source, name),
    );
    useFavoritesStore.setState({ artists: remaining, deletedKeys });
    await saveToDisk();
  },

  removeArtistByName: async (name: string) => {
    const state = useFavoritesStore.getState();
    const now = Date.now();
    const deletedKeys = {
      ...state.deletedKeys,
      [`artist::${normalizeKey(name)}`]: now,
    };
    const remaining = state.artists.filter(
      (entry) => normalizeKey(entry.ref.name) !== normalizeKey(name),
    );
    useFavoritesStore.setState({ artists: remaining, deletedKeys });
    await saveToDisk();
  },

  clearArtists: async () => {
    const state = useFavoritesStore.getState();
    const now = Date.now();
    const deletedKeys = { ...state.deletedKeys };
    for (const entry of state.artists) {
      deletedKeys[`${entry.ref.source.provider}::${entry.ref.source.id}`] = now;
      if (entry.ref.name) {
        deletedKeys[`artist::${normalizeKey(entry.ref.name)}`] = now;
      }
    }
    useFavoritesStore.setState({ artists: [], deletedKeys });
    await saveToDisk();
  },

  isArtistFavorite: (source: ProviderRef, name?: string): boolean => {
    const list = useFavoritesStore.getState().artists;
    return list.some((entry) => matchesArtist(entry, source, name));
  },
}));

export const initializeFavoritesStore = async (): Promise<void> => {
  await useFavoritesStore.getState().loadFromDisk();
};
