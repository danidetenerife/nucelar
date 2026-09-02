import { invoke } from '@tauri-apps/api/core';

import type {
  YtdlpHost,
  YtdlpPlaylistInfo,
  YtdlpSearchResult,
  YtdlpStreamInfo,
} from '@nuclearplayer/plugin-sdk';

import { isTauriEnvironment } from './universalStore';

async function extractAudioStreamDirect(videoId: string): Promise<string | null> {
  try {
    const htmlRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const html = await htmlRes.text();
    const visitorMatch = html.match(/"VISITOR_DATA":"([^"]+)"/);
    const visitorId = visitorMatch ? visitorMatch[1] : '';

    const body = {
      context: {
        client: {
          clientName: 'ANDROID_VR',
          clientVersion: '1.65.10',
          deviceMake: 'Oculus',
          deviceModel: 'Quest 3',
          androidSdkVersion: 32,
          userAgent:
            'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
          osName: 'Android',
          osVersion: '12L',
          hl: 'en',
          gl: 'US',
          ...(visitorId ? { visitorData: visitorId } : {}),
        },
      },
      videoId,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent':
        'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
      'X-YouTube-Client-Name': '28',
      'X-YouTube-Client-Version': '1.65.10',
      Origin: 'https://www.youtube.com',
      ...(visitorId ? { 'X-Goog-Visitor-Id': visitorId } : {}),
    };

    const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const formats = data.streamingData?.adaptiveFormats || [];
    const audioFormats = formats.filter(
      (format: any) => format.mimeType && format.mimeType.includes('audio'),
    );

    audioFormats.sort(
      (a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0),
    );

    for (const format of audioFormats) {
      if (format.url) {
        return format.url;
      }
    }
  } catch (error) {
    console.warn('[ytdlpHost] Direct Android VR extraction failed:', error);
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

      const directAudioUrl = await extractAudioStreamDirect(videoId);

      return {
        stream_url: directAudioUrl || `https://www.youtube.com/watch?v=${videoId}`,
        duration: null,
        title: null,
        container: 'mp4',
        codec: 'aac',
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
