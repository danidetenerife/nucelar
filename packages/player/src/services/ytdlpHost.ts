import { invoke } from '@tauri-apps/api/core';

import type {
  YtdlpHost,
  YtdlpPlaylistInfo,
  YtdlpSearchResult,
  YtdlpStreamInfo,
} from '@nuclearplayer/plugin-sdk';

import { isTauriEnvironment } from './universalStore';

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.smnz.de',
  'https://pipedapi.lunar.icu',
  'https://pipedapi.moomoo.me',
];

async function extractAudioStreamViaPiped(videoId: string): Promise<string | null> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const response = await fetch(`${instance}/streams/${videoId}`);
      if (!response.ok) continue;
      const data = await response.json();
      const audioStreams = data.audioStreams || [];
      const stream = audioStreams.find((s: any) => s.mimeType?.includes('audio/mp4') || s.mimeType?.includes('audio/webm')) || audioStreams[0];
      if (stream && stream.url) {
        return stream.url;
      }
    } catch (e) {
      console.warn(`[ytdlpHost] Failed to fetch from ${instance}:`, e);
    }
  }
  return null;
}

async function extractAudioStreamViaCobalt(url: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        isAudioOnly: true
      })
    });
    if (response.ok) {
      const data = await response.json();
      return data.url;
    }
  } catch (e) {
    console.warn('[ytdlpHost] Cobalt API failed:', e);
  }
  return null;
}

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

      let directAudioUrl = await extractAudioStreamViaPiped(videoId);
      if (!directAudioUrl) {
        directAudioUrl = await extractAudioStreamViaCobalt(`https://www.youtube.com/watch?v=${videoId}`);
      }

      return {
        stream_url: directAudioUrl || `https://www.youtube.com/watch?v=${videoId}`,
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
