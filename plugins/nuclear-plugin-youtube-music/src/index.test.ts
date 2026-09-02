import { describe, expect, it, vi } from 'vitest';

import type { NuclearPluginAPI, YtdlpStreamInfo } from '@nuclearplayer/plugin-sdk';

import { YtMusicClient, parseDurationToMs } from './client';
import {
  DASHBOARD_PROVIDER_ID,
  createDashboardProvider,
} from './dashboard-provider';
import {
  DISCOVERY_PROVIDER_ID,
  createDiscoveryProvider,
} from './discovery-provider';
import plugin from './index';
import { METADATA_PROVIDER_ID, createMetadataProvider } from './metadata-provider';
import {
  PLAYLIST_PROVIDER_ID,
  createPlaylistProvider,
  extractPlaylistIdFromUrl,
} from './playlist-provider';
import { STREAMING_PROVIDER_ID, createStreamingProvider } from './streaming-provider';
import type { InnerTubeBrowseResponse, InnerTubeSearchResponse } from './types';

describe('parseDurationToMs', () => {
  it('parses mm:ss format', () => {
    expect(parseDurationToMs('3:45')).toBe(225000);
    expect(parseDurationToMs('0:30')).toBe(30000);
  });

  it('parses hh:mm:ss format', () => {
    expect(parseDurationToMs('1:02:15')).toBe(3735000);
  });

  it('returns undefined for invalid format', () => {
    expect(parseDurationToMs(undefined)).toBeUndefined();
    expect(parseDurationToMs('invalid')).toBeUndefined();
    expect(parseDurationToMs('1:2:3:4')).toBeUndefined();
  });
});

describe('YtMusicClient', () => {
  it('searches songs and parses results', async () => {
    const mockResponse: InnerTubeSearchResponse = {
      contents: {
        tabbedSearchResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [
                      {
                        musicShelfRenderer: {
                          contents: [
                            {
                              musicResponsiveListItemRenderer: {
                                flexColumns: [
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: {
                                        runs: [{ text: 'Song Title' }],
                                      },
                                    },
                                  },
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: {
                                        runs: [
                                          {
                                            text: 'Artist Name',
                                            navigationEndpoint: {
                                              browseEndpoint: {
                                                browseEndpointContextSupportedConfigs: {
                                                  browseEndpointContextMusicConfig: {
                                                    pageType: 'MUSIC_PAGE_TYPE_ARTIST',
                                                  },
                                                },
                                              },
                                            },
                                          },
                                          { text: ' • ' },
                                          {
                                            text: 'Album Name',
                                            navigationEndpoint: {
                                              browseEndpoint: {
                                                browseEndpointContextSupportedConfigs: {
                                                  browseEndpointContextMusicConfig: {
                                                    pageType: 'MUSIC_PAGE_TYPE_ALBUM',
                                                  },
                                                },
                                              },
                                            },
                                          },
                                          { text: ' • ' },
                                          { text: '3:30' },
                                        ],
                                      },
                                    },
                                  },
                                ],
                                overlay: {
                                  musicItemThumbnailOverlayRenderer: {
                                    content: {
                                      musicPlayButtonRenderer: {
                                        playNavigationEndpoint: {
                                          watchEndpoint: {
                                            videoId: 'video123',
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                                thumbnail: {
                                  musicThumbnailRenderer: {
                                    thumbnail: {
                                      thumbnails: [
                                        { url: 'https://img.test/small.jpg' },
                                        { url: 'https://img.test/large.jpg' },
                                      ],
                                    },
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const client = new YtMusicClient(mockFetch as unknown as typeof fetch);
    const songs = await client.searchSongs('test query', 5);

    expect(songs).toHaveLength(1);
    expect(songs[0]).toEqual({
      id: 'video123',
      title: 'Song Title',
      artists: ['Artist Name'],
      album: 'Album Name',
      durationMs: 210000,
      thumbnail: 'https://img.test/large.jpg',
    });
  });

  it('searches albums and parses results', async () => {
    const mockResponse: InnerTubeSearchResponse = {
      contents: {
        tabbedSearchResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [
                      {
                        musicShelfRenderer: {
                          contents: [
                            {
                              musicResponsiveListItemRenderer: {
                                navigationEndpoint: {
                                  browseEndpoint: {
                                    browseId: 'MPREb_album123',
                                  },
                                },
                                flexColumns: [
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: {
                                        runs: [{ text: 'Album Title' }],
                                      },
                                    },
                                  },
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: {
                                        runs: [
                                          { text: 'Album' },
                                          { text: ' • ' },
                                          { text: 'Artist Name' },
                                          { text: ' • ' },
                                          { text: '2023' },
                                        ],
                                      },
                                    },
                                  },
                                ],
                                thumbnail: {
                                  musicThumbnailRenderer: {
                                    thumbnail: {
                                      thumbnails: [{ url: 'https://img.test/album.jpg' }],
                                    },
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const client = new YtMusicClient(mockFetch as unknown as typeof fetch);
    const albums = await client.searchAlbums('test query', 5);

    expect(albums).toHaveLength(1);
    expect(albums[0]).toEqual({
      id: 'MPREb_album123',
      title: 'Album Title',
      artists: ['Artist Name'],
      year: '2023',
      thumbnail: 'https://img.test/album.jpg',
    });
  });

  it('searches artists and parses results', async () => {
    const mockResponse: InnerTubeSearchResponse = {
      contents: {
        tabbedSearchResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [
                      {
                        musicShelfRenderer: {
                          contents: [
                            {
                              musicResponsiveListItemRenderer: {
                                navigationEndpoint: {
                                  browseEndpoint: {
                                    browseId: 'UC_artist123',
                                  },
                                },
                                flexColumns: [
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: {
                                        runs: [{ text: 'Artist Name' }],
                                      },
                                    },
                                  },
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: {
                                        runs: [{ text: '1.5M subscribers' }],
                                      },
                                    },
                                  },
                                ],
                                thumbnail: {
                                  musicThumbnailRenderer: {
                                    thumbnail: {
                                      thumbnails: [{ url: 'https://img.test/artist.jpg' }],
                                    },
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const client = new YtMusicClient(mockFetch as unknown as typeof fetch);
    const artists = await client.searchArtists('test query', 5);

    expect(artists).toHaveLength(1);
    expect(artists[0]).toEqual({
      id: 'UC_artist123',
      name: 'Artist Name',
      subscribers: '1.5M subscribers',
      thumbnail: 'https://img.test/artist.jpg',
    });
  });

  it('fetches album details', async () => {
    const mockResponse: InnerTubeBrowseResponse = {
      contents: {
        twoColumnBrowseResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [
                      {
                        musicResponsiveHeaderRenderer: {
                          title: { runs: [{ text: 'Full Album' }] },
                          subtitle: {
                            runs: [
                              { text: 'Album' },
                              { text: ' • ' },
                              { text: 'The Band' },
                              { text: ' • ' },
                              { text: '2024' },
                            ],
                          },
                          thumbnail: {
                            musicThumbnailRenderer: {
                              thumbnail: {
                                thumbnails: [{ url: 'https://img.test/cover.jpg' }],
                              },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
          secondaryContents: {
            sectionListRenderer: {
              contents: [
                {
                  musicShelfRenderer: {
                    contents: [
                      {
                        musicResponsiveListItemRenderer: {
                          playlistItemData: { videoId: 'track1' },
                          flexColumns: [
                            {
                              musicResponsiveListItemFlexColumnRenderer: {
                                text: { runs: [{ text: 'Track One' }] },
                              },
                            },
                          ],
                          fixedColumns: [
                            {
                              musicResponsiveListItemFixedColumnRenderer: {
                                text: { runs: [{ text: '4:00' }] },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const client = new YtMusicClient(mockFetch as unknown as typeof fetch);
    const albumDetails = await client.getAlbum('MPREb_album123');

    expect(albumDetails.title).toBe('Full Album');
    expect(albumDetails.year).toBe('2024');
    expect(albumDetails.artists).toEqual(['The Band']);
    expect(albumDetails.tracks).toHaveLength(1);
    expect(albumDetails.tracks[0]).toEqual({
      id: 'track1',
      title: 'Track One',
      artists: ['The Band'],
      durationMs: 240000,
      trackNumber: 1,
    });
  });

  it('fetches artist details with top tracks, albums and related artists', async () => {
    const mockResponse: InnerTubeBrowseResponse = {
      header: {
        musicImmersiveHeaderRenderer: {
          title: { runs: [{ text: 'Featured Artist' }] },
          description: { runs: [{ text: 'Artist biography description.' }] },
          thumbnail: {
            musicThumbnailRenderer: {
              thumbnail: {
                thumbnails: [{ url: 'https://img.test/artist_hero.jpg' }],
              },
            },
          },
        },
      },
      contents: {
        singleColumnBrowseResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [
                      {
                        musicShelfRenderer: {
                          title: { runs: [{ text: 'Top songs' }] },
                          contents: [
                            {
                              musicResponsiveListItemRenderer: {
                                playlistItemData: { videoId: 'hit_song_1' },
                                flexColumns: [
                                  {
                                    musicResponsiveListItemFlexColumnRenderer: {
                                      text: { runs: [{ text: 'Greatest Hit' }] },
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        musicCarouselShelfRenderer: {
                          header: {
                            musicCarouselShelfBasicHeaderRenderer: {
                              title: { runs: [{ text: 'Albums' }] },
                            },
                          },
                          contents: [
                            {
                              musicTwoRowItemRenderer: {
                                navigationEndpoint: {
                                  browseEndpoint: { browseId: 'album_id_1' },
                                },
                                title: { runs: [{ text: 'Debut Album' }] },
                                subtitle: { runs: [{ text: '2020' }] },
                              },
                            },
                          ],
                        },
                      },
                      {
                        musicCarouselShelfRenderer: {
                          header: {
                            musicCarouselShelfBasicHeaderRenderer: {
                              title: { runs: [{ text: 'Fans might also like' }] },
                            },
                          },
                          contents: [
                            {
                              musicTwoRowItemRenderer: {
                                navigationEndpoint: {
                                  browseEndpoint: { browseId: 'related_artist_1' },
                                },
                                title: { runs: [{ text: 'Similar Artist' }] },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const client = new YtMusicClient(mockFetch as unknown as typeof fetch);
    const artistDetails = await client.getArtist('UC_artist_123');

    expect(artistDetails.name).toBe('Featured Artist');
    expect(artistDetails.bio).toBe('Artist biography description.');
    expect(artistDetails.topTracks).toHaveLength(1);
    expect(artistDetails.topTracks[0].title).toBe('Greatest Hit');
    expect(artistDetails.albums).toHaveLength(1);
    expect(artistDetails.albums[0].title).toBe('Debut Album');
    expect(artistDetails.relatedArtists).toHaveLength(1);
    expect(artistDetails.relatedArtists[0].name).toBe('Similar Artist');
  });
});

describe('StreamingProvider', () => {
  it('searches for tracks and maps to stream candidates', async () => {
    const mockClient = {
      searchSongs: vi.fn().mockResolvedValue([
        {
          id: 'vid1',
          title: 'Track A',
          artists: ['Artist A'],
          durationMs: 180000,
          thumbnail: 'https://img.test/thumb.jpg',
        },
      ]),
    } as unknown as YtMusicClient;

    const mockApi = {
      Ytdlp: {
        getStream: vi.fn(),
      },
    } as unknown as NuclearPluginAPI;

    const provider = createStreamingProvider(mockApi, mockClient);
    expect(provider.id).toBe(STREAMING_PROVIDER_ID);

    const candidates = await provider.searchForTrack('Artist A', 'Track A');
    expect(mockClient.searchSongs).toHaveBeenCalledWith('Artist A Track A', 10);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual({
      id: 'vid1',
      title: 'Artist A - Track A',
      durationMs: 180000,
      thumbnail: 'https://img.test/thumb.jpg',
      failed: false,
      source: { provider: STREAMING_PROVIDER_ID, id: 'vid1' },
    });
  });

  it('resolves stream URL via Ytdlp', async () => {
    const mockStreamInfo: YtdlpStreamInfo = {
      stream_url: 'https://audio.googlevideo.com/videoplayback?id=123',
      duration: 200,
      container: 'm4a',
      codec: 'mp4a.40.2',
      artists: [],
      album_artists: [],
    };

    const mockApi = {
      Ytdlp: {
        getStream: vi.fn().mockResolvedValue(mockStreamInfo),
      },
    } as unknown as NuclearPluginAPI;

    const mockClient = {} as unknown as YtMusicClient;
    const provider = createStreamingProvider(mockApi, mockClient);

    const stream = await provider.getStreamUrl('vid1');
    expect(mockApi.Ytdlp.getStream).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=vid1',
    );
    expect(stream).toEqual({
      url: 'https://audio.googlevideo.com/videoplayback?id=123',
      protocol: 'https',
      durationMs: 200000,
      container: 'm4a',
      codec: 'mp4a.40.2',
      source: { provider: STREAMING_PROVIDER_ID, id: 'vid1' },
    });
  });
});

describe('MetadataProvider', () => {
  it('searches across requested types', async () => {
    const mockClient = {
      searchSongs: vi.fn().mockResolvedValue([
        {
          id: 'song1',
          title: 'Song One',
          artists: ['Artist One'],
          durationMs: 150000,
        },
      ]),
      searchAlbums: vi.fn().mockResolvedValue([
        {
          id: 'album1',
          title: 'Album One',
          artists: ['Artist One'],
          year: '2021',
        },
      ]),
      searchArtists: vi.fn().mockResolvedValue([
        {
          id: 'artist1',
          name: 'Artist One',
        },
      ]),
    } as unknown as YtMusicClient;

    const provider = createMetadataProvider(mockClient);
    expect(provider.id).toBe(METADATA_PROVIDER_ID);

    const results = await provider.search!({
      query: 'Artist One',
      types: ['tracks', 'albums', 'artists'],
      limit: 10,
    });

    expect(results.tracks).toHaveLength(1);
    expect(results.albums).toHaveLength(1);
    expect(results.artists).toHaveLength(1);
  });

  it('fetches artist bio, top tracks, albums and related artists', async () => {
    const mockClient = {
      getArtist: vi.fn().mockResolvedValue({
        id: 'artist1',
        name: 'The Band',
        bio: 'Band biography.',
        topTracks: [
          { id: 'top1', title: 'Top Hit', artists: ['The Band'] },
        ],
        albums: [
          { id: 'alb1', title: 'First Album', artists: ['The Band'], year: '2019' },
        ],
        relatedArtists: [
          { id: 'rel1', name: 'Peer Band' },
        ],
      }),
    } as unknown as YtMusicClient;

    const provider = createMetadataProvider(mockClient);

    const bio = await provider.fetchArtistBio!('artist1');
    expect(bio.name).toBe('The Band');
    expect(bio.bio).toBe('Band biography.');

    const topTracks = await provider.fetchArtistTopTracks!('artist1');
    expect(topTracks).toHaveLength(1);
    expect(topTracks[0].title).toBe('Top Hit');

    const albums = await provider.fetchArtistAlbums!('artist1');
    expect(albums).toHaveLength(1);
    expect(albums[0].title).toBe('First Album');

    const related = await provider.fetchArtistRelatedArtists!('artist1');
    expect(related).toHaveLength(1);
    expect(related[0].name).toBe('Peer Band');
  });

  it('fetches album details by direct browseId', async () => {
    const mockClient = {
      getAlbum: vi.fn().mockResolvedValue({
        id: 'MPREb_album1',
        title: 'Master Album',
        artists: ['The Artist'],
        year: '2022',
        tracks: [
          { id: 't1', title: 'Track 1', artists: ['The Artist'], trackNumber: 1, durationMs: 180000 },
        ],
      }),
    } as unknown as YtMusicClient;

    const provider = createMetadataProvider(mockClient);
    const album = await provider.fetchAlbumDetails!('MPREb_album1');

    expect(album.title).toBe('Master Album');
    expect(album.tracks).toHaveLength(1);
    expect(album.tracks?.[0].title).toBe('Track 1');
  });
});

describe('DashboardProvider', () => {
  it('fetches top tracks, new releases, and editorial playlists', async () => {
    const mockClient = {
      getExplore: vi.fn().mockResolvedValue({
        topTracks: [
          { id: 'top1', title: 'Top Song', artists: ['Top Artist'] },
        ],
        newReleases: [
          { id: 'rel1', title: 'New Album', artists: ['New Artist'] },
        ],
        editorialPlaylists: [
          { id: 'pl1', title: 'Top Playlist', description: 'Great hits', tracks: [] },
        ],
      }),
    } as unknown as YtMusicClient;

    const provider = createDashboardProvider(mockClient);
    expect(provider.id).toBe(DASHBOARD_PROVIDER_ID);

    const topTracks = await provider.fetchTopTracks!();
    expect(topTracks).toHaveLength(1);
    expect(topTracks[0].title).toBe('Top Song');

    const newReleases = await provider.fetchNewReleases!();
    expect(newReleases).toHaveLength(1);
    expect(newReleases[0].title).toBe('New Album');

    const playlists = await provider.fetchEditorialPlaylists!();
    expect(playlists).toHaveLength(1);
    expect(playlists[0].name).toBe('Top Playlist');
  });
});

describe('PlaylistProvider', () => {
  it('extracts playlist ID and matches YouTube Music URLs', () => {
    expect(
      extractPlaylistIdFromUrl(
        'https://music.youtube.com/playlist?list=PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
      ),
    ).toBe('PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI');

    expect(
      extractPlaylistIdFromUrl(
        'https://www.youtube.com/playlist?list=PL123456',
      ),
    ).toBe('PL123456');

    const mockClient = {} as unknown as YtMusicClient;
    const provider = createPlaylistProvider(mockClient);

    expect(
      provider.matchesUrl(
        'https://music.youtube.com/playlist?list=PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
      ),
    ).toBe(true);
    expect(provider.matchesUrl('https://spotify.com/playlist/123')).toBe(false);
  });

  it('fetches playlist by URL and converts to Nuclear Playlist', async () => {
    const mockClient = {
      getPlaylist: vi.fn().mockResolvedValue({
        id: 'PL123',
        title: 'Community Hits',
        description: 'Best community tracks',
        author: 'Music Curator',
        tracks: [
          {
            id: 'track1',
            title: 'Track One',
            artists: ['Artist A'],
            album: 'Album A',
            durationMs: 210000,
          },
        ],
      }),
    } as unknown as YtMusicClient;

    const provider = createPlaylistProvider(mockClient);
    const playlist = await provider.fetchPlaylistByUrl(
      'https://music.youtube.com/playlist?list=PL123',
    );

    expect(mockClient.getPlaylist).toHaveBeenCalledWith('PL123');
    expect(playlist.name).toBe('Community Hits');
    expect(playlist.items).toHaveLength(1);
    expect(playlist.items[0].track.title).toBe('Track One');
    expect(playlist.items[0].track.artists[0].name).toBe('Artist A');
  });
});

describe('DiscoveryProvider', () => {
  it('returns recommendations based on previous track', async () => {
    const mockClient = {
      getRecommendations: vi.fn().mockResolvedValue([
        { id: 'rec1', title: 'Recommended Track 1', artists: ['Similar Artist'] },
      ]),
    } as unknown as YtMusicClient;

    const provider = createDiscoveryProvider(mockClient);
    expect(provider.id).toBe(DISCOVERY_PROVIDER_ID);

    const context = [
      {
        title: 'Initial Song',
        artists: [{ name: 'Initial Artist', roles: [] }],
        source: { provider: 'youtube-music-streaming', id: 'init1' },
      },
    ];

    const recommendations = await provider.getRecommendations(context, { variety: 1 });
    expect(mockClient.getRecommendations).toHaveBeenCalledWith('init1', 20);
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].title).toBe('Recommended Track 1');
  });
});

describe('Plugin Lifecycle', () => {
  it('registers and unregisters all 5 providers on enable/disable', () => {
    const registeredProviders: Array<{ id: string; kind: string }> = [];
    const unregisteredIds: string[] = [];

    const mockApi = {
      Http: {
        fetch: vi.fn(),
      },
      Providers: {
        register: vi.fn((provider) => {
          registeredProviders.push({ id: provider.id, kind: provider.kind });
          return provider.id;
        }),
        unregister: vi.fn((providerId) => {
          unregisteredIds.push(providerId);
          return true;
        }),
      },
    } as unknown as NuclearPluginAPI;

    plugin.onEnable!(mockApi);
    expect(mockApi.Providers.register).toHaveBeenCalledTimes(5);
    expect(registeredProviders).toEqual([
      { id: STREAMING_PROVIDER_ID, kind: 'streaming' },
      { id: METADATA_PROVIDER_ID, kind: 'metadata' },
      { id: DASHBOARD_PROVIDER_ID, kind: 'dashboard' },
      { id: PLAYLIST_PROVIDER_ID, kind: 'playlists' },
      { id: DISCOVERY_PROVIDER_ID, kind: 'discovery' },
    ]);

    plugin.onDisable!(mockApi);
    expect(mockApi.Providers.unregister).toHaveBeenCalledTimes(5);
    expect(unregisteredIds).toEqual([
      STREAMING_PROVIDER_ID,
      METADATA_PROVIDER_ID,
      DASHBOARD_PROVIDER_ID,
      PLAYLIST_PROVIDER_ID,
      DISCOVERY_PROVIDER_ID,
    ]);
  });
});
