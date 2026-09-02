export type YtMusicThumbnail = {
  url: string;
  width?: number;
  height?: number;
};

export type YtMusicSong = {
  id: string;
  title: string;
  artists: string[];
  album?: string;
  durationMs?: number;
  thumbnail?: string;
  isExplicit?: boolean;
};

export type YtMusicAlbum = {
  id: string;
  title: string;
  artists: string[];
  year?: string;
  thumbnail?: string;
};

export type YtMusicArtist = {
  id: string;
  name: string;
  subscribers?: string;
  thumbnail?: string;
};

export type YtMusicAlbumTrack = {
  id: string;
  title: string;
  artists: string[];
  durationMs?: number;
  trackNumber: number;
};

export type YtMusicAlbumDetails = {
  id: string;
  title: string;
  artists: string[];
  year?: string;
  thumbnail?: string;
  tracks: YtMusicAlbumTrack[];
};

export type YtMusicPlaylistTrack = {
  id: string;
  title: string;
  artists: string[];
  album?: string;
  durationMs?: number;
  thumbnail?: string;
};

export type YtMusicPlaylistDetails = {
  id: string;
  title: string;
  description?: string;
  author?: string;
  thumbnail?: string;
  tracks: YtMusicPlaylistTrack[];
};

export type YtMusicExploreResult = {
  topTracks: YtMusicSong[];
  newReleases: YtMusicAlbum[];
  editorialPlaylists: YtMusicPlaylistDetails[];
};

export type YtMusicArtistDetails = {
  id: string;
  name: string;
  bio?: string;
  thumbnail?: string;
  topTracks: YtMusicSong[];
  albums: YtMusicAlbum[];
  relatedArtists: YtMusicArtist[];
};

export type InnerTubeTextRun = {
  text: string;
  navigationEndpoint?: {
    clickTrackingParams?: string;
    watchEndpoint?: {
      videoId?: string;
    };
    browseEndpoint?: {
      browseId?: string;
      browseEndpointContextSupportedConfigs?: {
        browseEndpointContextMusicConfig?: {
          pageType?: string;
        };
      };
    };
  };
};

export type InnerTubeFlexColumn = {
  musicResponsiveListItemFlexColumnRenderer?: {
    text?: {
      runs?: InnerTubeTextRun[];
    };
  };
};

export type InnerTubeFixedColumn = {
  musicResponsiveListItemFixedColumnRenderer?: {
    text?: {
      runs?: InnerTubeTextRun[];
    };
  };
};

export type InnerTubeThumbnail = {
  url: string;
  width?: number;
  height?: number;
};

export type InnerTubeResponsiveListItem = {
  trackingParams?: string;
  playlistItemData?: {
    videoId?: string;
  };
  navigationEndpoint?: {
    browseEndpoint?: {
      browseId?: string;
    };
  };
  thumbnail?: {
    musicThumbnailRenderer?: {
      thumbnail?: {
        thumbnails?: InnerTubeThumbnail[];
      };
    };
  };
  overlay?: {
    musicItemThumbnailOverlayRenderer?: {
      content?: {
        musicPlayButtonRenderer?: {
          playNavigationEndpoint?: {
            watchEndpoint?: {
              videoId?: string;
            };
          };
        };
      };
    };
  };
  flexColumns?: InnerTubeFlexColumn[];
  fixedColumns?: InnerTubeFixedColumn[];
};

export type InnerTubeShelf = {
  title?: {
    runs?: InnerTubeTextRun[];
  };
  contents?: Array<{
    musicResponsiveListItemRenderer?: InnerTubeResponsiveListItem;
  }>;
};

export type InnerTubeCarouselShelf = {
  header?: {
    musicCarouselShelfBasicHeaderRenderer?: {
      title?: {
        runs?: InnerTubeTextRun[];
      };
    };
  };
  contents?: Array<{
    musicResponsiveListItemRenderer?: InnerTubeResponsiveListItem;
    musicTwoRowItemRenderer?: {
      title?: {
        runs?: InnerTubeTextRun[];
      };
      subtitle?: {
        runs?: InnerTubeTextRun[];
      };
      navigationEndpoint?: {
        browseEndpoint?: {
          browseId?: string;
        };
        watchEndpoint?: {
          videoId?: string;
        };
      };
      thumbnailRenderer?: {
        musicThumbnailRenderer?: {
          thumbnail?: {
            thumbnails?: InnerTubeThumbnail[];
          };
        };
      };
    };
  }>;
};

export type InnerTubeSearchResponse = {
  contents?: {
    tabbedSearchResultsRenderer?: {
      tabs?: Array<{
        tabRenderer?: {
          content?: {
            sectionListRenderer?: {
              contents?: Array<{
                musicShelfRenderer?: InnerTubeShelf;
                itemSectionRenderer?: {
                  contents?: Array<{
                    musicShelfRenderer?: InnerTubeShelf;
                  }>;
                };
              }>;
            };
          };
        };
      }>;
    };
  };
};

export type InnerTubeBrowseResponse = {
  header?: {
    musicImmersiveHeaderRenderer?: {
      title?: { runs?: InnerTubeTextRun[] };
      description?: { runs?: InnerTubeTextRun[] };
      thumbnail?: {
        musicThumbnailRenderer?: {
          thumbnail?: { thumbnails?: InnerTubeThumbnail[] };
        };
      };
    };
    musicVisualHeaderRenderer?: {
      title?: { runs?: InnerTubeTextRun[] };
      description?: { runs?: InnerTubeTextRun[] };
      thumbnail?: {
        musicThumbnailRenderer?: {
          thumbnail?: { thumbnails?: InnerTubeThumbnail[] };
        };
      };
    };
    musicDetailHeaderRenderer?: {
      title?: { runs?: InnerTubeTextRun[] };
      subtitle?: { runs?: InnerTubeTextRun[] };
      thumbnail?: {
        musicThumbnailRenderer?: {
          thumbnail?: { thumbnails?: InnerTubeThumbnail[] };
        };
      };
    };
    musicResponsiveHeaderRenderer?: {
      title?: { runs?: InnerTubeTextRun[] };
      subtitle?: { runs?: InnerTubeTextRun[] };
      straplineTextOne?: { runs?: InnerTubeTextRun[] };
      thumbnail?: {
        musicThumbnailRenderer?: {
          thumbnail?: { thumbnails?: InnerTubeThumbnail[] };
        };
      };
    };
  };
  contents?: {
    singleColumnBrowseResultsRenderer?: {
      tabs?: Array<{
        tabRenderer?: {
          content?: {
            sectionListRenderer?: {
              contents?: Array<{
                musicShelfRenderer?: InnerTubeShelf;
                musicCarouselShelfRenderer?: InnerTubeCarouselShelf;
              }>;
            };
          };
        };
      }>;
    };
    twoColumnBrowseResultsRenderer?: {
      secondaryContents?: {
        sectionListRenderer?: {
          contents?: Array<{
            musicShelfRenderer?: InnerTubeShelf;
          }>;
        };
      };
      tabs?: Array<{
        tabRenderer?: {
          content?: {
            sectionListRenderer?: {
              contents?: Array<{
                musicResponsiveHeaderRenderer?: {
                  title?: { runs?: InnerTubeTextRun[] };
                  subtitle?: { runs?: InnerTubeTextRun[] };
                  straplineTextOne?: { runs?: InnerTubeTextRun[] };
                  thumbnail?: {
                    musicThumbnailRenderer?: {
                      thumbnail?: { thumbnails?: InnerTubeThumbnail[] };
                    };
                  };
                };
              }>;
            };
          };
        };
      }>;
    };
  };
};
