import { invoke } from '@tauri-apps/api/core';

import type {
  YtdlpHost,
  YtdlpPlaylistInfo,
  YtdlpSearchResult,
  YtdlpStreamInfo,
} from '@nuclearplayer/plugin-sdk';

import { isTauriEnvironment } from './universalStore';

export const ytdlpHost: YtdlpHost = {
  search: async (
    query: string,
    maxResults?: number,
  ): Promise<YtdlpSearchResult[]> => {
    if (!isTauriEnvironment()) {
      return [];
    }
    return invoke<YtdlpSearchResult[]>('ytdlp_search', {
      query,
      maxResults: maxResults ?? 10,
    });
  },

  getStream: async (url: string): Promise<YtdlpStreamInfo> => {
    if (!isTauriEnvironment()) {
      let videoId = url;
      const match = url.match(
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
      );
      if (match && match[1]) {
        videoId = match[1];
      }

      return {
        stream_url: `https://www.youtube.com/watch?v=${videoId}`,
        duration: null,
        title: null,
        container: 'webm',
        codec: 'opus',
        album: null,
        artists: [],
        album_artists: [],
        upload_date: null,
      };
    }
    return invoke<YtdlpStreamInfo>('ytdlp_get_stream', { url });
  },

  getPlaylist: async (url: string): Promise<YtdlpPlaylistInfo> => {
    if (!isTauriEnvironment()) {
      return { id: '', title: '', entries: [] };
    }
    return invoke<YtdlpPlaylistInfo>('ytdlp_get_playlist', { url });
  },
};
