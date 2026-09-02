import type {
  Album as NuclearAlbum,
  AlbumRef,
  ArtistBio,
  ArtistRef,
  ArtworkSet,
  Playlist,
  PlaylistItem,
  Track as NuclearTrack,
  TrackRef,
} from '@nuclearplayer/plugin-sdk';

import type {
  AlbumResponseWrapper,
  AlbumUnion,
  Artist,
  ArtistResponseWrapper,
  ArtistSimplified,
  ArtistTopTrack,
  CoverArtSource,
  FullDate,
  PlaylistV2,
  ReleaseItem,
  Track as SourceTrack,
} from './types';

import { PROVIDER_ID } from './index';

const mapCoverArtToArtwork = (
  sources: CoverArtSource[] | undefined,
): ArtworkSet | undefined =>
  sources && sources.length > 0
    ? {
        items: sources.map((source) => ({
          url: source.url,
          width: source.width ?? undefined,
          height: source.height ?? undefined,
        })),
      }
    : undefined;

const mapFullDateToReleaseDate = (
  date: FullDate,
): { precision: 'year' | 'month' | 'day'; dateIso: string } => {
  const precisionMap = {
    DAY: 'day',
    MONTH: 'month',
    YEAR: 'year',
  } as const;

  const dateIso =
    date.isoString ??
    [
      String(date.year),
      date.precision !== 'YEAR'
        ? String(date.month).padStart(2, '0')
        : undefined,
      date.precision === 'DAY'
        ? String(date.day).padStart(2, '0')
        : undefined,
    ]
      .filter(Boolean)
      .join('-');

  return {
    precision: precisionMap[date.precision],
    dateIso,
  };
};

export const mapArtistResponseToRef = (
  wrapper: ArtistResponseWrapper,
): ArtistRef => ({
  name: wrapper.data.profile.name,
  artwork: mapCoverArtToArtwork(wrapper.data.visuals?.avatarImage?.sources),
  source: { provider: PROVIDER_ID, id: wrapper.data.uri },
});

export const mapArtistSimplifiedToRef = (
  artist: ArtistSimplified,
): ArtistRef => ({
  name: artist.profile.name,
  artwork: mapCoverArtToArtwork(artist.visuals?.avatarImage?.sources),
  source: { provider: PROVIDER_ID, id: artist.uri },
});

export const mapAlbumResponseToRef = (
  wrapper: AlbumResponseWrapper,
): AlbumRef => ({
  title: wrapper.data.name,
  artists: wrapper.data.artists.items.map(mapArtistSimplifiedToRef),
  artwork: mapCoverArtToArtwork(wrapper.data.coverArt?.sources),
  source: { provider: PROVIDER_ID, id: wrapper.data.uri },
});

export const mapTrackToNuclearTrack = (
  track: SourceTrack,
): NuclearTrack => ({
  title: track.name,
  artists: track.artists.items.map((artist) => ({
    name: artist.profile.name,
    roles: [],
    source: { provider: PROVIDER_ID, id: artist.uri },
  })),
  album: {
    title: track.albumOfTrack.name,
    artwork: mapCoverArtToArtwork(track.albumOfTrack.coverArt?.sources),
    source: { provider: PROVIDER_ID, id: track.albumOfTrack.uri },
  },
  durationMs: track.duration.totalMilliseconds,
  trackNumber: track.trackNumber,
  disc: String(track.discNumber),
  artwork: mapCoverArtToArtwork(track.albumOfTrack.coverArt?.sources),
  source: { provider: PROVIDER_ID, id: track.uri },
});

export const mapArtistToArtistBio = (artist: Artist): ArtistBio => ({
  name: artist.profile.name,
  bio: artist.profile.biography?.text,
  artwork:
    mapCoverArtToArtwork(artist.visuals?.avatarImage?.sources) ??
    mapCoverArtToArtwork(artist.headerImage?.data.sources),
  source: { provider: PROVIDER_ID, id: artist.uri },
});

export const mapTopTrackToTrackRef = (
  topTrack: ArtistTopTrack,
): TrackRef => ({
  title: topTrack.track.name,
  artists: topTrack.track.artists.items.map(mapArtistSimplifiedToRef),
  artwork: mapCoverArtToArtwork(topTrack.track.albumOfTrack.coverArt?.sources),
  source: { provider: PROVIDER_ID, id: topTrack.track.uri },
});

export const mapReleaseItemToAlbumRef = (
  releaseItem: ReleaseItem,
): AlbumRef => ({
  title: releaseItem.name,
  artwork: mapCoverArtToArtwork(releaseItem.coverArt?.sources),
  source: { provider: PROVIDER_ID, id: releaseItem.uri },
});

export const mapRelatedArtistToRef = (artist: Artist): ArtistRef => ({
  name: artist.profile.name,
  artwork: mapCoverArtToArtwork(artist.visuals?.avatarImage?.sources),
  source: { provider: PROVIDER_ID, id: artist.uri },
});

export const mapAlbumUnionToAlbum = (
  albumUnion: AlbumUnion,
): NuclearAlbum => ({
  title: albumUnion.name,
  artists: albumUnion.artists?.items?.map((artist) => ({
    name: artist.profile.name,
    roles: [],
    source: { provider: PROVIDER_ID, id: artist.uri },
  })) ?? [],
  tracks: albumUnion.tracksV2?.items?.map(({ track }) => ({
    title: track.name,
    artists: track.artists.items.map(mapArtistSimplifiedToRef),
    artwork: mapCoverArtToArtwork(track.albumOfTrack?.coverArt?.sources),
    source: { provider: PROVIDER_ID, id: track.uri },
  })) ?? [],
  releaseDate: albumUnion.date
    ? mapFullDateToReleaseDate(albumUnion.date)
    : undefined,
  artwork: mapCoverArtToArtwork(albumUnion.coverArt?.sources),
  source: { provider: PROVIDER_ID, id: albumUnion.uri },
});

export const mapPlaylistToNuclearPlaylist = (
  playlist: PlaylistV2,
): Playlist => {
  const now = new Date().toISOString();
  return {
    id: playlist.uri,
    name: playlist.name,
    description: playlist.description || undefined,
    artwork: playlist.images?.items?.length > 0
      ? {
          items: playlist.images.items.flatMap((imageItem) =>
            imageItem.sources.map((source) => ({
              url: source.url,
              width: source.width ?? undefined,
              height: source.height ?? undefined,
            })),
          ),
        }
      : undefined,
    createdAtIso: now,
    lastModifiedIso: now,
    origin: { provider: PROVIDER_ID, id: playlist.uri },
    isReadOnly: true,
    items: playlist.content?.items
      ?.filter((contentItem) => contentItem.item?.data?.__typename === 'Track')
      .map((contentItem): PlaylistItem => {
        const trackData = contentItem.item.data;
        return {
          id: contentItem.uid,
          addedAtIso: contentItem.addedAt?.isoString ?? now,
          track: {
            title: trackData.name,
            artists: trackData.artists.items.map((artist) => ({
              name: artist.profile.name,
              roles: [],
              source: { provider: PROVIDER_ID, id: artist.uri },
            })),
            album: {
              title: trackData.albumOfTrack.name,
              artwork: mapCoverArtToArtwork(
                trackData.albumOfTrack.coverArt?.sources,
              ),
              source: {
                provider: PROVIDER_ID,
                id: trackData.albumOfTrack.uri,
              },
            },
            durationMs: trackData.trackDuration.totalMilliseconds,
            trackNumber: trackData.trackNumber,
            disc: String(trackData.discNumber),
            artwork: mapCoverArtToArtwork(
              trackData.albumOfTrack.coverArt?.sources,
            ),
            source: { provider: PROVIDER_ID, id: trackData.uri },
          },
        };
      }) ?? [],
  };
};
