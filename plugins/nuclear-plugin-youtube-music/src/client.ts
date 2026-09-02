import type {
  InnerTubeBrowseResponse,
  InnerTubeResponsiveListItem,
  InnerTubeSearchResponse,
  YtMusicAlbum,
  YtMusicAlbumDetails,
  YtMusicAlbumTrack,
  YtMusicArtist,
  YtMusicArtistDetails,
  YtMusicExploreResult,
  YtMusicPlaylistDetails,
  YtMusicPlaylistTrack,
  YtMusicSong,
} from './types';

const YTM_BASE_URL = 'https://music.youtube.com/youtubei/v1';
const CLIENT_NAME = 'WEB_REMIX';
const CLIENT_VERSION = '1.20240101.01.00';
const DEFAULT_LOCALE = 'en';
const DEFAULT_COUNTRY = 'US';

const SONG_SEARCH_PARAMS = 'EgWKAQIIAWoMEA4QChADEAQQCRAF';
const ALBUM_SEARCH_PARAMS = 'EgWKAQIYAWoMEA4QChADEAQQCRAF';
const ARTIST_SEARCH_PARAMS = 'EgWKAQIgAWoMEA4QChADEAQQCRAF';

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const DECIMAL_RADIX = 10;
const FIRST_INDEX = 0;
const SECOND_INDEX = 1;

export const parseDurationToMs = (durationString?: string): number | undefined => {
  if (!durationString) {
    return undefined;
  }

  const parts = durationString
    .trim()
    .split(':')
    .map((segment) => Number.parseInt(segment, DECIMAL_RADIX));

  if (parts.some((segment) => Number.isNaN(segment))) {
    return undefined;
  }

  if (parts.length === 2) {
    const minutes = parts[FIRST_INDEX];
    const seconds = parts[SECOND_INDEX];
    return (minutes * SECONDS_PER_MINUTE + seconds) * MILLISECONDS_PER_SECOND;
  }

  if (parts.length === 3) {
    const hours = parts[FIRST_INDEX];
    const minutes = parts[SECOND_INDEX];
    const seconds = parts[2];
    return (
      (hours * SECONDS_PER_HOUR +
        minutes * SECONDS_PER_MINUTE +
        seconds) *
      MILLISECONDS_PER_SECOND
    );
  }

  return undefined;
};

const extractVideoId = (
  item: InnerTubeResponsiveListItem,
): string | undefined => {
  const watchEndpointId =
    item.overlay?.musicItemThumbnailOverlayRenderer?.content
      ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
  if (watchEndpointId) {
    return watchEndpointId;
  }

  const columnEndpointId =
    item.flexColumns?.[FIRST_INDEX]?.musicResponsiveListItemFlexColumnRenderer
      ?.text?.runs?.[FIRST_INDEX]?.navigationEndpoint?.watchEndpoint?.videoId;
  if (columnEndpointId) {
    return columnEndpointId;
  }

  return item.playlistItemData?.videoId;
};

const extractThumbnailUrl = (
  item: InnerTubeResponsiveListItem,
): string | undefined => {
  const thumbnails =
    item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
  if (!thumbnails || thumbnails.length === 0) {
    return undefined;
  }
  const lastThumbnail = thumbnails[thumbnails.length - 1];
  return lastThumbnail.url;
};

const extractBrowseId = (
  item: InnerTubeResponsiveListItem,
): string | undefined => {
  if (item.navigationEndpoint?.browseEndpoint?.browseId) {
    return item.navigationEndpoint.browseEndpoint.browseId;
  }

  const firstColumn =
    item.flexColumns?.[FIRST_INDEX]?.musicResponsiveListItemFlexColumnRenderer;
  const runs = firstColumn?.text?.runs || [];
  for (const run of runs) {
    if (run.navigationEndpoint?.browseEndpoint?.browseId) {
      return run.navigationEndpoint.browseEndpoint.browseId;
    }
  }

  const secondColumn =
    item.flexColumns?.[SECOND_INDEX]?.musicResponsiveListItemFlexColumnRenderer;
  const secondRuns = secondColumn?.text?.runs || [];
  for (const run of secondRuns) {
    if (run.navigationEndpoint?.browseEndpoint?.browseId) {
      return run.navigationEndpoint.browseEndpoint.browseId;
    }
  }

  return undefined;
};

type FetchFunction = (
  url: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export class YtMusicClient {
  private fetchImplementation: FetchFunction;

  constructor(fetchImplementation?: FetchFunction) {
    this.fetchImplementation = fetchImplementation ?? fetch;
  }

  private async postRequest<T>(
    endpoint: string,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const requestUrl = `${YTM_BASE_URL}/${endpoint}`;
    const requestBody = {
      context: {
        client: {
          clientName: CLIENT_NAME,
          clientVersion: CLIENT_VERSION,
          hl: DEFAULT_LOCALE,
          gl: DEFAULT_COUNTRY,
        },
      },
      ...payload,
    };

    const response = await this.fetchImplementation(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(
        `YouTube Music API request failed: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as T;
  }

  async searchSongs(
    query: string,
    resultLimit = 20,
  ): Promise<YtMusicSong[]> {
    const response = await this.postRequest<InnerTubeSearchResponse>('search', {
      query,
      params: SONG_SEARCH_PARAMS,
    });

    const sections =
      response.contents?.tabbedSearchResultsRenderer?.tabs?.[FIRST_INDEX]
        ?.tabRenderer?.content?.sectionListRenderer?.contents || [];

    const musicShelf = sections.find((section) => section.musicShelfRenderer)
      ?.musicShelfRenderer;
    if (!musicShelf || !musicShelf.contents) {
      return [];
    }

    const songs: YtMusicSong[] = [];

    for (const entry of musicShelf.contents) {
      const item = entry.musicResponsiveListItemRenderer;
      if (!item) {
        continue;
      }

      const videoId = extractVideoId(item);
      if (!videoId) {
        continue;
      }

      const title =
        item.flexColumns?.[FIRST_INDEX]
          ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[FIRST_INDEX]
          ?.text ?? 'Unknown Title';

      const secondaryRuns =
        item.flexColumns?.[SECOND_INDEX]
          ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];

      const artists: string[] = [];
      let album: string | undefined;
      let durationText: string | undefined;

      for (const run of secondaryRuns) {
        const pageType =
          run.navigationEndpoint?.browseEndpoint
            ?.browseEndpointContextSupportedConfigs
            ?.browseEndpointContextMusicConfig?.pageType;

        if (pageType === 'MUSIC_PAGE_TYPE_ARTIST') {
          artists.push(run.text);
        } else if (pageType === 'MUSIC_PAGE_TYPE_ALBUM') {
          album = run.text;
        } else if (/^\d+:\d+(:\d+)?$/.test(run.text.trim())) {
          durationText = run.text.trim();
        }
      }

      if (artists.length === 0 && secondaryRuns.length > 0) {
        const firstRunText = secondaryRuns[FIRST_INDEX]?.text?.trim();
        if (firstRunText && firstRunText !== '•') {
          artists.push(firstRunText);
        }
      }

      const thumbnail = extractThumbnailUrl(item);
      const durationMs = parseDurationToMs(durationText);

      songs.push({
        id: videoId,
        title,
        artists: artists.length > 0 ? artists : ['Unknown Artist'],
        album,
        durationMs,
        thumbnail,
      });

      if (songs.length >= resultLimit) {
        break;
      }
    }

    return songs;
  }

  async searchAlbums(
    query: string,
    resultLimit = 20,
  ): Promise<YtMusicAlbum[]> {
    const response = await this.postRequest<InnerTubeSearchResponse>('search', {
      query,
      params: ALBUM_SEARCH_PARAMS,
    });

    const sections =
      response.contents?.tabbedSearchResultsRenderer?.tabs?.[FIRST_INDEX]
        ?.tabRenderer?.content?.sectionListRenderer?.contents || [];

    const musicShelf = sections.find((section) => section.musicShelfRenderer)
      ?.musicShelfRenderer;
    if (!musicShelf || !musicShelf.contents) {
      return [];
    }

    const albums: YtMusicAlbum[] = [];

    for (const entry of musicShelf.contents) {
      const item = entry.musicResponsiveListItemRenderer;
      if (!item) {
        continue;
      }

      const browseId = extractBrowseId(item);
      if (!browseId) {
        continue;
      }

      const title =
        item.flexColumns?.[FIRST_INDEX]
          ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[FIRST_INDEX]
          ?.text ?? 'Unknown Album';

      const secondaryRuns =
        item.flexColumns?.[SECOND_INDEX]
          ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];

      const artists: string[] = [];
      let releaseYear: string | undefined;

      for (const run of secondaryRuns) {
        const text = run.text.trim();
        if (/^\d{4}$/.test(text)) {
          releaseYear = text;
        } else if (
          text !== '•' &&
          text.toLowerCase() !== 'album' &&
          text.toLowerCase() !== 'ep' &&
          text.toLowerCase() !== 'single'
        ) {
          artists.push(text);
        }
      }

      const thumbnail = extractThumbnailUrl(item);

      albums.push({
        id: browseId,
        title,
        artists: artists.length > 0 ? artists : ['Unknown Artist'],
        year: releaseYear,
        thumbnail,
      });

      if (albums.length >= resultLimit) {
        break;
      }
    }

    return albums;
  }

  async searchArtists(
    query: string,
    resultLimit = 10,
  ): Promise<YtMusicArtist[]> {
    const response = await this.postRequest<InnerTubeSearchResponse>('search', {
      query,
      params: ARTIST_SEARCH_PARAMS,
    });

    const sections =
      response.contents?.tabbedSearchResultsRenderer?.tabs?.[FIRST_INDEX]
        ?.tabRenderer?.content?.sectionListRenderer?.contents || [];

    const musicShelf = sections.find((section) => section.musicShelfRenderer)
      ?.musicShelfRenderer;
    if (!musicShelf || !musicShelf.contents) {
      return [];
    }

    const artists: YtMusicArtist[] = [];

    for (const entry of musicShelf.contents) {
      const item = entry.musicResponsiveListItemRenderer;
      if (!item) {
        continue;
      }

      const browseId = extractBrowseId(item);
      if (!browseId) {
        continue;
      }

      const name =
        item.flexColumns?.[FIRST_INDEX]
          ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[FIRST_INDEX]
          ?.text ?? 'Unknown Artist';

      const secondaryRuns =
        item.flexColumns?.[SECOND_INDEX]
          ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];

      let subscribersText: string | undefined;
      for (const run of secondaryRuns) {
        const text = run.text.trim();
        if (text.toLowerCase().includes('subscribers') || text.toLowerCase().includes('audience')) {
          subscribersText = text;
        }
      }

      const thumbnail = extractThumbnailUrl(item);

      artists.push({
        id: browseId,
        name,
        subscribers: subscribersText,
        thumbnail,
      });

      if (artists.length >= resultLimit) {
        break;
      }
    }

    return artists;
  }

  async getAlbum(browseId: string): Promise<YtMusicAlbumDetails> {
    const response = await this.postRequest<InnerTubeBrowseResponse>('browse', {
      browseId,
    });

    let albumTitle = 'Unknown Album';
    const albumArtists: string[] = [];
    let releaseYear: string | undefined;
    let albumThumbnail: string | undefined;

    const twoColumn = response.contents?.twoColumnBrowseResultsRenderer;
    const tabContents =
      twoColumn?.tabs?.[FIRST_INDEX]?.tabRenderer?.content?.sectionListRenderer
        ?.contents || [];

    const responsiveHeader = tabContents.find(
      (section) => section.musicResponsiveHeaderRenderer,
    )?.musicResponsiveHeaderRenderer;

    if (responsiveHeader) {
      albumTitle =
        responsiveHeader.title?.runs?.[FIRST_INDEX]?.text ?? albumTitle;

      const straplineRuns = responsiveHeader.straplineTextOne?.runs || [];
      for (const run of straplineRuns) {
        const text = run.text.trim();
        if (text && text !== '•') {
          albumArtists.push(text);
        }
      }

      const subtitleRuns = responsiveHeader.subtitle?.runs || [];
      for (const run of subtitleRuns) {
        const text = run.text.trim();
        if (/^\d{4}$/.test(text)) {
          releaseYear = text;
        } else if (
          albumArtists.length === 0 &&
          text !== '•' &&
          text.toLowerCase() !== 'album' &&
          text.toLowerCase() !== 'ep' &&
          text.toLowerCase() !== 'single'
        ) {
          albumArtists.push(text);
        }
      }

      const headerThumbnails =
        responsiveHeader.thumbnail?.musicThumbnailRenderer?.thumbnail
          ?.thumbnails;
      if (headerThumbnails && headerThumbnails.length > 0) {
        albumThumbnail = headerThumbnails[headerThumbnails.length - 1].url;
      }
    }

    const secondaryShelves =
      twoColumn?.secondaryContents?.sectionListRenderer?.contents || [];
    const trackShelf = secondaryShelves.find(
      (section) => section.musicShelfRenderer,
    )?.musicShelfRenderer;

    const rawTrackItems = trackShelf?.contents || [];
    const tracks: YtMusicAlbumTrack[] = [];
    let currentTrackNumber = 1;

    for (const trackEntry of rawTrackItems) {
      const item = trackEntry.musicResponsiveListItemRenderer;
      if (!item) {
        continue;
      }

      const videoId = extractVideoId(item);
      if (!videoId) {
        continue;
      }

      const trackTitle =
        item.flexColumns?.[FIRST_INDEX]
          ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[FIRST_INDEX]
          ?.text ?? `Track ${currentTrackNumber}`;

      const trackSecondaryRuns =
        item.flexColumns?.[SECOND_INDEX]
          ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
      const trackArtists: string[] = [];
      for (const run of trackSecondaryRuns) {
        const text = run.text.trim();
        if (text && text !== '•') {
          trackArtists.push(text);
        }
      }

      const effectiveArtists =
        trackArtists.length > 0
          ? trackArtists
          : albumArtists.length > 0
            ? albumArtists
            : ['Unknown Artist'];

      const fixedRuns =
        item.fixedColumns?.[FIRST_INDEX]
          ?.musicResponsiveListItemFixedColumnRenderer?.text?.runs || [];
      const durationText = fixedRuns[FIRST_INDEX]?.text;
      const durationMs = parseDurationToMs(durationText);

      tracks.push({
        id: videoId,
        title: trackTitle,
        artists: effectiveArtists,
        durationMs,
        trackNumber: currentTrackNumber,
      });

      currentTrackNumber += 1;
    }

    return {
      id: browseId,
      title: albumTitle,
      artists: albumArtists.length > 0 ? albumArtists : ['Unknown Artist'],
      year: releaseYear,
      thumbnail: albumThumbnail,
      tracks,
    };
  }

  async getArtist(browseId: string): Promise<YtMusicArtistDetails> {
    const response = await this.postRequest<InnerTubeBrowseResponse>('browse', {
      browseId,
    });

    const immersiveHeader =
      response.header?.musicImmersiveHeaderRenderer ||
      response.header?.musicVisualHeaderRenderer;

    const artistName =
      immersiveHeader?.title?.runs?.[FIRST_INDEX]?.text ?? 'Unknown Artist';
    const artistBio = immersiveHeader?.description?.runs?.[FIRST_INDEX]?.text;

    let artistThumbnail: string | undefined;
    const thumbnails =
      immersiveHeader?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
    if (thumbnails && thumbnails.length > 0) {
      artistThumbnail = thumbnails[thumbnails.length - 1].url;
    }

    const sections =
      response.contents?.singleColumnBrowseResultsRenderer?.tabs?.[FIRST_INDEX]
        ?.tabRenderer?.content?.sectionListRenderer?.contents || [];

    const topTracks: YtMusicSong[] = [];
    const albums: YtMusicAlbum[] = [];
    const relatedArtists: YtMusicArtist[] = [];

    for (const section of sections) {
      const shelf = section.musicShelfRenderer;
      const carouselShelf = section.musicCarouselShelfRenderer;

      const shelfTitle =
        shelf?.title?.runs?.[FIRST_INDEX]?.text?.toLowerCase() ||
        carouselShelf?.header?.musicCarouselShelfBasicHeaderRenderer?.title
          ?.runs?.[FIRST_INDEX]?.text?.toLowerCase() ||
        '';

      if (shelfTitle.includes('top songs') || shelfTitle.includes('songs')) {
        const items = shelf?.contents || carouselShelf?.contents || [];
        for (const entry of items) {
          const item = entry.musicResponsiveListItemRenderer;
          if (!item) {
            continue;
          }
          const videoId = extractVideoId(item);
          if (!videoId) {
            continue;
          }
          const songTitle =
            item.flexColumns?.[FIRST_INDEX]
              ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[
              FIRST_INDEX
            ]?.text ?? 'Unknown Song';
          const thumbnail = extractThumbnailUrl(item);

          topTracks.push({
            id: videoId,
            title: songTitle,
            artists: [artistName],
            thumbnail,
          });
        }
      } else if (
        shelfTitle.includes('albums') ||
        shelfTitle.includes('singles')
      ) {
        const items = carouselShelf?.contents || [];
        for (const entry of items) {
          const twoRowItem = entry.musicTwoRowItemRenderer;
          if (!twoRowItem) {
            continue;
          }
          const albumBrowseId =
            twoRowItem.navigationEndpoint?.browseEndpoint?.browseId;
          if (!albumBrowseId) {
            continue;
          }
          const albumTitle =
            twoRowItem.title?.runs?.[FIRST_INDEX]?.text ?? 'Unknown Album';
          const albumYear = twoRowItem.subtitle?.runs?.find((run) =>
            /^\d{4}$/.test(run.text.trim()),
          )?.text;
          const albumThumbnails =
            twoRowItem.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail
              ?.thumbnails;
          const thumbnail =
            albumThumbnails && albumThumbnails.length > 0
              ? albumThumbnails[albumThumbnails.length - 1].url
              : undefined;

          albums.push({
            id: albumBrowseId,
            title: albumTitle,
            artists: [artistName],
            year: albumYear,
            thumbnail,
          });
        }
      } else if (
        shelfTitle.includes('fans might also like') ||
        shelfTitle.includes('related')
      ) {
        const items = carouselShelf?.contents || [];
        for (const entry of items) {
          const twoRowItem = entry.musicTwoRowItemRenderer;
          if (!twoRowItem) {
            continue;
          }
          const relatedBrowseId =
            twoRowItem.navigationEndpoint?.browseEndpoint?.browseId;
          if (!relatedBrowseId) {
            continue;
          }
          const relatedName =
            twoRowItem.title?.runs?.[FIRST_INDEX]?.text ?? 'Unknown Artist';
          const relatedThumbnails =
            twoRowItem.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail
              ?.thumbnails;
          const thumbnail =
            relatedThumbnails && relatedThumbnails.length > 0
              ? relatedThumbnails[relatedThumbnails.length - 1].url
              : undefined;

          relatedArtists.push({
            id: relatedBrowseId,
            name: relatedName,
            thumbnail,
          });
        }
      }
    }

    return {
      id: browseId,
      name: artistName,
      bio: artistBio,
      thumbnail: artistThumbnail,
      topTracks,
      albums,
      relatedArtists,
    };
  }

  async getPlaylist(playlistId: string): Promise<YtMusicPlaylistDetails> {
    const browseId = playlistId.startsWith('VL')
      ? playlistId
      : `VL${playlistId}`;
    const response = await this.postRequest<InnerTubeBrowseResponse>('browse', {
      browseId,
    });

    let playlistTitle = 'Unknown Playlist';
    let playlistDescription: string | undefined;
    let playlistAuthor: string | undefined;
    let playlistThumbnail: string | undefined;

    const twoColumn = response.contents?.twoColumnBrowseResultsRenderer;
    const tabContents =
      twoColumn?.tabs?.[FIRST_INDEX]?.tabRenderer?.content?.sectionListRenderer
        ?.contents || [];

    const header =
      tabContents[FIRST_INDEX]?.musicResponsiveHeaderRenderer ??
      response.header?.musicDetailHeaderRenderer ??
      response.header?.musicResponsiveHeaderRenderer;

    if (header) {
      playlistTitle = header.title?.runs?.[FIRST_INDEX]?.text ?? playlistTitle;
      playlistDescription =
        header.subtitle?.runs?.map((run) => run.text).join('') ?? undefined;

      const headerThumbnails =
        header.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
      if (headerThumbnails && headerThumbnails.length > 0) {
        playlistThumbnail =
          headerThumbnails[headerThumbnails.length - 1].url;
      }
    }

    const secondaryShelves =
      twoColumn?.secondaryContents?.sectionListRenderer?.contents || [];
    const playlistShelf = secondaryShelves.find(
      (section) =>
        (section as unknown as { musicPlaylistShelfRenderer?: unknown })
          .musicPlaylistShelfRenderer ?? section.musicShelfRenderer,
    );

    const shelfContent =
      (
        playlistShelf as unknown as {
          musicPlaylistShelfRenderer?: {
            contents?: Array<{
              musicResponsiveListItemRenderer?: InnerTubeResponsiveListItem;
            }>;
          };
        }
      )?.musicPlaylistShelfRenderer?.contents ??
      playlistShelf?.musicShelfRenderer?.contents ??
      [];

    const tracks: YtMusicPlaylistTrack[] = [];

    for (const entry of shelfContent) {
      const item = entry.musicResponsiveListItemRenderer;
      if (!item) {
        continue;
      }

      const videoId = extractVideoId(item);
      if (!videoId) {
        continue;
      }

      const title =
        item.flexColumns?.[FIRST_INDEX]
          ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[FIRST_INDEX]
          ?.text ?? 'Unknown Track';

      const artistRuns =
        item.flexColumns?.[SECOND_INDEX]
          ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];

      const artists: string[] = [];
      let album: string | undefined;

      for (const run of artistRuns) {
        const text = run.text.trim();
        if (
          run.navigationEndpoint?.browseEndpoint
            ?.browseEndpointContextSupportedConfigs
            ?.browseEndpointContextMusicConfig?.pageType ===
          'MUSIC_PAGE_TYPE_ALBUM'
        ) {
          album = text;
        } else if (
          text &&
          text !== '•' &&
          text.toLowerCase() !== 'song' &&
          text.toLowerCase() !== 'video'
        ) {
          artists.push(text);
        }
      }

      const fixedRuns =
        item.fixedColumns?.[FIRST_INDEX]
          ?.musicResponsiveListItemFixedColumnRenderer?.text?.runs || [];
      const durationText = fixedRuns[FIRST_INDEX]?.text;
      const durationMs = parseDurationToMs(durationText);
      const thumbnail = extractThumbnailUrl(item);

      tracks.push({
        id: videoId,
        title,
        artists: artists.length > 0 ? artists : ['Unknown Artist'],
        album,
        durationMs,
        thumbnail,
      });
    }

    return {
      id: playlistId,
      title: playlistTitle,
      description: playlistDescription,
      author: playlistAuthor,
      thumbnail: playlistThumbnail,
      tracks,
    };
  }

  async getExplore(): Promise<YtMusicExploreResult> {
    const response = await this.postRequest<InnerTubeBrowseResponse>('browse', {
      browseId: 'FEmusic_explore',
    });

    const topTracks: YtMusicSong[] = [];
    const newReleases: YtMusicAlbum[] = [];
    const editorialPlaylists: YtMusicPlaylistDetails[] = [];

    const tabs =
      response.contents?.singleColumnBrowseResultsRenderer?.tabs || [];
    const sections =
      tabs[FIRST_INDEX]?.tabRenderer?.content?.sectionListRenderer?.contents ||
      [];

    for (const section of sections) {
      const carousel = section.musicCarouselShelfRenderer;
      if (!carousel) {
        continue;
      }

      const headerTitle =
        carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[
          FIRST_INDEX
        ]?.text?.toLowerCase() || '';

      const items = carousel.contents || [];

      if (
        headerTitle.includes('new') ||
        headerTitle.includes('nuevo') ||
        headerTitle.includes('releases')
      ) {
        for (const item of items) {
          const twoRow = item.musicTwoRowItemRenderer;
          if (!twoRow) {
            continue;
          }
          const browseId =
            twoRow.navigationEndpoint?.browseEndpoint?.browseId;
          if (!browseId) {
            continue;
          }
          const title =
            twoRow.title?.runs?.[FIRST_INDEX]?.text ?? 'Unknown Album';
          const artistName =
            twoRow.subtitle?.runs?.[FIRST_INDEX]?.text ?? 'Unknown Artist';
          const thumbnails =
            twoRow.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail
              ?.thumbnails;
          const thumbnail =
            thumbnails && thumbnails.length > 0
              ? thumbnails[thumbnails.length - 1].url
              : undefined;

          newReleases.push({
            id: browseId,
            title,
            artists: [artistName],
            thumbnail,
          });
        }
      } else if (
        headerTitle.includes('trend') ||
        headerTitle.includes('tendencia') ||
        headerTitle.includes('top')
      ) {
        for (const item of items) {
          const twoRow = item.musicTwoRowItemRenderer;
          const responsiveItem = item.musicResponsiveListItemRenderer;

          if (twoRow) {
            const videoId =
              twoRow.navigationEndpoint?.watchEndpoint?.videoId;
            if (!videoId) {
              continue;
            }
            const title =
              twoRow.title?.runs?.[FIRST_INDEX]?.text ?? 'Unknown Song';
            const artistName =
              twoRow.subtitle?.runs?.[FIRST_INDEX]?.text ?? 'Unknown Artist';
            const thumbnails =
              twoRow.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail
                ?.thumbnails;
            const thumbnail =
              thumbnails && thumbnails.length > 0
                ? thumbnails[thumbnails.length - 1].url
                : undefined;

            topTracks.push({
              id: videoId,
              title,
              artists: [artistName],
              thumbnail,
            });
          } else if (responsiveItem) {
            const videoId = extractVideoId(responsiveItem);
            if (!videoId) {
              continue;
            }
            const title =
              responsiveItem.flexColumns?.[FIRST_INDEX]
                ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[FIRST_INDEX]
                ?.text ?? 'Unknown Song';
            const artistName =
              responsiveItem.flexColumns?.[SECOND_INDEX]
                ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[FIRST_INDEX]
                ?.text ?? 'Unknown Artist';
            const thumbnail = extractThumbnailUrl(responsiveItem);

            topTracks.push({
              id: videoId,
              title,
              artists: [artistName],
              thumbnail,
            });
          }
        }
      } else if (
        headerTitle.includes('mood') ||
        headerTitle.includes('ánimo') ||
        headerTitle.includes('genre') ||
        headerTitle.includes('playlist') ||
        headerTitle.includes('video')
      ) {
        for (const item of items) {
          const twoRow = item.musicTwoRowItemRenderer;
          if (!twoRow) {
            continue;
          }
          const browseId =
            twoRow.navigationEndpoint?.browseEndpoint?.browseId ??
            twoRow.navigationEndpoint?.watchEndpoint?.videoId;
          if (!browseId) {
            continue;
          }
          const title =
            twoRow.title?.runs?.[FIRST_INDEX]?.text ?? 'Playlist';
          const description =
            twoRow.subtitle?.runs?.[FIRST_INDEX]?.text;
          const thumbnails =
            twoRow.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail
              ?.thumbnails;
          const thumbnail =
            thumbnails && thumbnails.length > 0
              ? thumbnails[thumbnails.length - 1].url
              : undefined;

          editorialPlaylists.push({
            id: browseId,
            title,
            description,
            thumbnail,
            tracks: [],
          });
        }
      }
    }

    if (topTracks.length === 0) {
      const fallback = await this.searchSongs('Top Global Hits', 20);
      topTracks.push(...fallback);
    }

    return { topTracks, newReleases, editorialPlaylists };
  }

  async getRecommendations(
    videoId: string,
    resultLimit = 20,
  ): Promise<YtMusicSong[]> {
    const response = await this.postRequest<{
      contents?: {
        singleColumnMusicWatchNextResultsRenderer?: {
          tabbedRenderer?: {
            watchNextTabbedResultsRenderer?: {
              tabs?: Array<{
                tabRenderer?: {
                  content?: {
                    musicQueueRenderer?: {
                      content?: {
                        playlistPanelRenderer?: {
                          contents?: Array<{
                            playlistPanelVideoRenderer?: {
                              videoId?: string;
                              title?: { runs?: Array<{ text: string }> };
                              longBylineText?: {
                                runs?: Array<{ text: string }>;
                              };
                              thumbnail?: {
                                thumbnails?: Array<{ url: string }>;
                              };
                              lengthText?: { runs?: Array<{ text: string }> };
                            };
                          }>;
                        };
                      };
                    };
                  };
                };
              }>;
            };
          };
        };
      };
    }>('next', {
      videoId,
      playlistId: `RDAMVM${videoId}`,
    });

    const tabs =
      response.contents?.singleColumnMusicWatchNextResultsRenderer
        ?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs || [];
    const queueRenderer =
      tabs[FIRST_INDEX]?.tabRenderer?.content?.musicQueueRenderer;
    const items =
      queueRenderer?.content?.playlistPanelRenderer?.contents || [];

    const recommendations: YtMusicSong[] = [];

    for (const item of items) {
      const renderer = item.playlistPanelVideoRenderer;
      if (!renderer || !renderer.videoId || renderer.videoId === videoId) {
        continue;
      }

      const title = renderer.title?.runs?.[FIRST_INDEX]?.text ?? 'Unknown Song';
      const artistRuns = renderer.longBylineText?.runs || [];
      const artists: string[] = [];
      for (const run of artistRuns) {
        const text = run.text.trim();
        if (text && text !== '•') {
          artists.push(text);
          break;
        }
      }

      const durationText = renderer.lengthText?.runs?.[FIRST_INDEX]?.text;
      const durationMs = parseDurationToMs(durationText);
      const thumbnails = renderer.thumbnail?.thumbnails;
      const thumbnail =
        thumbnails && thumbnails.length > 0
          ? thumbnails[thumbnails.length - 1].url
          : undefined;

      recommendations.push({
        id: renderer.videoId,
        title,
        artists: artists.length > 0 ? artists : ['Unknown Artist'],
        durationMs,
        thumbnail,
      });

      if (recommendations.length >= resultLimit) {
        break;
      }
    }

    return recommendations;
  }
}
