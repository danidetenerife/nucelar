import type {
  Album,
  AlbumRef,
  ArtistBio,
  ArtistCredit,
  ArtistRef,
  ArtworkSet,
  Playlist,
  PlaylistItem,
  PlaylistRef,
  ProviderRef,
  StreamCandidate,
  Track,
  TrackRef,
} from '@nuclearplayer/plugin-sdk';

import type {
  YtMusicAlbum,
  YtMusicAlbumDetails,
  YtMusicArtist,
  YtMusicArtistDetails,
  YtMusicPlaylistDetails,
  YtMusicPlaylistTrack,
  YtMusicSong,
} from './types';

const createProviderRef = (providerId: string, itemId: string): ProviderRef => ({
  provider: providerId,
  id: itemId,
});

const createArtworkSet = (
  imageUrl: string | undefined,
  providerRef: ProviderRef,
): ArtworkSet | undefined => {
  if (!imageUrl) {
    return undefined;
  }
  return {
    items: [
      {
        url: imageUrl,
        purpose: 'cover',
        source: providerRef,
      },
    ],
  };
};

const createArtistCredits = (
  artistNames: string[],
  providerRef: ProviderRef,
): ArtistCredit[] =>
  artistNames.map((name) => ({
    name,
    roles: ['main'],
    source: providerRef,
  }));

const createArtistRefs = (
  artistNames: string[],
  providerRef: ProviderRef,
): ArtistRef[] =>
  artistNames.map((name) => ({
    name,
    source: providerRef,
  }));

export const mapSongToStreamCandidate = (
  song: YtMusicSong,
  providerId: string,
): StreamCandidate => {
  const source = createProviderRef(providerId, song.id);
  return {
    id: song.id,
    title: `${song.artists.join(', ')} - ${song.title}`,
    durationMs: song.durationMs,
    thumbnail: song.thumbnail,
    failed: false,
    source,
  };
};

export const mapSongToTrack = (
  song: YtMusicSong,
  providerId: string,
): Track => {
  const source = createProviderRef(providerId, song.id);
  const artwork = createArtworkSet(song.thumbnail, source);
  const artists = createArtistCredits(song.artists, source);
  const candidate = mapSongToStreamCandidate(song, providerId);

  const albumRef: AlbumRef | undefined = song.album
    ? {
        title: song.album,
        artists: createArtistRefs(song.artists, source),
        source,
      }
    : undefined;

  return {
    title: song.title,
    artists,
    album: albumRef,
    durationMs: song.durationMs,
    artwork,
    source,
    streamCandidates: [candidate],
  };
};

export const mapSongToTrackRef = (
  song: YtMusicSong,
  providerId: string,
): TrackRef => {
  const source = createProviderRef(providerId, song.id);
  const artwork = createArtworkSet(song.thumbnail, source);
  const artists = createArtistRefs(song.artists, source);

  return {
    title: song.title,
    artists,
    artwork,
    source,
  };
};

export const mapAlbumToAlbumRef = (
  album: YtMusicAlbum,
  providerId: string,
): AlbumRef => {
  const source = createProviderRef(providerId, album.id);
  const artwork = createArtworkSet(album.thumbnail, source);
  const artists = createArtistRefs(album.artists, source);

  return {
    title: album.title,
    artists,
    artwork,
    source,
  };
};

export const mapArtistToArtistRef = (
  artist: YtMusicArtist,
  providerId: string,
): ArtistRef => {
  const source = createProviderRef(providerId, artist.id);
  const artwork = createArtworkSet(artist.thumbnail, source);

  return {
    name: artist.name,
    disambiguation: artist.subscribers,
    artwork,
    source,
  };
};

export const mapAlbumDetailsToAlbum = (
  details: YtMusicAlbumDetails,
  providerId: string,
): Album => {
  const source = createProviderRef(providerId, details.id);
  const artwork = createArtworkSet(details.thumbnail, source);
  const artists = createArtistCredits(details.artists, source);

  const tracks: TrackRef[] = details.tracks.map((track) => {
    const trackSource = createProviderRef(providerId, track.id);
    return {
      title: track.title,
      artists: createArtistRefs(track.artists, trackSource),
      source: trackSource,
    };
  });

  return {
    title: details.title,
    artists,
    tracks,
    releaseDate: details.year
      ? {
          precision: 'year',
          dateIso: `${details.year}-01-01`,
        }
      : undefined,
    artwork,
    source,
  };
};

export const mapArtistDetailsToArtistBio = (
  details: YtMusicArtistDetails,
  providerId: string,
): ArtistBio => {
  const source = createProviderRef(providerId, details.id);
  const artwork = createArtworkSet(details.thumbnail, source);

  return {
    name: details.name,
    bio: details.bio,
    artwork,
    source,
  };
};

export const mapPlaylistTrackToTrack = (
  track: YtMusicPlaylistTrack,
  providerId: string,
): Track => {
  const source = createProviderRef(providerId, track.id);
  const artwork = createArtworkSet(track.thumbnail, source);
  const artists = createArtistCredits(track.artists, source);
  const candidate = mapSongToStreamCandidate(
    {
      id: track.id,
      title: track.title,
      artists: track.artists,
      album: track.album,
      durationMs: track.durationMs,
      thumbnail: track.thumbnail,
    },
    'youtube-music-streaming',
  );

  const albumRef: AlbumRef | undefined = track.album
    ? {
        title: track.album,
        artists: createArtistRefs(track.artists, source),
        source,
      }
    : undefined;

  return {
    title: track.title,
    artists,
    album: albumRef,
    durationMs: track.durationMs,
    artwork,
    source,
    streamCandidates: [candidate],
  };
};

export const mapPlaylistDetailsToPlaylistRef = (
  details: YtMusicPlaylistDetails,
  providerId: string,
): PlaylistRef => {
  const source = createProviderRef(providerId, details.id);
  const artwork = createArtworkSet(details.thumbnail, source);

  return {
    id: details.id,
    name: details.title,
    artwork,
    source,
  };
};

export const mapPlaylistDetailsToPlaylist = (
  details: YtMusicPlaylistDetails,
  providerId: string,
): Playlist => {
  const source = createProviderRef(providerId, details.id);
  const artwork = createArtworkSet(details.thumbnail, source);
  const now = new Date().toISOString();

  const items: PlaylistItem[] = details.tracks.map((track) => ({
    id: track.id,
    track: mapPlaylistTrackToTrack(track, providerId),
    addedAtIso: now,
  }));

  return {
    id: details.id,
    name: details.title,
    description: details.description,
    artwork,
    items,
    origin: source,
    isReadOnly: true,
    createdAtIso: now,
    lastModifiedIso: now,
  };
};
